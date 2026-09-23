const TMDB_BASE = "https://api.themoviedb.org/3";

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "https://pleasance13.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(body);
}

function getToken() {
  return process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_API_KEY || "";
}

function tmdbUrl(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  return url;
}

async function tmdbFetch(path, params = {}) {
  const token = getToken();
  if (!token) throw new Error("TMDB credential is not configured on the server.");

  const response = await fetch(tmdbUrl(path, params), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.status_message || `TMDB request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default async function handler(req, res) {
  const action = req.query.action;

  res.setHeader("Access-Control-Allow-Origin", "https://pleasance13.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (req.method !== "GET") return send(res, 405, { error: "GET only." });

    if (action === "search") {
      const query = String(req.query.query || "").trim();
      if (!query) return send(res, 400, { error: "A search query is required." });

      const page = Math.max(1, Number(req.query.page) || 1);
      const data = await tmdbFetch("/search/movie", {
        query,
        page,
        include_adult: "false",
        language: "en-US"
      });

      // Keep TMDB's relevance ordering within each language group, but put
      // English-language movies first so mixed-language searches don't get
      // dominated by unrelated non-English matches.
      const ordered = (data.results || []).slice().sort((a, b) => {
        const aEnglish = a.original_language === "en" ? 1 : 0;
        const bEnglish = b.original_language === "en" ? 1 : 0;
        if (aEnglish !== bEnglish) return bEnglish - aEnglish;
        return (b.popularity || 0) - (a.popularity || 0);
      }).slice(0, 8);

      const results = await Promise.all(ordered.map(async movie => {
        let images = {};
        try {
          images = await tmdbFetch(`/movie/${movie.id}/images`, {
            include_image_language: "en,null"
          });
        } catch (error) {
          // Artwork is optional; the search result still works with TMDB's
          // standard poster if the image request fails.
        }

        const logos = (images.logos || [])
          .slice()
          .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        const logo = logos.find(item => item.iso_639_1 === "en")
          || logos.find(item => item.iso_639_1 === null)
          || logos[0]
          || null;

        const textlessPosters = (images.posters || [])
          .filter(item => item.iso_639_1 === null)
          .slice()
          .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        const textlessPoster = textlessPosters[0] || null;

        return {
          tmdbId: movie.id,
          title: movie.title,
          originalTitle: movie.original_title,
          originalLanguage: movie.original_language || null,
          year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
          releaseDate: movie.release_date || null,
          posterPath: movie.poster_path || null,
          textlessPosterPath: textlessPoster ? textlessPoster.file_path : null,
          logoPath: logo ? logo.file_path : null,
          backdropPath: movie.backdrop_path || null,
          synopsis: movie.overview || "",
          popularity: movie.popularity || 0
        };
      }));

      return send(res, 200, {
        results,
        page: data.page || page,
        totalPages: data.total_pages || 1,
        totalResults: data.total_results || 0
      });
    }

    if (action === "details") {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return send(res, 400, { error: "A valid TMDB movie id is required." });

      const [movie, images, credits] = await Promise.all([
        tmdbFetch(`/movie/${id}`),
        tmdbFetch(`/movie/${id}/images`, { include_image_language: "en,null" }),
        tmdbFetch(`/movie/${id}/credits`)
      ]);

      const directors = (credits.crew || [])
        .filter(person => person.job === "Director")
        .map(person => person.name);

      const logos = (images.logos || [])
        .slice()
        .sort((a, b) => (a.vote_average || 0) - (b.vote_average || 0))
        .reverse();

      const logo = logos.find(item => item.iso_639_1 === "en")
        || logos.find(item => item.iso_639_1 === null)
        || logos[0]
        || null;

      // TMDB often provides textless poster variants as posters with no
      // language tag. Prefer the highest-rated one when available.
      const textlessPosters = (images.posters || [])
        .filter(item => item.iso_639_1 === null)
        .slice()
        .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      const textlessPoster = textlessPosters[0] || null;

      return send(res, 200, {
        tmdbId: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
        releaseDate: movie.release_date || null,
        genre: (movie.genres || []).map(g => g.name),
        director: directors,
        runtime: movie.runtime || null,
        rating: movie.certification || null,
        synopsis: movie.overview || "",
        posterPath: movie.poster_path || null,
        textlessPosterPath: textlessPoster ? textlessPoster.file_path : null,
        backdropPath: movie.backdrop_path || null,
        logoPath: logo ? logo.file_path : null,
        logoWidth: logo ? logo.width : null,
        logoHeight: logo ? logo.height : null,
        logos: (images.logos || []).map(item => ({
          filePath: item.file_path,
          isoLanguage: item.iso_639_1 || null,
          width: item.width || null,
          height: item.height || null,
          voteAverage: item.vote_average || 0
        })),
        posters: (images.posters || []).map(item => ({
          filePath: item.file_path,
          isoLanguage: item.iso_639_1 || null,
          width: item.width || null,
          height: item.height || null,
          voteAverage: item.vote_average || 0
        })),
        backdrops: (images.backdrops || []).map(item => ({
          filePath: item.file_path,
          isoLanguage: item.iso_639_1 || null,
          width: item.width || null,
          height: item.height || null,
          voteAverage: item.vote_average || 0
        }))
      });
    }

    return send(res, 400, { error: "Unknown TMDB action." });
  } catch (error) {
    const status = Number(error.status) || 500;
    return send(res, status, { error: error.message || "TMDB request failed." });
  }
}
