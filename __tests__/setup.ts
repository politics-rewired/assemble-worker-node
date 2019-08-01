import { connect } from 'amqplib';
import config from '../src/lib/config';
import { META_QUEUE, TEST_WORKER_QUEUES } from '../src/lib/rabbit-runner';
import { migrate, reset } from '../src/lib/migrate';
import { Pool } from 'pg';

export default async function() {
  const connection = await connect('amqp://localhost');
  const channel = await connection.createChannel();

  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString
  });

  const client = await pool.connect();

  await reset(client);
  await migrate(client);
  await client.release();
  await pool.end();

  await channel.deleteQueue(META_QUEUE);
  for (let queue of TEST_WORKER_QUEUES) {
    await channel.deleteQueue(queue);
  }
  await channel.close();
}
