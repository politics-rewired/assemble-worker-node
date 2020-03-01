import { connect } from 'amqplib';
import {
  createRunner,
  ASSEMBLE_EXCHANGE,
  META_QUEUE
  // TEST_WORKER_QUEUES
} from './rabbit-runner';

async function sleep(n: number) {
  return new Promise((resolve, _reject) => setTimeout(resolve, n));
}

const SLEEP_TIME = 500;

describe('rabbit interaction', () => {
  test('importing rabbit creates meta-queue', async () => {
    await createRunner(
      'amqp://localhost',
      {},
      async function() {},
      async function() {},
      async function() {},
      async function() {},
      async function() {}
    );

    await sleep(SLEEP_TIME);

    const connection = await connect('amqp://localhost');
    const channel = await connection.createChannel();

    const queueExists = await channel.checkQueue(META_QUEUE);
    expect(queueExists.queue).toBe(META_QUEUE);
  });

  /**
   * Unsure what the desired behavior is here – for now, creating queues based on task names
   * at startup is good enough
   */
  // test('sending a new queue to the meta queue creates the new queue', async () => {
  //   const registerQueue = jest.fn();

  //   const { channelWrapper } = await createRunner(
  //     'amqp://localhost',
  //     {},
  //     async function() {},
  //     async function() {},
  //     registerQueue
  //   );

  //   await channelWrapper.publish(
  //     ASSEMBLE_EXCHANGE,
  //     META_QUEUE,
  //     Buffer.from(TEST_WORKER_QUEUES[0]),
  //     {
  //       persistent: true
  //     }
  //   );

  //   await sleep(SLEEP_TIME);

  //   const connection = await connect('amqp://localhost');
  //   const channel = await connection.createChannel();

  //   const queueExists = await channel.checkQueue(TEST_WORKER_QUEUES[0]);
  //   expect(queueExists.queue).toBe(TEST_WORKER_QUEUES[0]);

  //   expect(registerQueue).toHaveBeenCalled();
  // });

  test('sending a job should call onSuccess for that job', async () => {
    const jobName = 'trivial-success';

    async function triviallySuccessfulJob(_payload) {
      return undefined;
    }

    const onSuccess = jest.fn();

    const { channelWrapper } = await createRunner(
      'amqp://localhost',
      { [jobName]: { concurrency: 1, task: { one: triviallySuccessfulJob } } },
      onSuccess,
      async function() {},
      async function() {},
      async function() {},
      async function() {}
    );

    await channelWrapper.publish(
      ASSEMBLE_EXCHANGE,
      jobName,
      Buffer.from(JSON.stringify({ value: 'value' }))
    );

    await sleep(SLEEP_TIME);

    expect(onSuccess).toHaveBeenCalled();
  });

  test('sending a job should call onFailure for that job', async () => {
    const jobName = 'trivial-failure';
    async function triviallyFailingJob(_payload) {
      throw new Error("I'm a failure!");
    }

    const onFailure = jest.fn();

    const { channelWrapper } = await createRunner(
      'amqp://localhost',
      { [jobName]: { concurrency: 1, task: { one: triviallyFailingJob } } },
      async function() {},
      onFailure,
      async function() {},
      async function() {},
      async function() {}
    );

    await channelWrapper.publish(
      ASSEMBLE_EXCHANGE,
      jobName,
      Buffer.from(JSON.stringify({ value: 'value' }))
    );

    await sleep(SLEEP_TIME);

    expect(onFailure).toHaveBeenCalled();
  });
});
