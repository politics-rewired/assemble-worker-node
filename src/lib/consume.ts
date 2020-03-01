import { ConfirmChannel, Message } from 'amqplib';
import {
  SuccessFn,
  FailureFn,
  SuccessManyFn,
  FailureManyFn,
  Task
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

  const useSingle = !job.many;

  log('Launching mode for %s: %s', queueName, useSingle ? 'SINGLE' : 'MANY');

  if (useSingle) {
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

  const bucketBatcher = createBucketBatcher<Message>({
    bucketSize: job.limit,
    maxFlushInterval: 50,
    handleBatch: async (messages: Message[]) => {
      const successes = [];
      const failureIds = [];
      const failureErrors = [];

      const payloads = messages.map(msg => getPayloadFromMsg(msg, queueName));

      log(
        'Running many jobs %s: %j',
        job.one.name,
        payloads.map(j => j.job_id)
      );

      const results = await job.many(payloads);

      messages.forEach(msg => channel.ack(msg));

      results.forEach((tuple, idx) => {
        const [ok, result] = tuple;
        if (ok) {
          log('Successfully succeeded %s', payloads[idx].job_id);
          successes.push(payloads[idx].job_id);
        } else {
          failureIds.push(payloads[idx].job_id);
          failureErrors.push(result);
          log('Successfully failed %s', payloads[idx].job_id);
        }
      });

      await Promise.all([
        onSuccessMany(successes),
        onFailureMany(failureIds, failureErrors)
      ]);
    }
  });

  return async function consumer(msg: Message) {
    bucketBatcher.push(msg);
  };
}

const getPayloadFromMsg = (msg: Message, queueName: string) => {
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

  return payload;
};
