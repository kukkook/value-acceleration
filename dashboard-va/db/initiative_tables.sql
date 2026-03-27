create table if not exists initiatives (
  id bigserial primary key,
  initiative_no integer not null,
  year integer not null,
  name text not null,
  pic text,
  target_mb numeric(12, 2),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint initiatives_year_no_unique unique (year, initiative_no)
);

create table if not exists initiative_inputs (
  id bigserial primary key,
  initiative_id bigint not null references initiatives(id) on delete cascade,
  year integer not null,
  month_idx integer not null check (month_idx between 0 and 12),
  impact_mb numeric(12, 2),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint initiative_inputs_unique unique (initiative_id, year, month_idx)
);

create index if not exists initiative_inputs_year_month_idx
  on initiative_inputs (year, month_idx);

create index if not exists initiative_inputs_initiative_id_idx
  on initiative_inputs (initiative_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists initiatives_set_updated_at on initiatives;
create trigger initiatives_set_updated_at
before update on initiatives
for each row
execute function set_updated_at();

drop trigger if exists initiative_inputs_set_updated_at on initiative_inputs;
create trigger initiative_inputs_set_updated_at
before update on initiative_inputs
for each row
execute function set_updated_at();

-- Example seed from current dashboard data
-- insert into initiatives (initiative_no, year, name, pic, target_mb, note)
-- values
--   (1, 2026, 'Maximize MAA sale vol, margin', 'Meng', 50.0, '>50 MB. (Exprice +50 USD/MT)'),
--   (2, 2026, 'Optimize business model for BMA and MMA', 'Golffy', 70.0, '>70 MB (Exprice +100 USD/MT)');

-- Example save from the input form
-- insert into initiative_inputs (initiative_id, year, month_idx, impact_mb, comment)
-- values (1, 2026, 0, 5.0, 'Summary, risk, next step')
-- on conflict (initiative_id, year, month_idx)
-- do update set
--   impact_mb = excluded.impact_mb,
--   comment = excluded.comment,
--   updated_at = now();
