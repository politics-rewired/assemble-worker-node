import { Pool } from 'pg';

export async function makePoke(pool: Pool) {
  return async () => {
    await pool.query('select assemble_worker.poke()');
  };
}
