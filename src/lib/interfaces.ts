export type SuccessFn = (jobId: number) => Promise<void>;
export type FailureFn = (jobId: number) => Promise<void>;

export interface JobPayload {
  id: number;
}

export type Task = (payload: JobPayload) => Promise<void>;

export type TaskList = {
  [key: string]: Task;
};
