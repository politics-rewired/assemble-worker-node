import { Pool, PoolClient } from 'pg';

export type WithClientHandler<T> = (client: PoolClient) => Promise<T>;

export const withClient = async <T>(
  pool: Pool,
  handler: WithClientHandler<T>
) => {
  const client = await pool.connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
};
