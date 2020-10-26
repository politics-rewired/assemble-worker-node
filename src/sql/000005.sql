BEGIN;

drop function assemble_worker.complete_job(bigint);

create function assemble_worker.complete_job(job_id bigint) returns void as $$
  delete from assemble_worker.jobs where id = job_id;
$$ language sql;

COMMIT;
