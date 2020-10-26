import { Pool } from 'pg';
import config from './config';
import { makePgFunctions } from './pg-functions';
import { withClient } from '../utils';

const ENABLE_TEST_MODE = `select set_config('worker.test', 'on', false);`;
const DISABLE_TEST_MODE = `select set_config('worker.test', 'off', false);`;

const DUMMY_QUEUE = 'dummy-queue';
const DUMMY_PAYLOAD = { value: (Math.random() * 100).toString() };

describe('poke', () => {
  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString
  });

  const { poke } = makePgFunctions(pool);

  test('poke sends a message that should be sent - status now running, second poke shouldnt send two', async () => {
    await withClient(pool, async client => {
      await client.query(ENABLE_TEST_MODE);

      const oneSecondAgo = new Date();
      oneSecondAgo.setSeconds(oneSecondAgo.getSeconds() - 1);

      console.log('About to insert dummy payload', DUMMY_PAYLOAD);

      const {
        rows: [row]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status, run_at) values ($1, $2, 'waiting to run', $3) returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD, oneSecondAgo]
      );

      console.log('Inserted dummy payload');

      console.log('About to poke twice');

      await Promise.all([poke(client), poke(client)]);

      console.log(
        'Poked twice. About to select matching rows with json-coerced message_body'
      );

      const { rows: matchingRows } = await client.query(
        `select * from assemble_worker.test_queue_messages where ((message_body::json)->>'job_id')::bigint = $1`,
        [row.id]
      );

      console.log('selected matching rows with json-coerced message_body');

      expect(Array.isArray(matchingRows)).toBe(true);
      expect(matchingRows).toHaveLength(1);

      const {
        rows: [dummyJob]
      } = await client.query(
        `select * from assemble_worker.jobs where id = $1`,
        [row.id]
      );

      expect(dummyJob.status).toBe('running');

      await client.query(DISABLE_TEST_MODE);
    });
  });
});
