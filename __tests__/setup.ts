import { connect } from 'amqplib';
import config from '../src/lib/config';
import {
  ASSEMBLE_EXCHANGE,
  META_QUEUE,
  TEST_WORKER_QUEUES
} from '../src/lib/rabbit-runner';
import { migrate, reset } from '../src/lib/migrate';
import { withClient } from '../src/utils';
import { Pool } from 'pg';

export default async function() {
  const connection = await connect(config.amqpConnectionString);
  const channel = await connection.createChannel();
  await channel.assertExchange(ASSEMBLE_EXCHANGE, 'direct');

  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString
  });

  await withClient(pool, async client => {
    await reset(client);
    await migrate(client);
  });
  await pool.end();

  await channel.deleteQueue(META_QUEUE);
  for (let queue of TEST_WORKER_QUEUES) {
    await channel.deleteQueue(queue);
  }
  await channel.close();
}
