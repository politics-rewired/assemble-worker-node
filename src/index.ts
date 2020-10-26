import { TaskList, DisconnectHandler } from './lib/interfaces';
import { migrate } from './lib/migrate';
import { makePgFunctions } from './lib/pg-functions';
import { createRunner } from './lib/rabbit-runner';
import { defaultLogger } from './lib/utils';
import { withClient } from './utils';
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
  onRabbitDisconnect?: DisconnectHandler;
};

export async function run(options: AssembleWorkerOptions) {
  const skipAutoMigrate = options.skipAutoMigrate || false;

  const pool = options.pgPool
    ? options.pgPool
    : new Pool({ connectionString: options.databaseConnectionString });

  const logger = options.logger ? options.logger : defaultLogger;

  if (!skipAutoMigrate) {
    await withClient(pool, async client => {
      await migrate(client);
    });
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
    registerQueue,
    options.onRabbitDisconnect
  );

  async function stop() {
    clearInterval(pokeRunner);
    await runner.stop;
  }

  return { stop, addJob };
}
