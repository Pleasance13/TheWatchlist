# Discord watch scheduling

## User behavior

- A movie's Details page has Schedule a watch with a date and time.
- The selected local date/time is stored as an ISO timestamp.
- Discord uses its timestamp syntax, so each Discord viewer sees the scheduled time in their own timezone.
- Settings contains a Discord watch notifications minimum-interest setting:
  - Must Watch
  - Interested or higher
  - I'd Watch or higher
  - Never notify me
- Notification preferences never change a user's actual movie interest response.
- At announcement time, only server members whose interest meets their configured threshold are mentioned.

## Discord Developer Portal

For this implementation, the bot does not need Message Content Intent or Server Members Intent. It sends messages through Discord's REST API and mentions users using their Discord user IDs.

Invite the bot to the server with only:
- View Channel
- Send Messages

Do not grant Administrator.

If the watch channel has permission overrides, make sure the bot can view and send messages there.

## Supabase configuration

The scheduler is a Supabase Edge Function invoked once per minute by pg_cron/pg_net.

Set these Edge Function secrets/environment variables:
- DISCORD_BOT_TOKEN — the bot token. Never commit it.
- DISCORD_WATCH_CHANNEL_ID — the Discord channel where announcements should be posted.
- DISCORD_GUILD_ID — the Watchlist Discord server.
- WATCH_CRON_SECRET — a random secret used by the cron request.
- SUPABASE_SERVICE_ROLE_KEY — server-side only.

The project already has pg_cron, pg_net, and Vault available.

Deploy supabase/functions/discord-watch-scheduler/index.ts as the discord-watch-scheduler Edge Function.

Then apply supabase/watch-scheduling.sql.

Finally create the one-minute cron job. Use the Supabase project URL and a secret stored in Vault rather than committing a credential. The pg_net request should call:

select cron.schedule(
  'watchlist-discord-watch-scheduler',
  '* * * * *',
  $$ select net.http_post(
    url := 'https://ujpenvkxafgimitawess.supabase.co/functions/v1/discord-watch-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-watch-cron-secret', '<cron secret>'
    ),
    body := '{}'::jsonb
  ); $$);

Do not run the example until the Edge Function and its secrets are configured.

## Testing

Schedule a movie a few minutes in the future, then check:
1. The Details page shows the scheduled watch date.
2. The scheduler function logs show a successful run.
3. Discord receives one announcement at the scheduled time.
4. Only users whose interest meets their notification threshold are mentioned.
5. A second scheduler run does not post the same movie again.

## Important identity detail

The scheduler uses the authenticated user's Discord identity metadata for the Discord user ID. It does not attempt to resolve mentions by display name, which avoids problems caused by renamed Discord accounts or duplicate display names.
