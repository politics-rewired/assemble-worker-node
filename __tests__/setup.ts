/* tslint:disable */
import { connect } from 'amqplib';
import { Pool } from 'pg';

import config from '../src/lib/config';
import { installSchema, migrate, reset } from '../src/lib/migrate';
import {
  ASSEMBLE_EXCHANGE,
  META_QUEUE,
  TEST_WORKER_QUEUES,
} from '../src/lib/rabbit-runner';
import { withClient } from '../src/utils';

export default async function () {
  console.log('Running global setup');
  const connection = await connect(config.amqpConnectionString);
  console.log('connected to Rabbit');
  const channel = await connection.createChannel();
  console.log('created channel');
  await channel.assertExchange(ASSEMBLE_EXCHANGE, 'direct');
  console.log('asserted exchange');

  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString,
  });

  console.log('created pool');

  await withClient(pool, async (client) => {
    console.log('in withCLient');
    await reset(client);
    console.log('reset client');
    await installSchema(client);
    console.log('installed schema');
    await migrate(client);
    console.log('migrated client');
  });
  console.log('out of withClient');
  await pool.end();

  console.log('ended pool');

  await channel.deleteQueue(META_QUEUE);
  console.log('deleted meta queue');
  console.log('deleting queues', TEST_WORKER_QUEUES);
  for (let queue of TEST_WORKER_QUEUES) {
    await channel.deleteQueue(queue);
  }
  console.log('deleted queues');
  await channel.close();
  console.log('closed channel');
}
