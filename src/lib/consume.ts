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
  const log = debug(`consumer:${queueName}`);

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
      await channel.ack(msg);
    } catch (error) {
      await onFailure(payload.job_id, error.toString());
      await channel.ack(msg);
    }
  };
}
