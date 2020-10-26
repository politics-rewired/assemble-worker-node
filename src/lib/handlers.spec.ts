import { Pool } from 'pg';
import config from './config';
import { makePgFunctions } from './pg-functions';
import { withClient } from '../utils';

const DISABLE_TRIGGERS = 'SET session_replication_role = replica';
const ENABLE_TRIGGERS = 'SET session_replication_role = DEFAULT';

const DUMMY_QUEUE = 'dummy-queue';
const DUMMY_PAYLOAD = { value: (Math.random() * 100).toString() };
const TEST_ERROR = 'test-error';

describe('handlers', () => {
  let pool: Pool;

  beforeAll = async () => {
    pool = new Pool({
      connectionString: config.testDatabaseConnectionString
    });
  };

  afterAll = async () => {
    await pool.end();
  };

  // const { onSuccess, onFaiure, poke } = makePgFunctions(pool);
  const {
    onSuccess,
    onFailure,
    onSuccessMany,
    onFailureMany
  } = makePgFunctions(pool);

  test('complete job deletes a job', async () => {
    await withClient(pool, async client => {
      await client.query(DISABLE_TRIGGERS);

      const {
        rows: [row]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status) values ($1, $2, 'running') returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD]
      );

      await onSuccess(row.id);

      const { rows: matchingRows } = await client.query(
        'select * from assemble_worker.jobs where id = $1',
        [row.id]
      );

      expect(Array.isArray(matchingRows)).toBe(true);
      expect(matchingRows).toHaveLength(0);

      await client.query(ENABLE_TRIGGERS);
    });
  });

  test('complete many job deletes a job', async () => {
    await withClient(pool, async client => {
      await client.query(DISABLE_TRIGGERS);

      const {
        rows: [jobOne]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status) values ($1, $2, 'running') returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD]
      );

      const {
        rows: [jobTwo]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status) values ($1, $2, 'running') returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD]
      );

      await onSuccessMany([jobOne.id, jobTwo.id]);

      const { rows: matchingRows } = await client.query(
        'select * from assemble_worker.jobs where id = ANY($1)',
        [[jobOne.id, jobTwo.id]]
      );

      expect(Array.isArray(matchingRows)).toBe(true);
      expect(matchingRows).toHaveLength(0);

      await client.query(ENABLE_TRIGGERS);
    });
  });

  test('fail job requeues the job', async () => {
    await withClient(pool, async client => {
      await client.query(DISABLE_TRIGGERS);

      const {
        rows: [row]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status) values ($1, $2, 'running') returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD]
      );

      await onFailure(row.id, TEST_ERROR);

      const { rows: matchingRows } = await client.query(
        'select * from assemble_worker.jobs where id = $1',
        [row.id]
      );

      expect(Array.isArray(matchingRows)).toBe(true);
      expect(matchingRows).toHaveLength(1);

      const failedJob = matchingRows[0];
      expect(failedJob).toHaveProperty('ran_at');
      expect(failedJob.ran_at).toHaveLength(1);
      expect(failedJob).toHaveProperty('errors');
      expect(failedJob.errors).toHaveLength(1);
      expect(failedJob.errors[0]).toBe(TEST_ERROR);
      expect(failedJob).toHaveProperty('attempts');
      expect(failedJob.attempts).toBe(1);
      expect(failedJob).toHaveProperty('run_at');

      await client.query(ENABLE_TRIGGERS);
    });
  });

  test('fail many job requeues the jobs', async () => {
    await withClient(pool, async client => {
      await client.query(DISABLE_TRIGGERS);

      const {
        rows: [jobOne]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status) values ($1, $2, 'running') returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD]
      );

      const {
        rows: [jobTwo]
      } = await client.query(
        `insert into assemble_worker.jobs (queue_name, payload, status) values ($1, $2, 'running') returning id`,
        [DUMMY_QUEUE, DUMMY_PAYLOAD]
      );

      await onFailureMany([jobOne.id, jobTwo.id], [TEST_ERROR, TEST_ERROR]);

      const { rows: matchingRows } = await client.query(
        'select * from assemble_worker.jobs where id = ANY($1)',
        [[jobOne.id, jobTwo.id]]
      );

      expect(Array.isArray(matchingRows)).toBe(true);
      expect(matchingRows).toHaveLength(2);

      const failedJobOne = matchingRows[0];
      expect(failedJobOne).toHaveProperty('ran_at');
      expect(failedJobOne.ran_at).toHaveLength(1);
      expect(failedJobOne).toHaveProperty('errors');
      expect(failedJobOne.errors).toHaveLength(1);
      expect(failedJobOne.errors[0]).toBe(TEST_ERROR);
      expect(failedJobOne).toHaveProperty('attempts');
      expect(failedJobOne.attempts).toBe(1);
      expect(failedJobOne).toHaveProperty('run_at');

      const failedJobTwo = matchingRows[1];
      expect(failedJobTwo).toHaveProperty('ran_at');
      expect(failedJobTwo.ran_at).toHaveLength(1);
      expect(failedJobTwo).toHaveProperty('errors');
      expect(failedJobTwo.errors).toHaveLength(1);
      expect(failedJobTwo.errors[0]).toBe(TEST_ERROR);
      expect(failedJobTwo).toHaveProperty('attempts');
      expect(failedJobTwo.attempts).toBe(1);
      expect(failedJobTwo).toHaveProperty('run_at');

      await client.query(ENABLE_TRIGGERS);
    });
  });
});
