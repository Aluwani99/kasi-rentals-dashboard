# Kasi Rentals dashboard

A web dashboard for rental agents and property owners to maintain room and house listings, upload listing photos, and monitor enquiries handled by the WhatsApp assistant. The bot itself is a separate application and is not included here.

## Stack

- React + TypeScript + Vite
- Supabase Auth, Postgres, Row Level Security, and Storage
- Meta WhatsApp Cloud API is configured by the separate bot service, not in this browser app

The interface opens in a sample-data demo when Supabase environment variables are absent. Demo edits are intentionally not saved. Configure Supabase to sign in and use live listings and conversations.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and public anon/publishable key.
4. Apply the migrations in order: `supabase/migrations/202611050001_initial_schema.sql`, then `supabase/migrations/202611050002_agent_notifications.sql` (or use the Supabase CLI).
5. Run `npm run dev`.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the dashboard whenever changes reach `main`, or when manually started from the Actions tab. Merge this branch into `main` to publish the first version. In the repository's **Settings → Pages**, set the source to **GitHub Actions** if it is not already selected.

To connect the deployed dashboard to Supabase, add these repository Actions variables under **Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL`: the Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: the Supabase anon/publishable key (this is public client configuration; never use the service-role key)

The build still deploys in demo mode if these variables are not configured. Add the GitHub Pages site URL to Supabase Auth's allowed redirect URLs after the first deployment. The site URL is `https://<owner>.github.io/<repository>/`.

Never put a Supabase `service_role` key in a `VITE_` variable or browser code. The WhatsApp bot must use a server-side secret for writes to conversations and messages; the dashboard only receives authenticated read access to those tables. Configure the bot with the same project URL and server-only credentials. Active properties can be read without authentication so the bot can look up listings.

## Authentication and roles

Email/password registration is enabled through Supabase Auth. New profiles are created by a database trigger. Users can register as an `agent` or `owner`; both roles can create, update, and delete their own properties and associated listing photos. Role changes are blocked from the user-facing profile update path and should be handled only by a trusted administrator.

Set Supabase Auth email confirmation and password policies to suit your deployment. For production, configure allowed redirect URLs and a custom SMTP provider.

## Data contract for the bot

The migrations create the shared tables:

- `profiles(id, role, display_name)`
- `properties(id, created_by, title, property_type, description, location, monthly_rent, bedrooms, available_rooms, status, created_at)`
- `property_images(id, property_id, storage_path, caption, sort_order)`
- `conversations(id, phone_number, selected_location, state, last_message_at)`
- `messages(id, conversation_id, direction, body, provider_message_id, media_url, created_at)`
- `notifications(id, user_id, conversation_id, message_id, title, body, created_at, read_at)`

The assistant should query only `properties.status = 'active'`, ordered/filtered by location and availability. Store each incoming/outgoing WhatsApp message in `messages` and upsert conversations by unique `phone_number`. The assistant can leave `conversations.assigned_to` null until an agent takes ownership. When an inbound message is received for an assigned conversation, a database trigger creates a private notification for that agent. Assigning a conversation with an existing inbound message also notifies the newly assigned agent. The dashboard checks for new conversations and notifications every 15 seconds; agents can optionally enable browser notifications in Settings.

Use the bucket `property-images`; listing photos are stored beneath a first-level folder containing their property UUID. The bot may use a server-side Supabase service role, which bypasses RLS; keep it secret, validate webhook signatures, and never expose it in this dashboard.

This MVP treats one Supabase project as one shared rental team: signed-in users can see the agent directory and monitor that project’s conversations, while notifications are scoped to their assigned agent. It does not yet isolate multiple businesses/workspaces within one Supabase project.

## Security notes

- RLS scopes property mutations and photo operations to the authenticated creator.
- Anonymous reads can see only active listings and their image metadata. The private Storage bucket issues signed URLs only for visible listing photos.
- Authenticated dashboard users can read conversations and messages; the browser has no policies to write them.
- Notifications are created server-side by database triggers and each agent can only read or mark their own notifications as read.
- `property-images` accepts JPEG, PNG, and WebP files up to 10 MB.
- The `property-images` bucket is private; dashboard previews use short-lived signed URLs after the Storage RLS check. Do not upload sensitive or personally identifying images.

The current dashboard inbox is a monitoring view that refreshes conversations and messages every 15 seconds; replies are sent by the separate WhatsApp assistant. Message bodies and any media URLs surfaced there should be treated as user-provided data.

## Checks

Run `npm test` for focused listing validation tests, `npm run typecheck` for TypeScript, and `npm run build` for a production build.
