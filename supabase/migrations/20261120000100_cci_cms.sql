begin;

select pg_advisory_xact_lock(5064470554198320685);

create schema if not exists cci;
revoke all on schema cci from public, anon, authenticated;

create table if not exists cci.content (
  id text primary key,
  kind text not null,
  draft text not null,
  published text,
  version integer not null default 1,
  updated_at text not null
);

create table if not exists cci.enquiries (
  id text primary key,
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'New',
  notes text not null default '',
  created_at text not null
);

alter table cci.enquiries
  add column if not exists enquiry_type text,
  add column if not exists organisation text,
  add column if not exists location text;

update cci.content
set draft = replace(draft, 'The contact form asks for your name, email address, subject, and message.',
    'The contact form asks for your name, email address, inquiry type, and message. You can also provide your organisation or institution and your country or location.'),
  published = replace(published, 'The contact form asks for your name, email address, subject, and message.',
    'The contact form asks for your name, email address, inquiry type, and message. You can also provide your organisation or institution and your country or location.'),
  version = version + 1
where id = 'privacy' and (
  strpos(draft, 'The contact form asks for your name, email address, subject, and message.') > 0
  or strpos(published, 'The contact form asks for your name, email address, subject, and message.') > 0
);

create table if not exists cci.media (
  id text primary key,
  name text not null,
  type text not null,
  size integer not null,
  alt text not null,
  created_at text not null
);

create table if not exists cci.staff (
  email text primary key,
  role text not null,
  active integer not null default 1
);

create table if not exists cci.staff_credentials (
  email text primary key references cci.staff (email) on delete cascade,
  password_hash text not null,
  setup_expires_at bigint,
  session_hash text,
  session_user_id text,
  session_expires_at bigint
);

create index if not exists staff_session_hash on cci.staff_credentials (session_hash);

alter table cci.staff_credentials
  add column if not exists reset_token_hash text,
  add column if not exists reset_expires_at bigint,
  add column if not exists email_status text not null default 'manual';

create unique index if not exists staff_reset_token_hash on cci.staff_credentials (reset_token_hash);

create table if not exists cci.audit (
  id text primary key,
  actor text not null,
  action text not null,
  target text not null,
  created_at text not null
);

create table if not exists cci.limits (
  key text primary key,
  count integer not null,
  expires bigint not null
);

revoke all on all tables in schema cci from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cci-media', 'cci-media', false, 4000000, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'cci-media' and public) then
    raise exception 'Set the cci-media bucket to Private before installing the CCI schema.';
  end if;
end;
$$;

commit;
