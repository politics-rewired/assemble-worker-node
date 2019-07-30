import { ConfirmChannel, Message } from 'amqplib';
import { connect, ChannelWrapper } from 'amqp-connection-manager';
import { defineConsumer } from './consume';
import { TaskList, SuccessFn, FailureFn } from './interfaces';

export const META_QUEUE = 'meta:new-queue';
export const TEST_WORKER_QUEUES = ['trivial-success', 'trivial-failure'];

function defineSetupWorkerQueue(
  queueName: string,
  taskList: TaskList,
  onSuccess: SuccessFn,
  onFailure: FailureFn
) {
  return async function(channel: ConfirmChannel) {
    await channel.assertQueue(queueName, { durable: true });
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
      const newQueueName = msg.content.toString();

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

  const channelWrapper = connection.createChannel({ setup: setupMetaQueue });

  async function stop() {
    // todo
  }

  return { stop, channelWrapper };
}

export { createRunner };

// export async function withPgClient<T = any>(
//   cb
// ): Promise<T> {
//   connect
//   return
//   return withPgPool(async pool => {
//     const client = await pool.connect();
//     try {
//       return await cb(client);
//     } finally {
//       client.release();
//     }
//   });
// }
