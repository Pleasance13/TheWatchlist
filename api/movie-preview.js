const TMDB_BASE = "https://api.themoviedb.org/3";

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
));

function formatRuntime(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function truncate(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

async function loadMovie(tmdbId) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY || "";
  if (!token) return null;
  const url = new URL(`${TMDB_BASE}/movie/${tmdbId}`);
  url.searchParams.set("append_to_response", "credits");
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  if (!response.ok) return null;
  return response.json();
}

function previewTags(movie, pageUrl) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "";
  const directors = (movie.credits?.crew || [])
    .filter(person => person.job === "Director").map(person => person.name);
  const facts = [
    year,
    directors.length ? "Directed by " + directors.join(", ") : "",
    formatRuntime(movie.runtime)
  ].filter(Boolean).join(" · ");
  const description = [facts, truncate(movie.overview, 300)].filter(Boolean).join("\n\n");
  const title = movie.title + (year ? ` (${year})` : "");
  const imagePath = movie.poster_path || movie.backdrop_path;
  const image = imagePath ? `https://image.tmdb.org/t/p/w500${imagePath}` : "";

  return [
    `<meta property="og:type" content="video.movie">`,
    `<meta property="og:site_name" content="The Watchlist">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : "",
    `<meta name="theme-color" content="#e65d54">`
  ].filter(Boolean).join("\n");
}

export default async function handler(req, res) {
  const origin = `https://${req.headers.host}`;
  const indexResponse = await fetch(origin + "/index.html");
  if (!indexResponse.ok) return res.status(502).send("Could not load The Watchlist.");
  let html = await indexResponse.text();

  const match = /^tmdb-(\d{1,9})$/.exec(String(req.query.movie || ""));
  if (match) {
    try {
      const movie = await loadMovie(match[1]);
      if (movie?.title) {
        const pageUrl = `${origin}/?movie=tmdb-${match[1]}`;
        html = html.replace("</head>", previewTags(movie, pageUrl) + "\n</head>");
      }
    } catch (error) {
      console.warn("Movie preview lookup failed:", error.message || error);
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(html);
}
