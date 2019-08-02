import { PoolClient, Pool } from 'pg';

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
}

export type Task = (payload: JobPayload) => Promise<any>;

export type TaskList = {
  [key: string]: Task;
};
