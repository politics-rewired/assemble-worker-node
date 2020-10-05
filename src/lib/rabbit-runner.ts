import { ConfirmChannel, Message } from 'amqplib';
import { connect, ChannelWrapper } from 'amqp-connection-manager';
import { Logger } from 'winston';

import { defineConsumer } from './consume';
import {
  TaskList,
  SuccessFn,
  FailureFn,
  SuccessManyFn,
  FailureManyFn,
  CreateQueueFn,
  DisconnectHandler,
} from './interfaces';

export const ASSEMBLE_EXCHANGE = 'assemble_worker';
export const META_QUEUE = 'meta-queue';
export const TEST_WORKER_QUEUES = ['trivial-success', 'trivial-failure'];

const MAX_CONCURRENCY = 10;

function defineSetupWorkerQueue(
  queueName: string,
  taskList: TaskList,
  logger: Logger,
  onSuccess: SuccessFn,
  onFailure: FailureFn,
  onSuccessMany: SuccessManyFn,
  onFailureMany: FailureManyFn,
  registerQueue: CreateQueueFn
) {
  return async function(channel: ConfirmChannel) {
    const task = taskList[queueName];

    if (!task) {
      return; // todo - logging
    }

    const concurrency = Math.min(
      MAX_CONCURRENCY,
      Math.max(task.concurrency, 1)
    );

    await channel.prefetch(concurrency);
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, ASSEMBLE_EXCHANGE, queueName);
    logger.info(`Set up queue: ${queueName} with concurrency: ${concurrency}`);

    await registerQueue(queueName);

    const consumer = defineConsumer(
      channel,
      queueName,
      task.task,
      logger,
      onSuccess,
      onFailure,
      onSuccessMany,
      onFailureMany
    );

    channel.consume(queueName, consumer, { noAck: false });
  };
}

function defineSetupMetaQueue(
  getChannelWrapper: () => ChannelWrapper,
  taskList: TaskList,
  logger: Logger,
  onSuccess: SuccessFn,
  onFailure: FailureFn,
  onSuccessMany: SuccessManyFn,
  onFailureMany: FailureManyFn,
  registerQueue: CreateQueueFn,
  jobRegistryCache: Set<string>
) {
  return async function(channel: ConfirmChannel) {
    await channel.assertQueue(META_QUEUE, { durable: true });
    await channel.bindQueue(META_QUEUE, ASSEMBLE_EXCHANGE, META_QUEUE);

    // Define handler for creating new queues
    await Promise.all(
      Object.keys(taskList).map(async queueName => {
        const queueAlreadyRegistered = jobRegistryCache.has(queueName);

        if (!queueAlreadyRegistered) {
          const setupWorkerQueue = defineSetupWorkerQueue(
            queueName,
            taskList,
            logger,
            onSuccess,
            onFailure,
            onSuccessMany,
            onFailureMany,
            registerQueue
          );

          await setupWorkerQueue(channel);
          jobRegistryCache.add(queueName);
        }
      })
    );

    channel.consume(META_QUEUE, async (msg: Message) => {
      const payloadString = msg.content.toString();
      const newQueueName = payloadString.replace(META_QUEUE + '|', '');

      const channelWrapper = getChannelWrapper();

      const setupWorkerQueue = defineSetupWorkerQueue(
        newQueueName,
        taskList,
        logger,
        onSuccess,
        onFailure,
        onSuccessMany,
        onFailureMany,
        registerQueue
      );

      // Add it now
      await setupWorkerQueue(channel);

      // Add it to future set ups
      await channelWrapper.addSetup(setupWorkerQueue);
    });
  };
}

async function setupAssembleExchange(channel: ConfirmChannel) {
  await channel.assertExchange(ASSEMBLE_EXCHANGE, 'direct');
}

function createRunner(
  amqpConnectionString: string,
  taskList: TaskList,
  logger: Logger,
  onSuccess: SuccessFn,
  onFailure: FailureFn,
  onSuccessMany: SuccessManyFn,
  onFailureMany: FailureManyFn,
  registerQueue: CreateQueueFn,
  onRabbitDisconnect?: DisconnectHandler,
) {
  const rabbitLogger = logger.child({ component: 'rabbit' });
  // Create a new connection manager
  const connection = connect([amqpConnectionString]);

  connection.on('connect', info => {
    rabbitLogger.info(`Got connection at ${info.url}: ${info.connection}`);
  });

  connection.on('disconnect', info => {
    rabbitLogger.info(`Disconnected from rabbit, got error: `, info.err);
    if (typeof onRabbitDisconnect === 'function') {
      onRabbitDisconnect(info.err)
    }
  });

  const jobRegistryCache = new Set<string>();

  function getChannelWrapper() {
    return channelWrapper;
  }

  const setupMetaQueue = defineSetupMetaQueue(
    getChannelWrapper,
    taskList,
    rabbitLogger,
    onSuccess,
    onFailure,
    onSuccessMany,
    onFailureMany,
    registerQueue,
    jobRegistryCache
  );

  const channelWrapper = connection.createChannel({
    setup: async channel => {
      await setupAssembleExchange(channel);
      rabbitLogger.info('Set up exhange: assemble');
      await setupMetaQueue(channel);
      rabbitLogger.info('Set up exchange: meta');
    }
  });

  async function stop() {
    await channelWrapper.close();
  }

  return { stop, channelWrapper };
}

export { createRunner };
