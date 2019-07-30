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
    const paylodString = msg.content.toString();
    const payload = JSON.parse(paylodString);
    log('Got %j', payload);

    log('Running job %j', job);

    try {
      await job(payload);
      log('Job Succeeded');
      await channel.ack(msg);
      await onSuccess(payload.id);
    } catch {
      const shouldRequeue = true;
      await channel.reject(msg, shouldRequeue);
      await onFailure(payload.id);
    }
  };
}
