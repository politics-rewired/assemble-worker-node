import { Pool } from 'pg';
import config from './config';
import { makePgFunctions } from './pg-functions';

const DISABLE_TRIGGERS = 'SET session_replication_role = replica';
const ENABLE_TRIGGERS = 'SET session_replication_role = DEFAULT';

const DUMMY_QUEUE = 'dummy-queue';
const DUMMY_PAYLOAD = { value: (Math.random() * 100).toString() };
const TEST_ERROR = 'test-error';

describe('handlers', () => {
  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString
  });

  // const { onSuccess, onFaiure, poke } = makePgFunctions(pool);
  const { onSuccess, onFailure } = makePgFunctions(pool);

  test('complete job deletes a job', async () => {
    const client = await pool.connect();
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
    await client.release();
  });

  test('fail job requeues the job', async () => {
    const client = await pool.connect();
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
    await client.release();
  });

  test('fail job requeues the job', async () => {
    const client = await pool.connect();
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
    await client.release();
  });
});
