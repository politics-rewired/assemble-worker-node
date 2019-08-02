import { ConfirmChannel, Message } from 'amqplib';
import { connect, ChannelWrapper } from 'amqp-connection-manager';
import { times } from 'lodash';
import { defineConsumer } from './consume';
import { TaskList, SuccessFn, FailureFn, CreateQueueFn } from './interfaces';

export const ASSEMBLE_EXCHANGE = 'assemble_worker';
export const META_QUEUE = 'meta-queue';
export const TEST_WORKER_QUEUES = ['trivial-success', 'trivial-failure'];

function defineSetupWorkerQueue(
  queueName: string,
  taskList: TaskList,
  onSuccess: SuccessFn,
  onFailure: FailureFn,
  registerQueue: CreateQueueFn
) {
  return async function(channel: ConfirmChannel) {
    const task = taskList[queueName];

    if (!task) {
      return; // todo - logging
    }

    await channel.prefetch(1);
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, ASSEMBLE_EXCHANGE, queueName);
    await registerQueue(queueName);

    const consumer = defineConsumer(
      channel,
      queueName,
      task.task,
      onSuccess,
      onFailure
    );

    times(Math.max(task.concurrency, 1), () => {
      channel.consume(queueName, consumer, { noAck: false });
    });
  };
}

function defineSetupMetaQueue(
  getChannelWrapper: () => ChannelWrapper,
  taskList: TaskList,
  onSuccess: SuccessFn,
  onFailure: FailureFn,
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
            onSuccess,
            onFailure,
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
        onSuccess,
        onFailure,
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
  onSuccess: SuccessFn,
  onFailure: FailureFn,
  registerQueue: CreateQueueFn
) {
  // Create a new connection manager
  const connection = connect([amqpConnectionString]);
  const jobRegistryCache = new Set<string>();

  function getChannelWrapper() {
    return channelWrapper;
  }

  const setupMetaQueue = defineSetupMetaQueue(
    getChannelWrapper,
    taskList,
    onSuccess,
    onFailure,
    registerQueue,
    jobRegistryCache
  );

  const channelWrapper = connection.createChannel({
    setup: async channel => {
      await setupAssembleExchange(channel);
      await setupMetaQueue(channel);
    }
  });

  async function stop() {
    await channelWrapper.close();
  }

  return { stop, channelWrapper };
}

export { createRunner };
