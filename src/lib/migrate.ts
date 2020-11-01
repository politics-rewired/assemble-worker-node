import { readdirSync, readFileSync } from 'fs';
import { PoolClient } from 'pg';

import { defaultLogger } from './utils';

const logger = defaultLogger.child({ source: 'assemble-worker:migrate' });

export async function installSchema(client: PoolClient) {
  await client.query(`
    create extension if not exists pgcrypto with schema public;
    create extension if not exists "uuid-ossp" with schema public;
    create schema if not exists assemble_worker;
    create table if not exists assemble_worker.migrations(
      id int primary key,
      ts timestamptz default now() not null
    );
  `);
}

async function runMigration(
  client: PoolClient,
  migrationFile: string,
  migrationNumber: number
) {
  const text = await readFileSync(
    `${__dirname}/../sql/${migrationFile}`,
    'utf8'
  );
  await client.query({
    text
  });
  await client.query({
    text: `insert into assemble_worker.migrations (id) values ($1)`,
    values: [migrationNumber]
  });
}

export async function migrate(client: PoolClient) {
  let latestMigration: number | null = null;
  try {
    const {
      rows: [row]
    } = await client.query(
      'select id from assemble_worker.migrations order by id desc limit 1;'
    );
    if (row) {
      latestMigration = row.id;
    }
  } catch (e) {
    if (e.code === '42P01') {
      await installSchema(client);
    } else {
      throw e;
    }
  }

  const migrationFiles = (await readdirSync(`${__dirname}/../sql`))
    .filter(f => f.match(/^[0-9]{6}\.sql$/))
    .sort();

  logger.debug('Found migrations %j', migrationFiles);

  for (const migrationFile of migrationFiles) {
    const migrationNumber = parseInt(migrationFile.substr(0, 6), 10);
    if (latestMigration == null || migrationNumber > latestMigration) {
      logger.debug('Running migration %d', migrationNumber);
      await runMigration(client, migrationFile, migrationNumber);
    }
  }

  logger.debug('Successfully ran migrations');
}

export async function reset(client: PoolClient) {
  await client.query('drop schema if exists assemble_worker cascade;');
}
