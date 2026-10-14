const TMDB_BASE = "https://api.themoviedb.org/3";
const DAY_MS = 24 * 60 * 60 * 1000;

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  return res.status(status).json(body);
}

function getToken() {
  return process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY || "";
}

function isRecentOrFutureDate(value, today) {
  if (!value) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date >= new Date(today.getTime() - 30 * DAY_MS);
}

function upcoming(movie, today) {
  // Refresh around theatrical, digital, or physical release windows. Checking
  // all three matters when the theatrical date is old but a digital date is new.
  if (
    isRecentOrFutureDate(movie?.releaseDate, today) ||
    isRecentOrFutureDate(movie?.tmdbDigitalReleaseDate, today) ||
    isRecentOrFutureDate(movie?.tmdbPhysicalReleaseDate, today)
  ) return true;

  // Keep current/future-year movies eligible even when their stored theatrical
  // date is stale, so the job can discover a newly announced digital release.
  const year = Number(movie?.year);
  return !Number.isFinite(year) || !year || year >= today.getUTCFullYear();
}

async function tmdbReleaseDetails(id, token) {
  const url = new URL(`${TMDB_BASE}/movie/${encodeURIComponent(id)}`);
  url.searchParams.set("append_to_response", "release_dates");
  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`TMDB request failed (${response.status}).`);

  const usReleases = (data.release_dates?.results || [])
    .find(country => country.iso_3166_1 === "US")?.release_dates || [];
  const firstReleaseDateOfType = type => usReleases
    .filter(release => release.type === type && release.release_date)
    .map(release => release.release_date.slice(0, 10))
    .sort()[0] || null;

  // Match the app's US post-theatrical metadata: TMDB type 4 is digital and
  // type 5 is physical. These dates determine when a title leaves Upcoming.
  const releaseDate = data.release_date || null;
  return {
    tmdbId: data.id,
    releaseDate,
    year: releaseDate && /^\\d{4}/.test(releaseDate)
      ? Number(releaseDate.slice(0, 4))
      : (data.release_date ? Number(data.release_date.slice(0, 4)) : null),
    digitalReleaseDate: firstReleaseDateOfType(4),
    physicalReleaseDate: firstReleaseDateOfType(5)
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { error: "GET or POST required." });
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || "";
  if (!secret || authorization !== "Bearer " + secret) return send(res, 401, { error: "Unauthorized." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tmdbToken = getToken();
  if (!supabaseUrl || !serviceKey || !tmdbToken) {
    return send(res, 500, { error: "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TMDB credentials must be configured." });
  }

  try {
    const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, Accept: "application/json" };
    const stateUrl = new URL("/rest/v1/watchlist_shared_state", supabaseUrl);
    stateUrl.searchParams.set("id", "like.server:%");
    stateUrl.searchParams.set("select", "id,data,updated_at");
    const stateResponse = await fetch(stateUrl, { headers });
    const states = await stateResponse.json().catch(() => []);
    if (!stateResponse.ok) throw new Error("Could not read shared watchlists from Supabase.");

    const today = new Date();
    const detailsByTmdbId = new Map();
    const updatedStates = [];
    let checkedMovies = 0;

    for (const state of Array.isArray(states) ? states : []) {
      const stateData = state?.data && typeof state.data === "object" ? state.data : {};
      const stateMovies = Array.isArray(stateData.movies) ? stateData.movies : [];
      let changed = false;
      const nextMovies = [];

      for (const movie of stateMovies) {
        if (!movie || !upcoming(movie, today)) {
          nextMovies.push(movie);
          continue;
        }
        const tmdbId = Number(movie.tmdbId);
        if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
          nextMovies.push(movie);
          continue;
        }
        checkedMovies++;
        try {
          if (!detailsByTmdbId.has(tmdbId)) {
            detailsByTmdbId.set(tmdbId, tmdbReleaseDetails(tmdbId, tmdbToken));
          }
          const fresh = await detailsByTmdbId.get(tmdbId);
          const updated = {
            ...movie,
            tmdbId: fresh.tmdbId,
            ...(fresh.releaseDate ? { releaseDate: fresh.releaseDate } : {}),
            ...(fresh.year ? { year: fresh.year } : {}),
            tmdbDigitalReleaseDate: fresh.digitalReleaseDate,
            tmdbPhysicalReleaseDate: fresh.physicalReleaseDate
          };
          if (
            (updated.releaseDate || null) !== (movie.releaseDate || null) ||
            Number(updated.year) !== Number(movie.year) ||
            (updated.tmdbDigitalReleaseDate || null) !== (movie.tmdbDigitalReleaseDate || null) ||
            (updated.tmdbPhysicalReleaseDate || null) !== (movie.tmdbPhysicalReleaseDate || null)
          ) changed = true;
          nextMovies.push(updated);
        } catch (error) {
          console.warn("Daily TMDB release refresh skipped for", movie.title, error.message || error);
          nextMovies.push(movie);
        }
      }

      if (changed) {
        // Re-read before writing so we don't overwrite edits made while TMDB was
        // responding. If the state changed, leave it for the next daily run.
        const checkUrl = new URL("/rest/v1/watchlist_shared_state", supabaseUrl);
        checkUrl.searchParams.set("id", "eq." + state.id);
        checkUrl.searchParams.set("select", "id,updated_at");
        const checkResponse = await fetch(checkUrl, { headers });
        const current = await checkResponse.json().catch(() => []);
        if (!checkResponse.ok || current?.[0]?.updated_at !== state.updated_at) {
          updatedStates.push({ id: state.id, status: "skipped-concurrent-change" });
          continue;
        }
        const patchUrl = new URL("/rest/v1/watchlist_shared_state", supabaseUrl);
        patchUrl.searchParams.set("id", "eq." + state.id);
        const patchResponse = await fetch(patchUrl, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ data: { ...stateData, movies: nextMovies } })
        });
        if (!patchResponse.ok) throw new Error("Could not save refreshed release metadata to Supabase.");
        updatedStates.push({ id: state.id, status: "updated" });
      }
    }

    return send(res, 200, {
      ok: true,
      checkedMovies,
      uniqueTmdbMovies: detailsByTmdbId.size,
      updatedWatchlists: updatedStates.filter(x => x.status === "updated").length,
      skippedConcurrentChanges: updatedStates.filter(x => x.status === "skipped-concurrent-change").length,
      ranAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Daily release refresh failed:", error);
    return send(res, 500, { error: error instanceof Error ? error.message : "Daily release refresh failed." });
  }
}
