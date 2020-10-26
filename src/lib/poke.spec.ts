import { Pool } from 'pg';
import config from './config';
import { makePgFunctions, Poke } from './pg-functions';
import { withClient } from '../utils';

const ENABLE_TEST_MODE = `select set_config('worker.test', 'on', false);`;
const DISABLE_TEST_MODE = `select set_config('worker.test', 'off', false);`;

const DUMMY_QUEUE = 'dummy-queue';
const DUMMY_PAYLOAD = { value: (Math.random() * 100).toString() };

describe('poke', () => {
  let pool: Pool;
  let poke: Poke;

  beforeAll(() => {
    pool = new Pool({
      connectionString: config.testDatabaseConnectionString
    });
    ({ poke } = makePgFunctions(pool));
  });

  afterAll(async () => {
    await pool.end();
  });

  test('poke sends a message that should be sent - status now running, second poke shouldnt send two', async () => {
    await withClient(pool, async client => {
      await client.query(ENABLE_TEST_MODE);

      const oneSecondAgo = new Date();
      oneSecondAgo.setSeconds(oneSecondAgo.getSeconds() - 1);

      const {
        rows: [row]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status, run_at) values ($1, $2, 'waiting to run', $3) returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD, oneSecondAgo]
      );

      await Promise.all([poke(client), poke(client)]);

      // 64-bit `bigint` is returned as a string by node-postgres
      // See: https://stackoverflow.com/a/39176670
      const jobId = parseInt(row.id, 10);
      const { rows: matchingRows } = await client.query(
        `
          select * from assemble_worker.test_queue_messages
          where
            routing_key = $1
            and ((message_body::json)->>'job_id')::bigint = $2
        `,
        [DUMMY_QUEUE, jobId]
      );

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
