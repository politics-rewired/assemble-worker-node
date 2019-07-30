import { Pool } from 'pg';

export async function makeHandlers(pool: Pool) {
  const onSuccess = async (jobId: number) => {
    const client = await pool.connect();
  };

  const onFailure = async (jobId: number) => {
    const client = await pool.connect();
  };

  return { onSuccess, onFailure };
}
