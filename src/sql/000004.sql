BEGIN;

create or replace procedure assemble_worker.renotify_unacked_jobs_queued_for_more_than_30_seconds()
language plpgsql
as $$
declare
  v_job record;
begin
  perform assemble_worker.notify_job(id)
  from assemble_worker.jobs
  where last_acked_at is null
    and status = 'running'
    and (
      ( run_at is null
        and created_at > now() - interval '6 minutes'
        and created_at < now() - interval '30 seconds')
      or
      ( run_at < now() - interval '30 seconds'
        and run_at > now() - interval '6 minutes')
    );
end;
$$;

COMMIT;
