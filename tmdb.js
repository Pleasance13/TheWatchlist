/*
 * TMDB integration foundation.
 *
 * The browser talks only to our own /api/tmdb endpoint. The TMDB credential
 * stays server-side and is never committed to the repository.
 *
 * Expected server endpoint:
 *   /api/tmdb?action=search&query=Alien
 *   /api/tmdb?action=details&id=348
 */

const TMDB = {
  endpoint: window.WATCHLIST_TMDB_ENDPOINT || (location.hostname.endsWith("github.io") ? "https://the-watchlist-two.vercel.app/api/tmdb" : "/api/tmdb"),
  imageBase: "https://image.tmdb.org/t/p/",

  image(path, size = "w500") {
    return path ? this.imageBase + size + path : "";
  },

  async request(params) {
    const url = new URL(this.endpoint, window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "TMDB request failed.");
    return data;
  },

  search(query, page = 1) {
    return this.request({ action: "search", query, page });
  },

  details(id) {
    return this.request({ action: "details", id });
  },

  apply(movie, data) {
    if (!data) return movie;

    movie.tmdbId = data.tmdbId;
    movie.posterPath = data.posterPath || movie.posterPath || null;
    movie.textlessPosterPath = data.textlessPosterPath || movie.textlessPosterPath || null;
    movie.backdropPath = data.backdropPath || movie.backdropPath || null;
    movie.logoPath = data.logoPath || movie.logoPath || null;

    if (data.title) movie.title = data.title;
    if (data.year) movie.year = data.year;
    if (data.genre?.length) movie.genre = data.genre.join(" · ");
    if (data.director?.length) movie.director = data.director.join(", ");
    if (data.runtime) movie.runtime = formatRuntime(data.runtime);
    if (data.rating) movie.rating = data.rating;
    if (data.synopsis) movie.synopsis = data.synopsis;

    return movie;
  }
};

function formatRuntime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

window.TMDB = TMDB;
