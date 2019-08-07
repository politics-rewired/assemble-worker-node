import { ConfirmChannel, Message } from 'amqplib';
import { SuccessFn, FailureFn, Task } from './interfaces';
import debug from 'debug';

export function defineConsumer(
  channel: ConfirmChannel,
  queueName: string,
  job: Task,
  onSuccess: SuccessFn,
  onFailure: FailureFn
) {
  const log = debug(`assemble-worker:${queueName}`);

  return async function consumer(msg: Message) {
    const payloadString = msg.content.toString();
    log('Got payload string: %s', payloadString);

    const jobString = payloadString.replace(queueName + '|', '');

    let payload;
    try {
      payload = JSON.parse(jobString);
      log('Got %j', payload);
    } catch (ex) {
      payload = jobString;
    }

    log('Running job %j', job);

    try {
      await job(payload);
      log('Job Succeeded');
      await onSuccess(payload.job_id);
      log('Successfully succeeded %s', payload.job_id);
      channel.ack(msg);
    } catch (error) {
      log('Job failed: %j', error);
      await onFailure(payload.job_id, error.toString());
      log('Successfully failed job %s', payload.job_id);
      channel.ack(msg);
    }
  };
}
