import { Pool } from 'pg';

export function makePgFunctions(pool: Pool) {
  const onSuccess = async (jobId: number) => {
    await pool.query('select assemble_worker.complete_job($1)', [jobId]);
  };

  const onFailure = async (jobId: number, error: string) => {
    await pool.query('select assemble_worker.fail_job($1, $2)', [jobId, error]);
  };

  const poke = async () => {
    await pool.query('select assemble_worker.poke()');
  };

  return { onSuccess, onFailure, poke };
}
