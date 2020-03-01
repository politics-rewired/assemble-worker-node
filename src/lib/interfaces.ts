import { PoolClient } from 'pg';

export type SuccessFn = (jobId: number, client?: PoolClient) => Promise<any>;

export type FailureFn = (
  jobId: number,
  error: string,
  client?: PoolClient
) => Promise<any>;

export type SuccessManyFn = (
  jobIds: number[],
  client?: PoolClient
) => Promise<any>;

export type FailureManyFn = (
  jobIds: number[],
  errors: string[],
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

type ManyResultTuple = [boolean, any];

export type Task = {
  one: (payload: JobPayload) => Promise<any>;
  many?: (payloads: JobPayload[]) => Promise<ManyResultTuple[]>;
  limit?: number;
};

export type TaskList = {
  [key: string]: {
    concurrency: number;
    task: Task;
  };
};
