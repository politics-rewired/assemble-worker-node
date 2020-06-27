import { Pool, PoolClient, QueryResult } from 'pg';

export interface JobParams {
  queueName: string;
  payload: any;
  runAt?: Date;
}

export type OnSuccess = <T>(
  jobId: number,
  client?: PoolClient
) => Promise<QueryResult<T>>;
export type OnSuccessMany = <T>(
  jobIds: number[],
  client?: PoolClient
) => Promise<QueryResult<T>>;
export type OnFailure = <T>(
  jobId: number,
  error: string,
  client?: PoolClient
) => Promise<QueryResult<T>>;
export type OnFailureMany = <T>(
  jobIds: number[],
  errors: string[],
  client?: PoolClient
) => Promise<QueryResult<T>>;
export type Poke = <T>(client?: PoolClient) => Promise<QueryResult<T>>;
export type AddJob = <T>(
  job: JobParams,
  client?: PoolClient
) => Promise<QueryResult<T>>;
export type RegisterQueue = <T>(
  queueName: string,
  client?: PoolClient
) => Promise<QueryResult<T>>;

export interface JobParams {
  queueName: string;
  payload: any;
  runAt?: Date;
}

/**
 * Wraps onSuccess, onFailure, and poke with the pool
 * @param pool a postgres pool
 */
export function makePgFunctions(pool: Pool) {
  /**
   * Runs assemble_worker.complete_job()
   * @param jobId jobId to succeed
   * @param client optional postgres client if session matters
   */
  const onSuccess = async (jobId: number, client?: PoolClient) => {
    return (client || pool).query('select assemble_worker.complete_job($1)', [
      jobId
    ]);
  };

  /**
   * Runs assemble_worker.complete_many_jobs()
   * @param jobIds array of jobIds to succeed
   * @param client optional postgres client if session matters
   */
  const onSuccessMany = async (jobIds: number[], client?: PoolClient) => {
    return (client || pool).query(
      'select assemble_worker.complete_many_jobs($1)',
      [jobIds]
    );
  };

  /**
   * Runs assemble_worker.fail_job()
   * @param jobId jobId to fail
   * @param error indicated error message
   * @param client optional postgres client if session matters
   */
  const onFailure = async (
    jobId: number,
    error: string,
    client?: PoolClient
  ) => {
    return (client || pool).query('select assemble_worker.fail_job($1, $2)', [
      jobId,
      error
    ]);
  };

  /**
   * Runs assemble_worker.fail_many_jobs()
   * @param jobIds array of jobIds to fail
   * @param errors array of error messages
   * @param client optional postgres client if session matters
   */
  const onFailureMany = async (
    jobIds: number[],
    errors: string[],
    client?: PoolClient
  ) => {
    return (client || pool).query(
      'select assemble_worker.fail_many_jobs($1, $2)',
      [jobIds, errors]
    );
  };

  /**
   * Runs assemble_worker.poke()
   * @param client optional postgres client if the session matters
   */
  const poke = async (client?: PoolClient) => {
    return (client || pool).query('select assemble_worker.poke()');
  };

  /**
   * Runs assemble_worker.add_job()
   * @param job job to add
   * @param client optional postgres client if the session matters
   */
  const addJob = async (job: JobParams, client?: PoolClient) => {
    return (client || pool).query(
      'select assemble_worker.add_job($1, $2, $3)',
      [job.queueName, job.payload, job.runAt]
    );
  };

  /**
   * Runs assemble_worker.register_queue()
   * @param queueName queueName to register as created
   * @param client optional postgres client if the session matters
   */
  const registerQueue = async (queueName: string, client?: PoolClient) => {
    return (client || pool).query('select assemble_worker.register_queue($1)', [
      queueName
    ]);
  };

  return {
    addJob,
    onFailure,
    onFailureMany,
    onSuccess,
    onSuccessMany,
    poke,
    registerQueue
  };
}
