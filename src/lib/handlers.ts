import { Pool } from 'pg';

export async function makeHandlers(pool: Pool) {
  const onSuccess = async (jobId: number) => {
    await pool.query('select assemble_worker.complete_job($1)', [jobId]);
  };

  const onFailure = async (jobId: number) => {
    await pool.query('select assemble_worker.fail_job($1)', [jobId]);
  };

  return { onSuccess, onFailure };
}
