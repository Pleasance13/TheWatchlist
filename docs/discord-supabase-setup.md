# The Watchlist: Discord + Supabase rollout

Built for a small private Discord community. Start on free plans; do not enable paid upgrades or spending without the owner's explicit approval.

## Safety model

- GitHub Pages is public; frontend hiding and CORS are not access control.
- Require Discord OAuth sign-in and verify server membership server-side before returning or changing shared data.
- Verify role IDs server-side for admin/artwork privileges. Never trust a browser-supplied admin flag or role list.
- Keep Discord client secret, bot token, Supabase service-role key, and provider API keys in Vercel environment variables only. Never commit credentials or expose the service-role key to browser code.
- Apply per-user and global rate limits to every quota-limited endpoint. Cache metadata and reject requests when configurable caps are reached. CORS and frontend debounce are not abuse prevention.
- No public database policies. Initial schema enables RLS without permissive client policies until authorization endpoints are implemented.
- If usage spikes, disable affected API functions/credentials and revoke compromised Discord credentials. Configure provider usage alerts/limits where available.

## Free-tier setup checklist

1. Create a Supabase project on its free plan.
2. Configure Discord as a Supabase Auth provider using a Discord Developer Portal OAuth application and the exact callback URL shown by Supabase.
3. Create a Discord application and bot. Invite it to the private server with only required permissions; do not grant Administrator.
4. Run supabase/schema.sql in the Supabase SQL Editor.
5. Configure the Vercel environment variables listed below. Keep secrets server-side.
6. Set the Discord guild ID and specific role IDs for admins and artwork managers.
7. Require authentication for the app's shared-data API despite the public static frontend.

## Vercel environment variable names

- SUPABASE_URL
- SUPABASE_ANON_KEY (may be used in browser; RLS remains mandatory)
- SUPABASE_SERVICE_ROLE_KEY (server only)
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET (server only)
- DISCORD_BOT_TOKEN (server only)
- DISCORD_GUILD_ID
- DISCORD_ADMIN_ROLE_IDS (comma-separated IDs)
- DISCORD_ARTWORK_ROLE_IDS (comma-separated IDs)
- WATCHLIST_OWNER_DISCORD_IDS (comma-separated Discord user IDs)
- API_RATE_LIMIT_PER_MINUTE (suggested starting value: 30 per authenticated user)
- API_DAILY_REQUEST_CAP (suggested starting value: 500 server-wide)

These are variable names, not actual credentials. Do not commit a populated .env file.

## Limits and costs

Free plans have provider-defined quotas that may change. App-level caps add protection but are not a guarantee against every platform bill or limit. Configure dashboard alerts/limits when available; never automatically upgrade a plan. Cache repeat TMDB/OMDb/DDD lookups and avoid unnecessary fan-out requests.

## Rollout order

1. Create/configure Supabase and Discord apps.
2. Deploy server-side OAuth callback, session validation, membership/role verification, and rate limiting.
3. Test anonymous, non-member, member, artwork manager, and admin permissions, including RLS.
4. Connect shared movie state and realtime updates only after authorization tests pass.
5. Enable for the Discord community after owner sign-off.
