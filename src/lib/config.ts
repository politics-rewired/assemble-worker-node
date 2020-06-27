import envalid from 'envalid';
import { url } from 'envalid';

type AssembleWorkerGlobalConfig = {
  testDatabaseConnectionString: string;
  migrationTestDatabaseConnectionString: string;
  amqpConnectionString: string;
};

const env = envalid.cleanEnv(process.env, {
  TEST_AMQP_URI: url({ default: undefined }),
  TEST_DATABASE_URL: url({ default: undefined }),
  TEST_MIGRATION_DATABASE_URL: url({ default: undefined })
});

const config: AssembleWorkerGlobalConfig = {
  testDatabaseConnectionString: env.isTest
    ? env.TEST_DATABASE_URL
    : 'postgres://localhost:5432/assemble_worker_test',
  migrationTestDatabaseConnectionString: env.isTest
    ? env.TEST_MIGRATION_DATABASE_URL
    : 'postgres://localhost:5432/assemble_worker_migration_test',
  amqpConnectionString: env.isTest ? env.TEST_AMQP_URI : 'amqp://localhost'
};

export default config;
