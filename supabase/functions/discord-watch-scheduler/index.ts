import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const DISCORD_WATCH_CHANNEL_ID = Deno.env.get("DISCORD_WATCH_CHANNEL_ID") || "1557490304460914799";
const DISCORD_GUILD_ID = Deno.env.get("DISCORD_GUILD_ID") || "";
const WATCH_CRON_SECRET = Deno.env.get("WATCH_CRON_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rank: Record<string, number> = { must: 4, interested: 3, watch: 2, no: 0 };
const normalizeThreshold = (value: unknown) =>
  ["must", "interested", "watch", "none"].includes(String(value || "")) ? String(value) : "watch";

function qualifies(interest: unknown, threshold: unknown) {
  const minimum = normalizeThreshold(threshold);
  if (minimum === "none") return false;
  return (rank[String(interest || "").toLowerCase()] || 0) >= (rank[minimum] || 0);
}

function discordId(user: any) {
  const meta = user?.user_metadata || {};
  const identity = (user?.identities || []).find((x: any) => x.provider === "discord")?.identity_data || {};
  return String(identity.user_id || identity.id || identity.provider_id || identity.sub || meta.user_id || meta.discord_id || "");
}
async function markScheduledAnnouncement(sharedId: string, movieId: string, announcedAt: string) {
  const { error } = await supabase.rpc("watchlist_mark_watch_scheduled_announced", {
    p_shared_id: sharedId, p_movie_id: movieId, p_announced_at: announcedAt,
  });
  if (error) throw error;
}
async function announceScheduledMovie(sharedId: string, movieId: string, userId: string) {
  const { data: state, error: stateError } = await supabase.from("watchlist_shared_state").select("id,data").eq("id", sharedId).maybeSingle();
  if (stateError) throw stateError;
  if (!state) throw new Error("Watchlist server not found");
  const movie = (Array.isArray(state.data?.movies) ? state.data.movies : []).find((m: any) => String(m.id) === movieId);
  if (!movie?.watchSchedule?.scheduledAt) throw new Error("Movie is not scheduled");
  if (String(movie.watchSchedule.scheduledById || "") !== userId) throw new Error("Only the person who scheduled the watch can announce it");
  if (movie.watchSchedule.scheduledAnnouncementAt) return;
  const when = Math.floor(new Date(movie.watchSchedule.scheduledAt).getTime() / 1000);
  await sendDiscordMessage("🎬 **Movie Night: " + String(movie.title || "Watchlist movie") + "**\nScheduled for <t:" + when + ":F> (<t:" + when + ":R>).");
  await markScheduledAnnouncement(sharedId, movieId, new Date().toISOString());
}



async function allUsers() {
  const users: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if (!data.users || data.users.length < 1000) break;
  }
  return users;
}

async function sendDiscordMessage(content: string) {
  const response = await fetch(
    "https://discord.com/api/v10/channels/" + encodeURIComponent(DISCORD_WATCH_CHANNEL_ID) + "/messages",
    {
      method: "POST",
      headers: {
        Authorization: "Bot " + DISCORD_BOT_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, allowed_mentions: { parse: ["users"] } }),
    },
  );
  if (!response.ok) throw new Error("Discord API " + response.status + ": " + await response.text());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST required", { status: 405 });
  let requestBody: any = {};
  try { requestBody = await req.json(); } catch (_) {}
  const isScheduledAnnouncement = requestBody?.action === "scheduled_announcement";
  if (isScheduledAnnouncement) {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return new Response("Unauthorized", { status: 401 });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return new Response("Unauthorized", { status: 401 });
    try {
      await announceScheduledMovie(String(requestBody.sharedId || ""), String(requestBody.movieId || ""), authData.user.id);
      return Response.json({ ok: true });
    } catch (error) {
      console.error("scheduled announcement failed", error);
      return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
  }
  if (WATCH_CRON_SECRET && req.headers.get("x-watch-cron-secret") !== WATCH_CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!DISCORD_BOT_TOKEN || !DISCORD_WATCH_CHANNEL_ID) {
    return new Response("Discord scheduler is not configured", { status: 503 });
  }

  try {
    const now = new Date();
    const { data: states, error: stateError } = await supabase
      .from("watchlist_shared_state")
      .select("id,data")
      .like("id", "server:%");
    if (stateError) throw stateError;

    const users = await allUsers();
    const userById = new Map(users.map((u) => [u.id, u]));
    let sent = 0;

    for (const state of states || []) {
      const guildId = String(state.id || "").slice(7);
      if (!guildId || (DISCORD_GUILD_ID && guildId !== DISCORD_GUILD_ID)) continue;
      const movies = Array.isArray(state.data?.movies) ? state.data.movies : [];
      const votesByUser = state.data?.votesByUser && typeof state.data.votesByUser === "object"
        ? state.data.votesByUser
        : {};

      const { data: members, error: memberError } = await supabase
        .from("watchlist_server_memberships")
        .select("user_id")
        .eq("guild_id", guildId);
      if (memberError) throw memberError;
      const memberIds = new Set((members || []).map((m) => String(m.user_id)));
      if (!memberIds.size) continue;

      const { data: settingsRows, error: settingsError } = await supabase
        .from("watchlist_user_settings")
        .select("user_id,data")
        .in("user_id", [...memberIds]);
      if (settingsError) throw settingsError;
      const settingsByUser = new Map((settingsRows || []).map((row) => [String(row.user_id), row.data || {}]));

      for (const movie of movies) {
        const schedule = movie?.watchSchedule;
        if (!schedule?.scheduledAt || schedule?.announcedAt) continue;
        const scheduledAt = new Date(schedule.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt > now) continue;

        const mentions: string[] = [];
        for (const userId of memberIds) {
          const user = userById.get(userId);
          if (!user) continue;
          const threshold = normalizeThreshold(settingsByUser.get(userId)?.discordWatchThreshold);
          const voteEntry = votesByUser[userId] || Object.values(votesByUser).find((entry: any) => String(entry?.id || "") === userId);
          const interest = voteEntry?.votes?.[String(movie.id)] || null;
          if (!qualifies(interest, threshold)) continue;
          const id = discordId(user);
          if (id) mentions.push("<@" + id + ">");
        }

        const when = Math.floor(scheduledAt.getTime() / 1000);
        const mentionText = mentions.length ? "\n\n" + mentions.join(" ") : "";
        const content =
          "🎬 **Movie Night: " + String(movie.title || "Watchlist movie") + "**\n" +
          "Scheduled for <t:" + when + ":F> (<t:" + when + ":R>)." +
          mentionText;

        await sendDiscordMessage(content);

        const { error: markError } = await supabase.rpc("watchlist_mark_watch_announced", {
          p_shared_id: state.id,
          p_movie_id: String(movie.id),
          p_announced_at: now.toISOString(),
        });
        if (markError) throw markError;
        sent++;
      }
    }

    return Response.json({ ok: true, sent });
  } catch (error) {
    console.error("discord-watch-scheduler failed", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
