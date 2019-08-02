import { PoolClient } from 'pg';

export type SuccessFn = (jobId: number, client?: PoolClient) => Promise<any>;

export type FailureFn = (
  jobId: number,
  error: string,
  client?: PoolClient
) => Promise<any>;

export type CreateQueueFn = (
  queueName: string,
  client?: PoolClient
) => Promise<any>;

export interface JobPayload {
  id: number;
  [key: string]: any;
}

export type Task = (payload: JobPayload) => Promise<any>;

export type TaskList = {
  [key: string]: {
    concurrency: number;
    task: Task;
  };
};
