type AssembleWorkerGlobalConfig = {
  testDatabaseConnectionString: string;
  migrationTestDatabaseConnectionString: string;
  amqpConnectionString: string;
};

const config: AssembleWorkerGlobalConfig = {
  testDatabaseConnectionString:
    'postgres://localhost:5432/assemble_worker_test',
  migrationTestDatabaseConnectionString:
    'postgres://localhost:5432/assemble_worker_migration_test',
  amqpConnectionString: 'amqp://localhost'
};

export default config;
