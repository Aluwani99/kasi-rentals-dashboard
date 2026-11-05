create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'agent' check (role in ('agent', 'owner')),
  display_name text not null default ''
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  property_type text not null check (property_type in ('room', 'house')),
  description text not null default '',
  location text not null,
  monthly_rent numeric(12, 2) not null check (monthly_rent > 0),
  bedrooms integer not null check (bedrooms > 0),
  available_rooms integer not null check (available_rooms >= 0 and available_rooms <= bedrooms),
  status text not null default 'draft' check (status in ('draft', 'active', 'rented')),
  created_at timestamptz not null default now()
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null unique,
  caption text,
  sort_order integer not null default 0
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  selected_location text,
  state jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null default '',
  provider_message_id text unique,
  media_url text,
  created_at timestamptz not null default now()
);

create index properties_status_location_idx on public.properties (status, location);
create index properties_created_by_idx on public.properties (created_by);
create index property_images_property_sort_idx on public.property_images (property_id, sort_order);
create index conversations_last_message_idx on public.conversations (last_message_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'owner' then 'owner' else 'agent' end,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role <> old.role then
    raise exception 'Profile roles can only be changed by a trusted administrator';
  end if;
  return new;
end;
$$;

create trigger prevent_profile_role_change
  before update on public.profiles
  for each row execute procedure public.prevent_profile_role_change();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.properties, public.property_images to anon, authenticated;
grant insert, update, delete on public.properties, public.property_images to authenticated;
grant select on public.conversations, public.messages to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own display name"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Anyone can read active properties"
  on public.properties for select to anon, authenticated
  using (status = 'active' or created_by = (select auth.uid()));

create policy "Owners and agents can create their own properties"
  on public.properties for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Users can update their own properties"
  on public.properties for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Users can delete their own properties"
  on public.properties for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "Users can read images for visible properties"
  on public.property_images for select to anon, authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (p.status = 'active' or p.created_by = (select auth.uid()))
    )
  );

create policy "Users can add images to their own properties"
  on public.property_images for insert to authenticated
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.created_by = (select auth.uid())
    )
  );

create policy "Users can update images on their own properties"
  on public.property_images for update to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.created_by = (select auth.uid())
    )
  );

create policy "Users can delete images on their own properties"
  on public.property_images for delete to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.created_by = (select auth.uid())
    )
  );

create policy "Dashboard users can read conversations"
  on public.conversations for select to authenticated using (true);

create policy "Dashboard users can read messages"
  on public.messages for select to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

create policy "Users can view photos for active listings or their own"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[1]
        and (p.status = 'active' or p.created_by = (select auth.uid()))
    )
  );

create policy "Users can upload photos to their own listings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[1]
        and p.created_by = (select auth.uid())
    )
  );

create policy "Users can update photos on their own listings"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[1]
        and p.created_by = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[1]
        and p.created_by = (select auth.uid())
    )
  );

create policy "Users can delete photos from their own listings"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[1]
        and p.created_by = (select auth.uid())
    )
  );
