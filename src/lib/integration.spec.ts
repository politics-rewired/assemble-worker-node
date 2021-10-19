// tslint:disable:no-empty

import { Pool } from 'pg';

import config from './config';
import {
  AddJob,
  makePgFunctions,
  OnFailure,
  Poke,
  RegisterQueue,
} from './pg-functions';
import { createRunner } from './rabbit-runner';
import { defaultLogger } from './utils';

const SLEEP_TIME = 500;

async function sleep(n: number) {
  return new Promise((resolve, _reject) => setTimeout(resolve, n));
}

const DUMMY_PAYLOAD = () => ({
  value: (Math.random() * 100).toString(),
});

const DUMMY_SUCCEEDING_JOB = async () => {
  return null;
};

const DUMMY_SUCCEEDING_MANY_JOB = async (arr) => {
  return arr.slice();
};

const DUMMY_FAILING_JOB = async () => {
  throw new Error("I'm a failure");
};

describe('integration tests', () => {
  let pool: Pool;
  let addJob: AddJob;
  let poke: Poke;
  let onFailure: OnFailure;
  let registerQueue: RegisterQueue;

  beforeAll(() => {
    pool = new Pool({
      connectionString: config.testDatabaseConnectionString,
    });
    ({ addJob, poke, onFailure, registerQueue } = makePgFunctions(pool));
  });

  afterAll(async () => {
    await pool.end();
  });

  test('add_job runs job successfully', async () => {
    const JOB_NAME = 'add-job-runs-job';
    const onSuccess = jest.fn();

    const runner = await createRunner(
      config.amqpConnectionString,
      { [JOB_NAME]: { concurrency: 1, task: { one: DUMMY_SUCCEEDING_JOB } } },
      defaultLogger,
      onSuccess,
      async () => {},
      async () => {},
      async () => {},
      registerQueue
    );

    await addJob({ queueName: JOB_NAME, payload: DUMMY_PAYLOAD() });
    await sleep(SLEEP_TIME);

    await runner.stop();
    expect(onSuccess).toHaveBeenCalled();
  });

  test('add_job with run_at runs only after poke', async () => {
    const JOB_NAME = 'schedule-job-runs-after-poke';
    const onSuccess = jest.fn();

    const runner = await createRunner(
      config.amqpConnectionString,
      { [JOB_NAME]: { concurrency: 1, task: { one: DUMMY_SUCCEEDING_JOB } } },
      defaultLogger,
      onSuccess,
      async () => {},
      async () => {},
      async () => {},
      registerQueue
    );

    const oneSecondAgo = new Date();
    oneSecondAgo.setSeconds(oneSecondAgo.getSeconds() - 1);

    await addJob({
      payload: DUMMY_PAYLOAD(),
      queueName: JOB_NAME,
      runAt: oneSecondAgo,
    });

    await sleep(SLEEP_TIME);

    expect(onSuccess).toHaveBeenCalledTimes(0);

    await poke();

    await sleep(SLEEP_TIME);

    await runner.stop();
    expect(onSuccess).toHaveBeenCalled();
  });

  test('add_job -> job failure ->  failed job exists', async () => {
    const JOB_NAME = 'job-failure-causes-failed-job';

    const runner = await createRunner(
      config.amqpConnectionString,
      { [JOB_NAME]: { concurrency: 1, task: { one: DUMMY_FAILING_JOB } } },
      defaultLogger,
      async () => {},
      onFailure,
      async () => {},
      async () => {},
      registerQueue
    );

    const payload = DUMMY_PAYLOAD();
    await addJob({ queueName: JOB_NAME, payload });

    await sleep(SLEEP_TIME);

    const {
      rows: foundFailedJobs,
    } = await pool.query(
      `select * from assemble_worker.jobs where status = 'waiting to retry'::assemble_worker.job_status and payload->>'value' = $1`,
      [payload.value]
    );

    expect(foundFailedJobs).toHaveLength(1);

    const failedJob = foundFailedJobs[0];

    expect(failedJob.errors[0]).toBe("Error: I'm a failure");
    expect(failedJob.ran_at).toHaveLength(1);
    expect(failedJob.status).toBe('waiting to retry');

    await runner.stop();
  });

  test('add_job runs batch successfully', async () => {
    const JOB_NAME = 'add-job-runs-job';
    const onSuccess = jest.fn();
    const onSuccessMany = jest.fn();

    const runner = await createRunner(
      config.amqpConnectionString,
      {
        [JOB_NAME]: {
          concurrency: 1,
          task: {
            limit: 5,
            many: DUMMY_SUCCEEDING_MANY_JOB,
            one: DUMMY_SUCCEEDING_JOB,
          },
        },
      },
      defaultLogger,
      onSuccess,
      async () => {},
      async () => {},
      onSuccessMany,
      registerQueue
    );

    await addJob({ queueName: JOB_NAME, payload: DUMMY_PAYLOAD() });
    await addJob({ queueName: JOB_NAME, payload: DUMMY_PAYLOAD() });
    await sleep(SLEEP_TIME);

    await runner.stop();
    expect(onSuccess).toHaveBeenCalledTimes(0);

    // TODO: make sure this has been called the correct number of times when we pick back up work
    // on batched job processing
    expect(onSuccessMany).toHaveBeenCalled();
  });
});
