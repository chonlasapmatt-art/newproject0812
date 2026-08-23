# SQL that CI applies

Every file here runs on every deploy, in filename order, through the Supabase
Management API. There is no migration history: the workflow does not track
which files it has already seen.

That is deliberate. It means the deploy needs only a personal access token
rather than the database password, and a run that dies halfway cannot leave the
schema in a state the next run refuses to touch.

The cost is a rule that has to be kept:

**Every file here must be safe to run again.**

- `create table if not exists`, not `create table`
- `alter table … add column if not exists`, never a bare `add column`
- `drop policy if exists` before `create policy`
- `create or replace function`
- `drop trigger if exists` before `create trigger`
- `insert … on conflict do nothing` for seed rows

Two things this cannot do, so do them elsewhere:

- **Change an existing column.** `create table if not exists` silently skips a
  table that already exists, so a changed definition here does nothing at all.
  Write an `alter table` guarded so it is safe twice.
- **Anything destructive.** A `drop` runs again on the next deploy, and the
  next, against live data.

`../migrations/` stays the record of how the schema was built, and
`../setup.sql` is still the one-paste file for a brand-new project.
