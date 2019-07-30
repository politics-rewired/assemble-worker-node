import { connect } from 'amqplib';
import { createRunner, META_QUEUE, TEST_WORKER_QUEUES } from './rabbit-runner';

async function sleep(n: number) {
  return new Promise((resolve, _reject) => setTimeout(resolve, n));
}

test('importing rabbit creates meta:new-queue', async () => {
  await createRunner(
    'amqp://localhost',
    {},
    async function() {},
    async function() {}
  );

  await sleep(100);

  const connection = await connect('amqp://localhost');
  const channel = await connection.createChannel();

  const queueExists = await channel.checkQueue(META_QUEUE);
  expect(queueExists.queue).toBe(META_QUEUE);
});

test('sending a new queue to the meta queue creates the new queue', async () => {
  const { channelWrapper } = await createRunner(
    'amqp://localhost',
    {},
    async function() {},
    async function() {}
  );

  await channelWrapper.sendToQueue(
    'meta:new-queue',
    Buffer.from(TEST_WORKER_QUEUES[0]),
    {
      persistent: true
    }
  );

  await sleep(100);

  const connection = await connect('amqp://localhost');
  const channel = await connection.createChannel();

  const queueExists = await channel.checkQueue(TEST_WORKER_QUEUES[0]);
  expect(queueExists.queue).toBe(TEST_WORKER_QUEUES[0]);
});

test('sending a job should call onSuccess for that job', async () => {
  const jobName = 'trivial-success';

  async function triviallySuccessfulJob(_payload) {
    return undefined;
  }

  const onSuccess = jest.fn();

  const { channelWrapper } = await createRunner(
    'amqp://localhost',
    { [jobName]: triviallySuccessfulJob },
    onSuccess,
    async function() {}
  );

  await channelWrapper.sendToQueue(
    jobName,
    Buffer.from(JSON.stringify({ value: 'value' }))
  );

  await sleep(100);

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
    { [jobName]: triviallyFailingJob },
    async function() {},
    onFailure
  );

  await channelWrapper.sendToQueue(
    jobName,
    Buffer.from(JSON.stringify({ value: 'value' }))
  );

  await sleep(100);

  expect(onFailure).toHaveBeenCalled();
});
