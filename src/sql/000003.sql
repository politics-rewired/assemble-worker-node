BEGIN; 

create function assemble_worker.complete_many_jobs(job_ids bigint[]) returns bigint[] as $$
  with deleted_ids as (
    delete from assemble_worker.jobs
    where id = ANY(job_ids)
    returning id
  )
  select array_agg(id)
  from deleted_ids;
$$ language sql;

create function assemble_worker.fail_many_jobs(job_ids bigint[], error_messages text[]) returns bigint[] as $$
  with
    job_ids_to_fail as (
      select job_id, row_number() over ( partition by 1 ) as n
      from unnest(job_ids) as job_id
    ),
    error_messages_to_fail as (
      select error, row_number() over ( partition by 1 ) as n
      from unnest(error_messages) as error
    ),
    job_ids_with_error_messages as (
      select job_id, error
      from job_ids_to_fail
      join error_messages_to_fail
        on job_ids_to_fail.n = error_messages_to_fail.n
    ),
    updated_ids as (
      update assemble_worker.jobs
      set
        errors = array_append(errors, job_ids_with_error_messages.error),
        ran_at = array_append(ran_at, now()::timestamp),
        attempts = attempts + 1,
        run_at = (
          case
            when attempts < max_attempts then
              greatest(now(), run_at) + (exp(least(attempts, 10))::text || ' seconds')::interval
            else
              null
          end
        ),
        status = (
          case
            when attempts < max_attempts then
              'waiting to retry'::assemble_worker.job_status
            else
              'failed'::assemble_worker.job_status
          end
        ),
        last_acked_at = null
      from job_ids_with_error_messages
      where assemble_worker.jobs.id = job_ids_with_error_messages.job_id
      returning id
    )
    select array_agg(id) as failed_ids
    from updated_ids;
$$ language sql;

COMMIT;
