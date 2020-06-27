import { Pool } from 'pg';
import config from './config';
import { makePgFunctions } from './pg-functions';
import { META_QUEUE } from './rabbit-runner';
import { withClient } from '../utils';

const ENABLE_TEST_MODE = `select set_config('worker.test', 'on', false);`;
const DISABLE_TEST_MODE = `select set_config('worker.test', 'off', false);`;

const DUMMY_QUEUE = () => 'dummy-queue';
const DUMMY_PAYLOAD = () => ({
  value: (Math.random() * 100).toString()
});

describe('assemble_worker.add_job', () => {
  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString
  });

  const { addJob, registerQueue } = makePgFunctions(pool);

  test('without queue, should go to pending', async () => {
    await withClient(pool, async client => {
      await client.query(ENABLE_TEST_MODE);

      const payload = DUMMY_PAYLOAD();
      const queueName = DUMMY_QUEUE();
      await addJob({ queueName, payload }, client);

      const { rows: foundPendingJob } = await client.query(
        `select * from assemble_worker.pending_jobs where payload->>'value' = $1`,
        [payload.value]
      );

      expect(foundPendingJob).toHaveLength(1);

      await client.query(DISABLE_TEST_MODE);
    });
  });

  test('without queue, a new queue message should be sent', async () => {
    await withClient(pool, async client => {
      await client.query(ENABLE_TEST_MODE);

      const payload = DUMMY_PAYLOAD();
      const queueName = DUMMY_QUEUE();
      await addJob({ queueName, payload }, client);

      const { rows: foundQueueCreateMessage } = await client.query(
        `select * from assemble_worker.test_queue_messages where routing_key = $1 and message_body = $2`,
        [META_QUEUE, queueName]
      );

      expect(foundQueueCreateMessage).toHaveLength(1);

      await client.query(DISABLE_TEST_MODE);
    });
  });

  test('after create without queue, creating the queue should create the job', async () => {
    await withClient(pool, async client => {
      await client.query(ENABLE_TEST_MODE);

      const payload = DUMMY_PAYLOAD();
      const queueName = DUMMY_QUEUE();

      await addJob({ queueName, payload }, client);
      await registerQueue(queueName, client);

      const { rows: foundJobs } = await client.query(
        `select * from assemble_worker.jobs where payload->>'value' = $1`,
        [payload.value]
      );

      expect(foundJobs).toHaveLength(1);

      await client.query(DISABLE_TEST_MODE);
    });
  });

  test('after create without queue, creating the queue should send the job', async () => {
    await withClient(pool, async client => {
      await client.query(ENABLE_TEST_MODE);

      const payload = DUMMY_PAYLOAD();
      const queueName = DUMMY_QUEUE();

      await addJob({ queueName, payload }, client);
      await registerQueue(queueName, client);

      const { rows: foundJobMessages } = await client.query(
        `select * from assemble_worker.test_queue_messages where routing_key = $1 and message_body::json->>'value'::text = $2`,
        [queueName, payload.value]
      );

      expect(foundJobMessages).toHaveLength(1);

      await client.query(DISABLE_TEST_MODE);
    });
  });
});
