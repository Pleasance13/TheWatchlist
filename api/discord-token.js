const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const ALLOWED_ORIGIN = "https://pleasance13.github.io";

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return send(res, 405, { error: "POST only." });

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return send(res, 503, { error: "Discord OAuth is not configured on the server." });
  }

  const refreshToken = String(req.body?.refresh_token || "").trim();
  if (!refreshToken) return send(res, 400, { error: "A Discord refresh token is required." });

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });

    const response = await fetch(DISCORD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      return send(res, 401, { error: "Discord authorization could not be refreshed." });
    }

    return send(res, 200, {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in || null,
      scope: data.scope || null,
      token_type: data.token_type || "Bearer"
    });
  } catch (error) {
    return send(res, 502, { error: "Could not contact Discord to refresh authorization." });
  }
}
