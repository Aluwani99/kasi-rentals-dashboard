alter table public.profiles
  add column desktop_notifications_enabled boolean not null default false;

alter table public.conversations
  add column assigned_to uuid references public.profiles (id) on delete set null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, message_id)
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;

grant select on public.profiles to authenticated;
grant update (desktop_notifications_enabled) on public.profiles to authenticated;
grant update (assigned_to) on public.conversations to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Signed-in dashboard users can read the team directory"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their desktop notification preference"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Agents can assign conversations to an agent"
  on public.conversations for update to authenticated
  using (true)
  with check (
    assigned_to is null or exists (
      select 1 from public.profiles p
      where p.id = assigned_to and p.role = 'agent'
    )
  );

create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can mark their own notifications as read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_agent_of_inbound_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignee uuid;
  phone text;
begin
  if new.direction <> 'inbound' then
    return new;
  end if;

  select c.assigned_to, c.phone_number
    into assignee, phone
    from public.conversations c
    where c.id = new.conversation_id;

  if assignee is not null then
    insert into public.notifications (user_id, conversation_id, message_id, title, body)
    values (
      assignee,
      new.conversation_id,
      new.id,
      'New WhatsApp enquiry',
      left(phone || ': ' || coalesce(nullif(new.body, ''), 'A new message was received.'), 240)
    )
    on conflict (user_id, message_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger notify_assigned_agent_of_inbound_message
  after insert on public.messages
  for each row execute procedure public.notify_agent_of_inbound_message();

create or replace function public.notify_agent_when_conversation_is_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest_inbound public.messages%rowtype;
begin
  if new.assigned_to is null or new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;

  select m.* into latest_inbound
    from public.messages m
    where m.conversation_id = new.id and m.direction = 'inbound'
    order by m.created_at desc
    limit 1;

  if latest_inbound.id is not null then
    insert into public.notifications (user_id, conversation_id, message_id, title, body)
    values (
      new.assigned_to,
      new.id,
      latest_inbound.id,
      'WhatsApp conversation assigned to you',
      left(new.phone_number || ': ' || coalesce(nullif(latest_inbound.body, ''), 'Open the conversation to review the request.'), 240)
    )
    on conflict (user_id, message_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger notify_agent_when_conversation_assigned
  after update of assigned_to on public.conversations
  for each row execute procedure public.notify_agent_when_conversation_is_assigned();
