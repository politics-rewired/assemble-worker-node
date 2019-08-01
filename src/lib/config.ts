type AssembleWorkerGlobalConfig = {
  testDatabaseConnectionString: string;
  migrationTestDatabaseConnectionString: string;
};

const config: AssembleWorkerGlobalConfig = {
  testDatabaseConnectionString:
    'postgres://localhost:5432/assemble_worker_test',
  migrationTestDatabaseConnectionString:
    'postgres://localhost:5432/assemble_worker_migration_test'
};

export default config;
