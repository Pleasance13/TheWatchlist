const TMDB_BASE = "https://api.themoviedb.org/3";

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "https://pleasance13.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(body);
}

const WARNING_KEYWORDS = [
  ["Violence", ["violence", "violent", "fight", "fighting", "assault", "murder", "massacre", "serial killer", "shooting", "gun violence", "stabbing", "battle"]],
  ["Gore", ["gore", "graphic violence", "blood", "bloodshed", "splatter", "splatter film", "graphic death"]],
  ["Blood", ["blood", "bloodshed", "bleeding", "bloodbath"]],
  ["Torture", ["torture", "torture scene", "tortured"]],
  ["Body horror", ["body horror", "body transformation", "body mutation", "mutant", "mutation"]],
  ["Dismemberment", ["dismemberment", "decapitation", "severed head", "severed limb", "amputation"]],
  ["Weapons", ["guns", "firearms", "knife", "knives", "sword", "weapon"]],
  ["War", ["war", "war violence", "world war", "war crime"]],
  ["Animal death", ["animal death", "death of an animal", "dog dies", "dog death", "horse death", "cat death", "pet death"]],
  ["Animal cruelty", ["animal cruelty", "animal abuse", "cruelty to animals"]],
  ["Animal injury", ["animal injury", "injured animal"]],
  ["Harm to animals", ["harm to animals", "animal violence", "animal sacrifice"]],
  ["Sexual content", ["sexual content", "sex scene", "sexuality", "sexual relationship", "sexual themes"]],
  ["Nudity", ["nudity", "nude", "naked", "topless"]],
  ["Sexual assault", ["sexual assault", "sexual violence", "sexual abuse", "molestation"]],
  ["Rape", ["rape", "gang rape", "rape and revenge"]],
  ["Sexual exploitation", ["sexual exploitation", "sex trafficking", "human trafficking", "prostitution"]],
  ["Death", ["death", "dying", "terminal illness", "funeral", "murder", "execution"]],
  ["Child death", ["child death", "death of a child", "dead child", "dead children", "infanticide"]],
  ["Suicide", ["suicide", "suicidal", "suicide attempt"]],
  ["Self-harm", ["self harm", "self-harm", "cutting", "self mutilation"]],
  ["Suicide/self-harm", ["suicide", "self harm", "self-harm", "suicide attempt"]],
  ["Drug use", ["drug use", "drug addiction", "drug abuse", "cocaine", "heroin", "methamphetamine", "drug dealing", "marijuana", "substance abuse"]],
  ["Drug overdose", ["overdose", "drug overdose", "overdosing"]],
  ["Child abuse", ["child abuse", "child neglect", "pedophilia", "child molestation"]],
  ["Disturbing imagery", ["disturbing", "nightmare", "nightmares", "psychological horror", "hallucination", "hallucinations", "nightmarish imagery"]],
  ["Medical trauma", ["medical horror", "medical trauma", "surgery", "medical procedure", "disease", "cancer"]],
  ["Abduction/kidnapping", ["kidnapping", "abduction", "hostage", "captivity"]],
  ["Psychological distress", ["psychological trauma", "psychological abuse", "mental breakdown", "panic attack", "psychological thriller"]]
];

function classifyWarnings(keywordRecords = []) {
  const names = keywordRecords.map(item => String(item.name || "").toLowerCase().replace(/[^a-z0-9 -]/g, " "));
  const warnings = new Set();
  for (const [category, terms] of WARNING_KEYWORDS) {
    if (names.some(name => terms.some(term => name.includes(term)))) warnings.add(category);
  }
  return [...warnings];
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

      // Preserve TMDB's relevance-ranked search results. Re-sorting by
      // popularity can push an unrelated, similarly named title ahead of
      // the exact title the user searched for (e.g. "Ben 10" for "The Ten").
      const ordered = (data.results || []).slice(0, 8);

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

      const [movie, images, credits, videos, providers, externalIds, releaseDates, keywordData] = await Promise.all([
        tmdbFetch(`/movie/${id}`),
        tmdbFetch(`/movie/${id}/images`, { include_image_language: "en,null" }),
        tmdbFetch(`/movie/${id}/credits`),
        tmdbFetch(`/movie/${id}/videos`, { language: "en-US" }).catch(() => ({ results: [] })),
        tmdbFetch(`/movie/${id}/watch/providers`).catch(() => ({ results: {} })),
        tmdbFetch(`/movie/${id}/external_ids`).catch(() => ({})),
        tmdbFetch(`/movie/${id}/release_dates`).catch(() => ({ results: [] })),
        tmdbFetch(`/movie/${id}/keywords`).catch(() => ({ keywords: [] }))
      ]);

      const usReleases = (releaseDates.results || []).find(country => country.iso_3166_1 === "US");
      const usCertifications = (usReleases?.release_dates || []).filter(release => release.certification).sort((a, b) => {
        const preferred = date => date.type === 3 ? 0 : date.type === 2 ? 1 : 2;
        return preferred(a) - preferred(b);
      });
      const certification = usCertifications[0]?.certification || (releaseDates.results || []).flatMap(country => country.release_dates || []).find(release => release.certification)?.certification || null;

      const cast = (credits.cast || []).slice(0, 12).map(person => ({
        id: person.id,
        name: person.name,
        character: person.character || "",
        profilePath: person.profile_path || null
      }));
      const trailer = (videos.results || []).find(video =>
        video.site === "YouTube" && video.type === "Trailer" && video.official
      ) || (videos.results || []).find(video =>
        video.site === "YouTube" && video.type === "Trailer"
      ) || (videos.results || []).find(video =>
        video.site === "YouTube" && video.type === "Teaser"
      );
      const providerResults = providers.results || {};
      const region = String(req.query.region || "US").toUpperCase();
      const regionProviders = providerResults[region] || {};
      const streaming = ["flatrate", "free", "ads", "rent", "buy"].flatMap(kind =>
        (regionProviders[kind] || []).map(provider => ({
          id: provider.provider_id,
          name: provider.provider_name,
          logoPath: provider.logo_path || null,
          type: kind
        }))
      ).filter((provider, index, all) =>
        all.findIndex(other => other.id === provider.id && other.type === provider.type) === index
      );

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
        rating: certification,
        synopsis: movie.overview || "",
        warnings: classifyWarnings(keywordData.keywords || keywordData.results || []),
        cast,
        trailer: trailer ? { name: trailer.name, key: trailer.key, site: trailer.site } : null,
        streaming,
        streamingLink: regionProviders.link || null,
        streamingRegion: region,
        imdbId: externalIds.imdb_id || null,
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
