create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type = 'whatsapp_inbound'),
  title text not null check (length(btrim(title)) > 0),
  body text not null default '' check (length(body) <= 500),
  related_message_id uuid references public.messages (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can mark their own notifications as read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_dashboard_users_on_inbound_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_phone text;
begin
  if new.direction <> 'inbound' then
    return new;
  end if;

  select c.phone_number
    into sender_phone
    from public.conversations c
    where c.id = new.conversation_id;

  insert into public.notifications (user_id, type, title, body, related_message_id)
  select p.id, 'whatsapp_inbound', 'New WhatsApp enquiry', left('New message from ' || sender_phone, 500), new.id
    from public.profiles p;

  return new;
end;
$$;

revoke all on function public.notify_dashboard_users_on_inbound_message() from public, anon, authenticated;

create trigger notify_dashboard_users_on_inbound_message
  after insert on public.messages
  for each row execute procedure public.notify_dashboard_users_on_inbound_message();
