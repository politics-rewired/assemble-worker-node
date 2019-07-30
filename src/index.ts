import { TaskList } from './lib/interfaces';
import { migrate } from './lib/migrate';
import { makeHandlers } from './lib/handlers';
import { createRunner } from './lib/rabbit-runner';
import { Pool } from 'pg';

type AssembleWorkerOptions = {
  databaseConnectionString?: string;
  pgPool?: Pool;
  amqpConnectionString: string;
  pokeInterval: number;
  taskList: TaskList;
};

export async function run(options: AssembleWorkerOptions) {
  const pool = options.pgPool
    ? options.pgPool
    : new Pool({ connectionString: options.databaseConnectionString });

  const client = await pool.connect();

  await migrate(client);

  const { onSuccess, onFailure } = await makeHandlers(pool);

  const runner = createRunner(
    options.amqpConnectionString,
    options.taskList,
    onSuccess,
    onFailure
  );

  return { stop: runner.stop };
}
