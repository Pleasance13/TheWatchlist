const OMDB_BASE = "https://www.omdbapi.com/";

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "https://pleasance13.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://pleasance13.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return send(res, 405, { error: "GET only." });

  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return send(res, 503, { error: "OMDb is not configured on the server." });

  const imdbID = String(req.query.imdbID || "").trim();
  if (!/^tt\d{7,10}$/.test(imdbID)) {
    return send(res, 400, { error: "A valid IMDb ID is required." });
  }

  try {
    const url = new URL(OMDB_BASE);
    url.searchParams.set("i", imdbID);
    url.searchParams.set("apikey", apiKey);
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.Response === "False") {
      return send(res, 404, { error: "OMDb ratings were not found." });
    }

    const ratings = Array.isArray(data.Ratings) ? data.Ratings : [];
    const rottenTomatoes = ratings.find(item => item.Source === "Rotten Tomatoes");
    return send(res, 200, {
      imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null,
      rottenTomatoesRating: rottenTomatoes?.Value && rottenTomatoes.Value !== "N/A" ? rottenTomatoes.Value : null
    });
  } catch (error) {
    return send(res, 502, { error: "Could not retrieve external ratings." });
  }
}
