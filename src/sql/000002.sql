BEGIN;

alter table assemble_worker.jobs add column last_acked_at timestamp;


-- I was unsuccessful, record the failure – choose a new run_at
-- This fail_job differs from v1 fail_job because it also unsets last_acked_at
create or replace function assemble_worker.fail_job(job_id bigint, error_message text) returns assemble_worker.jobs as $$
declare
  v_row assemble_worker.jobs;
  v_run_at timestamp;
begin
  select *
  from assemble_worker.jobs
  where id = job_id
  into v_row;

  if v_row.attempts < v_row.max_attempts  then
    update assemble_worker.jobs
    set
      errors = array_append(errors, error_message),
      ran_at = array_append(ran_at, now()::timestamp),
      attempts = attempts + 1,
      run_at = greatest(now(), run_at) + (exp(least(attempts, 10))::text || ' seconds')::interval,
      status = 'waiting to retry'::assemble_worker.job_status,
      last_acked_at = null
    where id = job_id
    returning * into v_row;
  else
    update assemble_worker.jobs
    set
      errors = array_append(errors, error_message),
      ran_at = array_append(ran_at, now()::timestamp),
      attempts = attempts + 1,
      run_at = null,
      status = 'failed'
    where id = job_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$ language plpgsql;

create or replace function assemble_worker.notify_job(job_id bigint) returns assemble_worker.jobs as $$
declare
  v_job assemble_worker.jobs;
  v_job_body json;
begin
  select * from assemble_worker.jobs where id = job_id into v_job;
  select (json_build_object('job_id', v_job.id)::jsonb || v_job.payload::jsonb)::json into v_job_body;
  perform assemble_worker.send_message(v_job.queue_name, v_job_body::text);
  return v_job;
end;
$$ language plpgsql;

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
      ( run_at is null and created_at < now() - interval '30 seconds' )
      or
      ( run_at < now() - interval '30 seconds' )
    );
end;
$$;

COMMIT;
