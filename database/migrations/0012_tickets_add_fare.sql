-- Migration: add public.tickets.fare.
--
-- Unblocks PR #114 (issue #68), which writes an explicit fare on checkout:
-- 500 for a Mock payment and 0 for a Senior_Exemption. The column does not exist yet, so merging
-- PR #114 before this migration breaks POST /api/tickets/checkout.
--
-- Kept in a file of its own precisely because it is that blocker: it is a single guarded statement
-- that cannot fail on existing data, so it can be applied ahead of the other follow-ups even if any
-- of them needs discussion first.

alter table public.tickets
  add column if not exists fare numeric(10,2) not null default 0;
