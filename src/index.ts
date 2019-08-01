import { TaskList } from './lib/interfaces';
import { migrate } from './lib/migrate';
import { makeHandlers } from './lib/handlers';
import { makePoke } from './lib/poke';
import { createRunner } from './lib/rabbit-runner';
import { Pool } from 'pg';

const DEFAULT_POKE_INTERVAL = 10 * 1000;

type AssembleWorkerOptions = {
  databaseConnectionString?: string;
  pgPool?: Pool;
  amqpConnectionString: string;
  taskList: TaskList;
  pokeInterval?: number;
};

export async function run(options: AssembleWorkerOptions) {
  const pool = options.pgPool
    ? options.pgPool
    : new Pool({ connectionString: options.databaseConnectionString });

  const client = await pool.connect();

  await migrate(client);

  const { onSuccess, onFailure } = await makeHandlers(pool);

  const poke = await makePoke(pool);

  const pokeRunner = setInterval(
    poke,
    options.pokeInterval || DEFAULT_POKE_INTERVAL
  );

  const runner = createRunner(
    options.amqpConnectionString,
    options.taskList,
    onSuccess,
    onFailure
  );

  async function stop() {
    clearInterval(pokeRunner);
    await runner.stop;
  }

  return { stop };
}
