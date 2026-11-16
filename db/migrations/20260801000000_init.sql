-- migrate:up

-- Anonymous learner: identified by a random device id kept in the browser (no login).
create table learners (
  id uuid not null default uuidv7() constraint pk_learners_id primary key,
  device_id uuid not null constraint uk_learners_device_id unique,
  created_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now()
);

-- One finished (or ended-early) practice/tournament run.
create table attempts (
  id uuid not null default uuidv7() constraint pk_attempts_id primary key,
  learner_id uuid not null constraint fk_attempts_learner_id references learners(id) on delete cascade,
  client_id uuid not null,                       -- makes retries idempotent
  kind varchar(20) not null constraint ck_attempts_kind check (kind in ('practice', 'tournament')),
  mode varchar(20) not null constraint ck_attempts_mode check (mode in ('input', 'options', 'mixed')),
  quiz_ids text[] not null,
  total int not null,
  correct int not null,
  duration_ms int not null,
  started_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  constraint uk_attempts_learner_client unique (learner_id, client_id)
);
create index idx_attempts_learner_started on attempts (learner_id, started_at desc);

-- Every single answered question. quiz_id + item_key keeps this generic for new quizzes
-- (squares/17, cubes/12, tables/13x7 ...).
create table answers (
  id uuid not null default uuidv7() constraint pk_answers_id primary key,
  attempt_id uuid not null constraint fk_answers_attempt_id references attempts(id) on delete cascade,
  learner_id uuid not null constraint fk_answers_learner_id references learners(id) on delete cascade,
  quiz_id varchar(50) not null,
  item_key varchar(50) not null,
  prompt text not null,
  correct_answer bigint not null,
  given_answer bigint not null,
  is_correct boolean not null,
  time_ms int not null,
  answered_at timestamp with time zone not null
);
create index idx_answers_learner_item on answers (learner_id, quiz_id, item_key, answered_at desc);
create index idx_answers_learner_time on answers (learner_id, answered_at desc);

-- migrate:down

drop table answers;
drop table attempts;
drop table learners;
