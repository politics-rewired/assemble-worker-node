import { ConfirmChannel, Message } from 'amqplib';
import {
  SuccessFn,
  FailureFn,
  SuccessManyFn,
  FailureManyFn,
  Task,
  JobPayload
} from './interfaces';
import debug from 'debug';
import { createBucketBatcher } from './bucket-batcher';

export function defineConsumer(
  channel: ConfirmChannel,
  queueName: string,
  job: Task,
  onSuccess: SuccessFn,
  onFailure: FailureFn,
  onSuccessMany: SuccessManyFn,
  onFailureMany: FailureManyFn
) {
  const log = debug(`assemble-worker:${queueName}`);

  if (!job.many) {
    return async function consumer(msg: Message) {
      const payloadString = msg.content.toString();
      // log('Got payload string: %s', payloadString);

      const jobString = payloadString.replace(queueName + '|', '');

      let payload;
      try {
        payload = JSON.parse(jobString);
        // log('Got %j', payload);
      } catch (ex) {
        payload = jobString;
      }

      try {
        log('Running job %s: %s', job.one.name, payload.job_id);
        await job.one(payload);
        log('Job Succeeded');
        await onSuccess(payload.job_id);
        log('Successfully succeeded %s', payload.job_id);
      } catch (error) {
        log('Job failed: %j', error);
        await onFailure(payload.job_id, error.toString());
        log('Successfully failed job %s', payload.job_id);
      } finally {
        channel.ack(msg);
        log('Successfully acked %s', payload.job_id);
      }
    };
  }

  const bucketBatcher = createBucketBatcher<JobPayload>({
    bucketSize: job.limit,
    maxFlushInterval: 50,
    handleBatch: async (payloads: JobPayload[]) => {
      const successes = [];
      const failureIds = [];
      const failureErrors = [];

      const results = await job.many(payloads);

      results.forEach((tuple, idx) => {
        const [ok, result] = tuple;
        if (ok) {
          successes.push(payloads[idx].id);
        } else {
          failureIds.push(payloads[idx].id);
          failureErrors.push(result);
        }
      });

      await Promise.all([
        onSuccessMany(successes),
        onFailureMany(failureIds, failureErrors)
      ]);
    }
  });

  return async function consumer(msg: Message) {
    const payloadString = msg.content.toString();
    // log('Got payload string: %s', payloadString);

    const jobString = payloadString.replace(queueName + '|', '');

    let payload;
    try {
      payload = JSON.parse(jobString);
      // log('Got %j', payload);
    } catch (ex) {
      payload = jobString;
    }

    bucketBatcher.push(payload);
  };
}
