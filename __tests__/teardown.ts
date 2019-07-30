import { connect } from 'amqplib';
import { META_QUEUE, TEST_WORKER_QUEUES } from '../src/lib/rabbit-runner';

export default async function() {
  const connection = await connect('amqp://localhost');
  const channel = await connection.createChannel();

  await channel.deleteQueue(META_QUEUE);
  for (let queue of TEST_WORKER_QUEUES) {
    await channel.deleteQueue(queue);
  }
}
