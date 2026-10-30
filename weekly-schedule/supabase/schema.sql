-- 주간 일정 종합·배포 시제품 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 실행한다.

create table if not exists departments (
  id uuid primary key,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists weeks (
  id text primary key,                 -- 월요일 날짜 YYYY-MM-DD
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  published_snapshot jsonb,            -- 배포 시점 스냅샷(각주 비교·이력)
  last_composed_at timestamptz
);

create table if not exists submissions (
  id uuid primary key,
  week_id text not null references weeks(id) on delete cascade,
  kind text not null check (kind in ('department', 'common')),
  department_id uuid references departments(id),
  file_path text,
  file_name text,
  revision_no int not null default 1,
  uploaded_at timestamptz not null,
  parsed_at timestamptz not null,
  parsed_data jsonb not null,
  last_composed_at timestamptz
);
-- 주차·부서별(공통은 1건) 최신 파일 1건만
create unique index if not exists submissions_one_per_dept
  on submissions (week_id, kind, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists schedule_items (
  id uuid primary key,
  week_id text not null references weeks(id) on delete cascade,
  section text not null check (section in ('common', 'department', 'personal')),
  department_id uuid references departments(id),
  person text not null default '',
  date_text text not null default '',
  date_start date,
  date_end date,
  weekday text not null default '',
  content text not null default '',
  place text not null default '',
  headcount text not null default '',
  note text not null default '',
  sort_order int not null default 0,
  source_submission_id uuid,
  is_manual_edit boolean not null default false,
  change_flag text
);
create index if not exists schedule_items_week on schedule_items (week_id);

create table if not exists reports (
  id text primary key,                 -- = week_id (주차당 1건, 재배포 시 덮어씀)
  week_id text not null references weeks(id) on delete cascade,
  hwpx_path text not null,
  item_count int not null default 0,
  published_at timestamptz not null
);

create table if not exists settings (
  key text primary key,
  value jsonb
);

-- 브라우저(anon) 접근은 모두 차단: RLS를 켜고 정책을 만들지 않는다.
-- 서버는 service role 키로 접근하므로 RLS의 영향을 받지 않는다.
alter table departments enable row level security;
alter table weeks enable row level security;
alter table submissions enable row level security;
alter table schedule_items enable row level security;
alter table reports enable row level security;
alter table settings enable row level security;

-- 비공개 Storage 버킷
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;
