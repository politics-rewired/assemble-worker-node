import { Pool } from 'pg';
import { migrate } from './migrate';

const pool = new Pool({
  connectionString: 'postgres://localhost:5432/assemble_worker_test'
});

describe('migrate', () => {
  test('migration runs', async () => {
    const client = await pool.connect();
    await migrate(client);

    const jobs = await client.query('select * from assemble_worker.jobs;');
    expect(Array.isArray(jobs.rows)).toBe(true);
  });

  test('migration runs a second time with no affect', async () => {
    const client = await pool.connect();
    await migrate(client);

    const jobs = await client.query('select * from assemble_worker.jobs;');
    expect(Array.isArray(jobs.rows)).toBe(true);
  });
});
