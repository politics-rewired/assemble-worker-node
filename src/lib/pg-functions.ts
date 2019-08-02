import { Pool, PoolClient } from 'pg';

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
    return await (client || pool).query(
      'select assemble_worker.complete_job($1)',
      [jobId]
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
    return await (client || pool).query(
      'select assemble_worker.fail_job($1, $2)',
      [jobId, error]
    );
  };

  /**
   * Runs assemble_worker.poke()
   * @param client optional postgres client if the session matters
   */
  const poke = async (client?: PoolClient) => {
    return await (client || pool).query('select assemble_worker.poke()');
  };

  type JobParams = {
    queueName: string;
    payload: any;
    runAt?: Date;
  };

  /**
   * Runs assemble_worker.add_job()
   * @param job job to add
   * @param client optional postgres client if the session matters
   */
  const addJob = async (job: JobParams, client?: PoolClient) => {
    return await (client || pool).query(
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
    return await (client || pool).query(
      'select assemble_worker.register_queue($1)',
      [queueName]
    );
  };

  return { onSuccess, onFailure, poke, addJob, registerQueue };
}
