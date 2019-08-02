BEGIN;

-- Global testing helper function
create table assemble_worker.test_queue_messages (
  routing_key text,
  message_body text
);

create function assemble_worker.send_message(routing_key text, message_body text) returns void as $$
declare
  v_test_mode text;
begin
  select current_setting('worker.test', true) into v_test_mode;
 
  if lower(v_test_mode) = 'on' then
    insert into assemble_worker.test_queue_messages (routing_key, message_body)
    values (routing_key, message_body);
  else
    perform pg_notify('assemble-worker', routing_key || '|' || message_body);
  end if;
end;
$$ language plpgsql;

-- Create the tables
create table assemble_worker.job_queues (
  queue_name text not null primary key,
  created boolean default false
);

create function assemble_worker.register_queue(queue_name_to_register text) returns void as $$
begin
  insert into assemble_worker.job_queues (queue_name, created)
  values (queue_name_to_register, true)
  on conflict (queue_name)
  do update
  set created = true;
end;
$$ language plpgsql;

create table assemble_worker.pending_jobs (
  queue_name text not null,
  payload json default '{}'::json not null,
  max_attempts int default 25 not null,
  run_at timestamp,
  created_at timestamp not null default now()
);

create index queue_name_idx on assemble_worker.pending_jobs (queue_name);

create type assemble_worker.job_status as enum (
  'running',
  'waiting to run',
  'waiting to retry',
  'failed'
);

create table assemble_worker.jobs (
  id bigserial primary key,
  queue_name text not null,
  payload json default '{}'::json not null,
  run_at timestamp,
  status assemble_worker.job_status not null,
  attempts int default 0 not null,
  max_attempts int default 25 not null,
  errors text[] default ARRAY[]::text[],
  ran_at timestamp[] default ARRAY[]::timestamp[],
  created_at timestamp not null default now()
);

create table assemble_worker.pokes (
  poked_at timestamp default now() primary key
);

create index jobs_id_idx on assemble_worker.jobs (id);
create index jobs_poke_idx on assemble_worker.jobs (run_at, status);

-- Notify worker of new queues to be created in Rabbit
create function assemble_worker.tg_job_queues__notify_new_queues() returns trigger as $$
begin
  perform assemble_worker.send_message('meta-queue', NEW.queue_name);
  return NEW;
end;
$$ language plpgsql;

create trigger _500_notify_new_queues
  after insert
  on assemble_worker.job_queues
  for each row
  when (NEW.created = false)
  execute procedure assemble_worker.tg_job_queues__notify_new_queues();

-- When a queue has been created, send pending jobs for that queue to jobs 
create function assemble_worker.tg_job_queues__after_queue_create() returns trigger as $$
begin
  with pending_jobs_to_queue as (
    select queue_name, payload, created_at, run_at, max_attempts,
      (case
        when run_at is null then 'running'::assemble_worker.job_status
        else 'waiting to run'::assemble_worker.job_status
      end) as status
    from assemble_worker.pending_jobs
    where queue_name = NEW.queue_name
  )
  insert into assemble_worker.jobs (queue_name, payload, created_at, run_at, max_attempts, status)
  select queue_name, payload, created_at, run_at, max_attempts, status
  from pending_jobs_to_queue;

  delete from assemble_worker.pending_jobs
  where queue_name = NEW.queue_name;

  return NEW;
end;
$$ language plpgsql;

create trigger _500_queue_pending_jobs
  after update
  on assemble_worker.job_queues
  for each row
  when (OLD.created = false and NEW.created = true)
  execute procedure assemble_worker.tg_job_queues__after_queue_create();

-- Notify worker of new jobs
create function assemble_worker.tg_jobs__notify_new_jobs() returns trigger as $$
declare
  v_job_body json;
begin
  select (json_build_object('job_id', NEW.id)::jsonb || NEW.payload::jsonb)::json into v_job_body;
  perform assemble_worker.send_message(NEW.queue_name, v_job_body::text);
  return NEW;
end;
$$ language plpgsql;

create trigger _900_notify_worker_after_insert
  after insert
  on assemble_worker.jobs
  for each row 
  when (NEW.status = 'running'::assemble_worker.job_status)
  execute procedure assemble_worker.tg_jobs__notify_new_jobs();

create trigger _900_notify_worker_after_update
  after update
  on assemble_worker.jobs
  for each row 
  when (NEW.status = 'running'::assemble_worker.job_status and OLD.status is distinct from 'running'::assemble_worker.job_status)
  execute procedure assemble_worker.tg_jobs__notify_new_jobs();

-- Function to queue a job - put it into pending_jobs if the queue does not exist yet
create function assemble_worker.add_job(job_name text, payload json = '{}', run_at timestamp = null, max_attempts int = 25) returns void as $$
declare
  v_queue_exists boolean;
  v_job_status assemble_worker.job_status;
begin
  select exists (
    select 1
    from assemble_worker.job_queues
    where queue_name = job_name
      and created = true
  ) into v_queue_exists;

  if v_queue_exists then
    if run_at is null then
      select 'running'::assemble_worker.job_status into v_job_status;
    else
      select 'waiting to run'::assemble_worker.job_status into v_job_status;
    end if;

    insert into assemble_worker.jobs (queue_name, payload, max_attempts, run_at, status)
    values (job_name, payload, max_attempts, run_at, v_job_status);
  else
    insert into assemble_worker.pending_jobs (queue_name, payload, max_attempts, run_at)
    values (job_name, payload, max_attempts, run_at);

    insert into assemble_worker.job_queues (queue_name)
    values (job_name)
    on conflict (queue_name) do nothing; 
  end if;

end;
$$ language plpgsql;

-- I was successful, mark the job as completed
create function assemble_worker.complete_job(job_id bigint) returns assemble_worker.jobs as $$
declare
  v_row assemble_worker.jobs;
begin
  delete from assemble_worker.jobs
    where id = job_id
    returning * into v_row;
  return v_row;
end;
$$ language plpgsql;

-- I was unsuccessful, record the failure – choose a new run_at
create function assemble_worker.fail_job(job_id bigint, error_message text) returns assemble_worker.jobs as $$
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
      status = 'waiting to retry'::assemble_worker.job_status
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

create function assemble_worker.poke() returns void as $$
declare
  v_last_poke timestamp;
  v_new_poke timestamp;
  v_maybe_new_poke timestamp;
  v_updated_count timestamp;
begin
  select poked_at
  from assemble_worker.pokes
  order by poked_at desc 
  limit 1
  into v_last_poke;

  select greatest('-infinity'::timestamp, v_last_poke) into v_last_poke;

  select now()::timestamp into v_new_poke;

  update assemble_worker.jobs
  set
    status = 'running'::assemble_worker.job_status
  where run_at > v_last_poke
    and run_at <= v_new_poke
    and status <> 'running'::assemble_worker.job_status
    and status <> 'failed'::assemble_worker.job_status;

  -- Concurrenct modification checking - causes errors and is unnecessary - left for posterity
  -- select poked_at from assemble_worker.pokes order by poked_at desc limit 1 into v_maybe_new_poke;

  -- We don't want to recall the jobs, so let's abort the transaction
  -- this might not be necessary with the update trigger not firing anyways
  -- if v_maybe_new_poke > v_last_poke then
  --   raise '%', 'Poke conflict: I lose so that others may win';
  -- end if;

  insert into assemble_worker.pokes (poked_at) values (v_new_poke);
end;
$$ language plpgsql;

COMMIT;
