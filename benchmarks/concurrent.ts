import { run } from '../src/index';
import config from '../src/lib/config';
import { Pool } from 'pg';

const NUM_JOBS = 20000;

async function main() {
  const pool = new Pool({
    connectionString: config.testDatabaseConnectionString
  });

  console.log('Initializing worker...');

  function finishTest() {
    console.timeEnd('simple benchmark – before insert');
    console.timeEnd('simple benchmark – after insert');

    // Must wait before exiting, otherwise we won't ack final job
    setTimeout(() => {
      process.exit();
    }, 1000);
  }

  const worker = run({
    pgPool: pool,
    amqpConnectionString: config.amqpConnectionString,
    taskList: {
      'simple-task': {
        concurrency: 1000,
        task: async function(payload) {
          const n = payload.job_n;
          if (n == NUM_JOBS) {
            return finishTest();
          }
        }
      }
    }
  });

  console.time('simple benchmark – before insert');
  console.time('simple benchmark – after insert');
  await pool.query(
    `with jobs as (
      select json_build_object('job_n', n) as payload
      from generate_series(1, $1) as n
    )
    select assemble_worker.add_job('simple-task', jobs.payload)
    from jobs`,
    [NUM_JOBS]
  );
}

main()
  .then(console.log)
  .catch(console.error);
