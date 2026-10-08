-- A decided document is never put back to "sent" (or "draft").
--
-- UK walk, 2026-10-08: the customer accepted a quote in the portal (status
-- accepted, server-side, by decide_acceptance_link). The contractor's app did
-- not know yet, showed the "Did you send it? — Yes, sent" prompt, and its write
-- `update documents set status = 'sent'` overwrote the acceptance. The app then
-- offered "Accept" again. The client already refuses to demote what it KNOWS is
-- decided; it cannot refuse what it has not heard about, and the offline queue
-- replays the same payload later. Only the database sees the current row.
--
-- So the rule lives here: an update that would move accepted / rejected / paid
-- back to sent or draft keeps the decided status. sent_at and every other column
-- still update — re-sending a link is legitimate, it is just not a new state.
-- Nothing in the app moves a paid or decided document back (grepped 2026-10-08:
-- no "mark unpaid", no reopen).

create or replace function public.documents_keep_decided_status()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('accepted', 'rejected', 'paid')
     and new.status in ('sent', 'draft') then
    new.status := old.status;
    -- A late or replayed "sent" on a PAID invoice must not move sent_at past
    -- paid_at either: DSO and ageing count from it (review 2026-10-08).
    if old.status = 'paid' then
      new.sent_at := old.sent_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_keep_decided_status on public.documents;
create trigger documents_keep_decided_status
  before update of status, sent_at on public.documents
  for each row
  execute function public.documents_keep_decided_status();
