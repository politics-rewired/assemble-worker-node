import { Pool } from 'pg';
import config from './config';
import { makePgFunctions } from './pg-functions';
import { createRunner } from './rabbit-runner';

const SLEEP_TIME = 500;

async function sleep(n: number) {
  return new Promise((resolve, _reject) => setTimeout(resolve, n));
}

const DUMMY_PAYLOAD = () => ({
  value: (Math.random() * 100).toString()
});

const DUMMY_SUCCEEDING_JOB = async () => {
  return null;
};

const DUMMY_FAILING_JOB = async () => {
  throw new Error("I'm a failure");
};

describe('integration tests', () => {
  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString
  });

  const { addJob, poke, onFailure, registerQueue } = makePgFunctions(pool);

  test('add_job runs job successfully', async () => {
    const JOB_NAME = 'add-job-runs-job';
    const onSuccess = jest.fn();

    const runner = await createRunner(
      config.amqpConnectionString,
      { [JOB_NAME]: DUMMY_SUCCEEDING_JOB },
      onSuccess,
      async function() {},
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
      { [JOB_NAME]: DUMMY_SUCCEEDING_JOB },
      onSuccess,
      async function() {},
      registerQueue
    );

    const oneSecondAgo = new Date();
    oneSecondAgo.setSeconds(oneSecondAgo.getSeconds() - 1);

    await addJob({
      queueName: JOB_NAME,
      payload: DUMMY_PAYLOAD(),
      runAt: oneSecondAgo
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
      { [JOB_NAME]: DUMMY_FAILING_JOB },
      async function() {},
      onFailure,
      registerQueue
    );

    const payload = DUMMY_PAYLOAD();
    await addJob({ queueName: JOB_NAME, payload: payload });

    await sleep(SLEEP_TIME);

    const { rows: foundFailedJobs } = await pool.query(
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
});
