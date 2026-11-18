const DISCORD = "https://discord.com/api/v10";

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  return res.status(status).json(body);
}
function discordIdOf(user) {
  const identity = (user?.identities || []).find(i => i.provider === "discord")?.identity_data || {};
  return String(identity.provider_id || identity.sub || identity.user_id || "");
}
function discordIdFromAvatarUrl(url) {
  return (String(url || "").match(/\/avatars\/(\d+)\//) || [])[1] || "";
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== "Bearer " + secret) {
    return send(res, 401, { error: "Unauthorized." });
  }
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DISCORD_BOT_TOKEN"].filter(k => !process.env[k]);
  if (missing.length) return send(res, 500, { error: "Missing server configuration: " + missing.join(", ") });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const sb = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };

  try {
    const members = await (await fetch(`${supabaseUrl}/rest/v1/watchlist_server_memberships?select=user_id,avatar_url`, { headers: sb })).json();

    const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: sb });
    const usersBody = await usersRes.json().catch(() => ({}));
    const users = Array.isArray(usersBody.users) ? usersBody.users : [];
    const discordIdByUser = new Map(users.map(u => [u.id, discordIdOf(u)]).filter(([, d]) => d));

    const avatarByDiscordId = new Map();
    const stats = {
      authStatus: usersRes.status, authUsers: users.length,
      members: 0, noDiscordId: 0, discordFailed: [], unchanged: 0, updated: 0
    };

    for (const m of Array.isArray(members) ? members : []) {
      stats.members++;
      const did = discordIdByUser.get(m.user_id) || discordIdFromAvatarUrl(m.avatar_url);
      if (!did) { stats.noDiscordId++; continue; }
      if (!avatarByDiscordId.has(did)) {
        const r = await fetch(`${DISCORD}/users/${did}`, { headers: { Authorization: "Bot " + botToken } });
        if (!r.ok) { stats.discordFailed.push(r.status); avatarByDiscordId.set(did, undefined); continue; }
        const d = await r.json();
        avatarByDiscordId.set(did, d.avatar ? `https://cdn.discordapp.com/avatars/${did}/${d.avatar}.png` : "");
      }
      const fresh = avatarByDiscordId.get(did);
      if (fresh === undefined) continue;
      if (fresh === (m.avatar_url || "")) { stats.unchanged++; continue; }
      const patch = await fetch(`${supabaseUrl}/rest/v1/watchlist_server_memberships?user_id=eq.${m.user_id}`, {
        method: "PATCH",
        headers: { ...sb, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ avatar_url: fresh, updated_at: new Date().toISOString() })
      });
      if (patch.ok) stats.updated++;
    }
    return send(res, 200, { ok: true, ...stats });
  } catch (error) {
    return send(res, 500, { error: error instanceof Error ? error.message : "Avatar refresh failed." });
  }
}
