import { TaskList } from './lib/interfaces';
import { migrate } from './lib/migrate';
import { makePgFunctions } from './lib/pg-functions';
import { createRunner } from './lib/rabbit-runner';
import { defaultLogger } from './lib/utils';
import { Pool } from 'pg';
import { Logger } from 'winston';

const DEFAULT_POKE_INTERVAL = 10 * 1000;

type AssembleWorkerOptions = {
  databaseConnectionString?: string;
  pgPool?: Pool;
  amqpConnectionString: string;
  taskList: TaskList;
  pokeInterval?: number;
  skipAutoMigrate?: boolean;
  logger?: Logger;
};

export async function run(options: AssembleWorkerOptions) {
  const skipAutoMigrate = options.skipAutoMigrate || false;

  const pool = options.pgPool
    ? options.pgPool
    : new Pool({ connectionString: options.databaseConnectionString });

  const logger = options.logger ? options.logger : defaultLogger;

  if (!skipAutoMigrate) {
    const client = await pool.connect();
    await migrate(client);
    await client.release();
  }

  const {
    onSuccess,
    onFailure,
    onSuccessMany,
    onFailureMany,
    poke,
    registerQueue,
    addJob
  } = makePgFunctions(pool);

  const pokeRunner = setInterval(
    poke,
    options.pokeInterval || DEFAULT_POKE_INTERVAL
  );

  const runner = createRunner(
    options.amqpConnectionString,
    options.taskList,
    logger,
    onSuccess,
    onFailure,
    onSuccessMany,
    onFailureMany,
    registerQueue
  );

  async function stop() {
    clearInterval(pokeRunner);
    await runner.stop;
  }

  return { stop, addJob };
}
