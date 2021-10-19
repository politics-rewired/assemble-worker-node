import { Pool } from 'pg';
import { withClient } from '../utils';
import config from './config';
import { migrate } from './migrate';

describe('migrate', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: config.testDatabaseConnectionString,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  test('migration runs', async () => {
    await withClient(pool, async (client) => {
      await migrate(client);

      const jobs = await client.query('select * from assemble_worker.jobs;');
      expect(Array.isArray(jobs.rows)).toBe(true);
    });
  });

  test('migration runs a second time with no affect', async () => {
    await withClient(pool, async (client) => {
      await migrate(client);

      const jobs = await client.query('select * from assemble_worker.jobs;');
      expect(Array.isArray(jobs.rows)).toBe(true);
    });
  });
});
