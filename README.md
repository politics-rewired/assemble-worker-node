# assemble-worker

## Introduction

This is a Node.js/PostgreSQL/RabbitMQ worker heavily influence by [@benjie](https://github.com/benjie)'s [graphile/worker](#).
The goal is to have a similar API to `graphile/worker`with a higher throughput enabled by the introduction of RabbitMQ.

**Why Graphile Worker?**

I like Graphile Worker because I can queue jobs via SQL triggers, which means:

- I get to interact with external APIs asynchronously when using something like [Postgraphile](https://github.com/graphile/postgraphile)
- My job queuing runs within PostgreSQL transactions, which means if a queue a job in a transaction that is rolled back, the transaction is not run

However, Graphile Worker runs at about 700 jobs/sec, which is not enough for some use cases.
So, just like Graphile Worker, we want to:

- Store job state in PostgreSQL
- Have PostgreSQL manage failure behavior, with exponential backoff retry
- Queue jobs via a PostgreSQL function
- Define jobs as asynchronous NodeJS functions
- Have it all work seamlessly™

But we want higher throughput!

**Why RabbitMQ?**
The bottleneck of the Graphile Worker is the `SELECT FOR UPDATE .. SKIP LOCKED`functionality, which is a native PostgreSQL feature to ensure that two simultaneous queries selecting from the same table will not select each other's rows. This is necessary to prevent two concurrently running workers, both fetching jobs, from selecting the same job, and running one job twice.

Although Graphile Worker uses `LISTEN/NOTIFY` to notify workers about new jobs for low job queue -> job start latency, PostgreSQL `NOTIFY` sends a message to all clients listening on a channel – which makes it unsuitable as a method for delivering jobs to be run. Instead, it’s only suitable for notifying workers that they should query for new jobs.

Fortunately, RabbitMQ uses something called Round Robin dispatch, which ensures that each message is only sent to one consumer at a time – the message may be redelivered to other consumers if that consumer fails to acknowledge it, but it will never be delivered to two consumers at the same time.

By using SubZero’s high throughput [pg-amqp-bridge](https://github.com/subzerocloud/pg-amqp-bridge/), we’re able to send messages to RabbitMQ from Postgres at a higher rate, and scale our NodeJS workers around them to achieve a much higher throughput!

## Usage

```
yarn install assemble-worker
```

```typescript
import { run } from 'assemble-worker';

async function main() {
  const worker = await run({
    databaseConnectionString: 'postgres://localhost:5432/my_db',
    // optionally include a pgPool parameter to re-use connections - will
    // override databaseConnectionString if present

    amqpConnectionString: 'amqp://localhost',

    // When jobs aren't queued to be immediately run, PostgreSQL must
    // be 'poked' in order to check if there are jobs that should be run
    // and send them to RabbitMQ
    pokeInterval: 10000, // the default

    taskList: {
      'simple-task': {
        // Concurrency is the number of consumers to spawn on this node instance
        // for this task
        // There is currently no way to limit the rate of task execution
        // across workers – that would require implementing token buckets
        // or maybe using Redis
        concurrency: 1,

        // If you function throws an error, it will be retried
        // Any return value is ignored
        task: async function(payload) {
          // do some work
        }
      }
    }
  });

  // In additon to adding jobs via SQL, you can do
  await worker.addJob({
    queueName: 'simple-task',
    payload: { someValue: 4 }
  });

  // Now your working is running and can be stopped via:
  await worker.stop();
}
```

Via SQL, queue a job by running:

```sql
SELECT assemble_worker.add_job('simple-task', '{"someValue": 4}'::json);
```

Or, if inside of a PostgreSQL function:

```sql
PERFORM assemble_worker.add_job('simple-task', '{"someValue": 4}'::json);
```

## Installation

Assemble Worker will run and manage its own migrations on the database given by `databaseConnectionString` , and manage its own queue assertions in RabbitMQ for queue’s with keys in `taskList`.

Follow the instructions on [pg-amqp-bridge’s Github](https://github.com/subzerocloud/pg-amqp-bridge/) for deploying it – I’ll post a sample Kubernetes configuration here when I get a chance.
