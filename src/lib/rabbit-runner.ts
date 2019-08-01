import { ConfirmChannel, Message } from 'amqplib';
import { connect, ChannelWrapper } from 'amqp-connection-manager';
import { defineConsumer } from './consume';
import { TaskList, SuccessFn, FailureFn } from './interfaces';

export const ASSEMBLE_EXCHANGE = 'assemble_worker';
export const META_QUEUE = 'meta-queue';
export const TEST_WORKER_QUEUES = ['trivial-success', 'trivial-failure'];

function defineSetupWorkerQueue(
  queueName: string,
  taskList: TaskList,
  onSuccess: SuccessFn,
  onFailure: FailureFn
) {
  return async function(channel: ConfirmChannel) {
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, ASSEMBLE_EXCHANGE, queueName);

    // todo - do something with taskList
    const job = taskList[queueName];

    const consumer = defineConsumer(
      channel,
      queueName,
      job,
      onSuccess,
      onFailure
    );

    channel.consume(queueName, consumer, { noAck: false });
  };
}

function defineSetupMetaQueue(
  getChannelWrapper: () => ChannelWrapper,
  taskList: TaskList,
  onSuccess: SuccessFn,
  onFailure: FailureFn
) {
  return async function(channel: ConfirmChannel) {
    await channel.assertQueue(META_QUEUE, { durable: true });
    await channel.bindQueue(META_QUEUE, ASSEMBLE_EXCHANGE, META_QUEUE);

    // Define handler for creating new queues
    await Promise.all(
      Object.keys(taskList).map(async queueName => {
        const setupWorkerQueue = defineSetupWorkerQueue(
          queueName,
          taskList,
          onSuccess,
          onFailure
        );

        return await setupWorkerQueue(channel);
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
        onFailure
      );

      // Add it now
      await setupWorkerQueue(channel);

      // Add it to future set ups
      await channelWrapper.addSetup(setupWorkerQueue);
    });
  };
}

async function setupAssembleQueue(channel: ConfirmChannel) {
  await channel.assertExchange(ASSEMBLE_EXCHANGE, 'direct');
}

function createRunner(
  amqpConnectionString: string,
  taskList: TaskList,
  onSuccess: SuccessFn,
  onFailure: FailureFn
) {
  // Create a new connection manager
  const connection = connect([amqpConnectionString]);

  function getChannelWrapper() {
    return channelWrapper;
  }

  const setupMetaQueue = defineSetupMetaQueue(
    getChannelWrapper,
    taskList,
    onSuccess,
    onFailure
  );

  const channelWrapper = connection.createChannel({
    setup: async channel => {
      await setupAssembleQueue(channel);
      await setupMetaQueue(channel);
    }
  });

  async function stop() {
    await channelWrapper.close();
  }

  return { stop, channelWrapper };
}

export { createRunner };
