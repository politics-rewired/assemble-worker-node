import { Pool } from 'pg';
import config from './config';
import { migrate } from './migrate';
import { withClient } from '../utils';

const pool = new Pool({
  connectionString: config.migrationTestDatabaseConnectionString
});

describe('migrate', () => {
  test('migration runs', async () => {
    await withClient(pool, async client => {
      await migrate(client);

      const jobs = await client.query('select * from assemble_worker.jobs;');
      expect(Array.isArray(jobs.rows)).toBe(true);
    });
  });

  test('migration runs a second time with no affect', async () => {
    await withClient(pool, async client => {
      await migrate(client);

      const jobs = await client.query('select * from assemble_worker.jobs;');
      expect(Array.isArray(jobs.rows)).toBe(true);
    });
  });
});
