import { ConfirmChannel, Message } from 'amqplib';
import { Logger } from 'winston';

import { createBucketBatcher } from './bucket-batcher';
import {
  FailureFn,
  FailureManyFn,
  SuccessFn,
  SuccessManyFn,
  Task
} from './interfaces';
import { errToObj } from './utils';

const getPayloadFromMsg = (
  msg: Message,
  queueName: string,
  consumerLogger: Logger
) => {
  const payloadString = msg.content.toString();
  const jobString = payloadString.replace(`${queueName}|`, '');

  try {
    return JSON.parse(jobString);
  } catch (err) {
    consumerLogger.error('Error parsing job payload', {
      ...errToObj(err)
    });
    throw err;
  }
};

export function defineConsumer(
  channel: ConfirmChannel,
  queueName: string,
  job: Task,
  logger: Logger,
  onSuccess: SuccessFn,
  onFailure: FailureFn,
  onSuccessMany: SuccessManyFn,
  onFailureMany: FailureManyFn
) {
  const consumerLogger = logger.child({ queue: queueName });

  const useSingle = !job.many;

  consumerLogger.info(
    `Launching in ${useSingle ? 'SINGLE' : 'MANY'} mode for queue ${queueName}`
  );

  if (useSingle) {
    return async function consumer(msg: Message | null) {
      if (msg === null) {
        return;
      }
      const payload = getPayloadFromMsg(msg, queueName, consumerLogger);

      const suffix = `${job.one.name}:${payload.job_id}`;
      const jobLogger = consumerLogger.child({
        job_id: payload.job_id,
        job_name: job.one.name
      });

      try {
        jobLogger.debug(`Attempting job ${suffix}`);
        await job.one(payload);
        jobLogger.debug(`Executed job ${suffix}`);
        await onSuccess(payload.job_id);
        jobLogger.debug(`Ran onSuccess for job ${suffix}`);
      } catch (error) {
        jobLogger.error(`Job failed ${suffix}: `, {
          ...errToObj(error),
          payload
        });
        await onFailure(payload.job_id, error.toString());
        jobLogger.debug(`Ran onFailure for job ${suffix}`);
      } finally {
        channel.ack(msg);
        jobLogger.debug(`Acked job ${suffix}`);
      }
    };
  }

  const bucketBatcher = createBucketBatcher<Message>({
    bucketSize: job.limit,
    handleBatch: async (messages: Message[]) => {
      const successes = [];
      const failureIds = [];
      const failureErrors = [];

      const payloads = messages.map(msg =>
        getPayloadFromMsg(msg, queueName, consumerLogger)
      );

      consumerLogger.info(`Running many jobs ${job.one.name}`, {
        job_ids: payloads.map(j => j.job_id)
      });

      const results = await job.many(payloads);

      messages.forEach(msg => channel.ack(msg));

      results.forEach((tuple, idx) => {
        const ok = tuple[0];
        const result = tuple[1];
        if (ok) {
          consumerLogger.debug(`Ran onSuccess for job ${payloads[idx].job_id}`);
          successes.push(payloads[idx].job_id);
        } else {
          failureIds.push(payloads[idx].job_id);
          failureErrors.push(result);
          consumerLogger.debug(`Ran onFailure for job ${payloads[idx].job_id}`);
        }
      });

      await Promise.all([
        onSuccessMany(successes),
        onFailureMany(failureIds, failureErrors)
      ]);
    },
    maxFlushInterval: 50
  });

  return async function consumer(msg: Message | null) {
    if (msg === null) {
      return;
    }
    bucketBatcher.push(msg);
  };
}
