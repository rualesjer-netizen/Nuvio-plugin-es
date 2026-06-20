/**
 * mi-anime-es - Built from src/mi-anime-es/
 * Generated: 2026-06-20T23:24:17.277Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name8 in all)
    __defProp(target, name8, { get: all[name8], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/mi-anime-es/index.js
var mi_anime_es_exports = {};
__export(mi_anime_es_exports, {
  getStreams: () => getStreams8
});
module.exports = __toCommonJS(mi_anime_es_exports);

// src/mi-anime-es/providers/animeav1.js
var animeav1_exports = {};
__export(animeav1_exports, {
  getStreams: () => getStreams,
  name: () => name
});
var cheerio = __toESM(require("cheerio-without-node-native"));
var name = "AnimeAV1";
function getStreams(tmdbId, type, title, year, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const searchUrl = `https://animeav1.com/catalogo?search=${encodeURIComponent(title)}`;
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $ = cheerio.load(searchHtml);
      const firstResult = $("article a").first();
      const animeUrl = firstResult.attr("href");
      if (!animeUrl)
        return streams;
      const animePageResp = yield fetch(`https://animeav1.com${animeUrl}`);
      const animeHtml = yield animePageResp.text();
      const $$ = cheerio.load(animeHtml);
      let slug = null;
      let totalEpisodes = 0;
      $$("script").each((i, script) => {
        const content = $$(script).html() || "";
        const slugMatch = content.match(/slug:"([^"]+)"/);
        if (slugMatch)
          slug = slugMatch[1];
        const episodesMatch = content.match(/episodesCount:(\d+)/);
        if (episodesMatch)
          totalEpisodes = parseInt(episodesMatch[1]);
      });
      if (!slug || totalEpisodes === 0)
        return streams;
      if (type === "series") {
        if (episode > totalEpisodes)
          return streams;
        const episodeUrl = `https://animeav1.com/media/${slug}/${episode}`;
        const epResp = yield fetch(episodeUrl);
        const epHtml = yield epResp.text();
        const $$$ = cheerio.load(epHtml);
        let videoSrc = $$$("video source").attr("src");
        if (!videoSrc) {
          $$$("script").each((i, script) => {
            const content = $$$(script).html() || "";
            const match = content.match(/file:"([^"]+\.m3u8)"/);
            if (match)
              videoSrc = match[1];
          });
        }
        if (videoSrc) {
          streams.push({
            name: `AnimeAV1 - T${season}E${episode}`,
            url: videoSrc,
            quality: "HD"
          });
        }
      } else if (type === "movie") {
        const movieUrl = `https://animeav1.com/media/${slug}`;
        const movieResp = yield fetch(movieUrl);
        const movieHtml = yield movieResp.text();
        const $$$$ = cheerio.load(movieHtml);
        const videoSrc = $$$$("video source").attr("src");
        if (videoSrc) {
          streams.push({
            name: "AnimeAV1 - Pel\xEDcula",
            url: videoSrc,
            quality: "HD"
          });
        }
      }
    } catch (e) {
      console.error("Error en AnimeAV1:", e.message);
    }
    return streams;
  });
}

// src/mi-anime-es/providers/animeflv.js
var animeflv_exports = {};
__export(animeflv_exports, {
  getStreams: () => getStreams2,
  name: () => name2
});
var cheerio2 = __toESM(require("cheerio-without-node-native"));
var name2 = "AnimeFLV";
function getStreams2(tmdbId, type, title, year, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const searchUrl = `https://www3.animeflv.net/browse?q=${encodeURIComponent(title)}`;
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $ = cheerio2.load(searchHtml);
      const firstLink = $('a[href*="/anime/"]').first();
      const animeUrl = firstLink.attr("href");
      if (!animeUrl)
        return streams;
      const animeId = animeUrl.split("/").pop();
      if (type === "series") {
        const episodeUrl = `https://www3.animeflv.net/ver/${animeId}/${episode}`;
        const epResp = yield fetch(episodeUrl);
        const epHtml = yield epResp.text();
        const $$ = cheerio2.load(epHtml);
        let iframeSrc = $$("iframe#player").attr("src");
        if (!iframeSrc) {
          iframeSrc = $$(".player iframe").attr("src");
        }
        if (iframeSrc) {
          streams.push({
            name: `AnimeFLV - T${season}E${episode}`,
            url: iframeSrc,
            quality: "HD"
          });
        }
      } else if (type === "movie") {
        const movieUrl = `https://www3.animeflv.net/ver/${animeId}`;
        const movieResp = yield fetch(movieUrl);
        const movieHtml = yield movieResp.text();
        const $$ = cheerio2.load(movieHtml);
        const iframeSrc = $$("iframe#player").attr("src");
        if (iframeSrc) {
          streams.push({
            name: "AnimeFLV - Pel\xEDcula",
            url: iframeSrc,
            quality: "HD"
          });
        }
      }
    } catch (e) {
      console.error("Error en AnimeFLV:", e.message);
    }
    return streams;
  });
}

// src/mi-anime-es/providers/animejl.js
var animejl_exports = {};
__export(animejl_exports, {
  getStreams: () => getStreams3,
  name: () => name3
});
var cheerio3 = __toESM(require("cheerio-without-node-native"));
var name3 = "AnimeJL";
function getStreams3(tmdbId, type, title, year, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const searchUrl = `https://animejl.net/buscar?q=${encodeURIComponent(title)}`;
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $ = cheerio3.load(searchHtml);
      const firstLink = $('a[href*="/anime/"]').first();
      const animeUrl = firstLink.attr("href");
      if (!animeUrl)
        return streams;
      const animeSlug = animeUrl.split("/").pop();
      if (type === "series") {
        const episodeUrl = `https://animejl.net/ver/${animeSlug}/${episode}`;
        const epResp = yield fetch(episodeUrl);
        const epHtml = yield epResp.text();
        const $$ = cheerio3.load(epHtml);
        const videoSrc = $$("video source").attr("src");
        if (videoSrc) {
          streams.push({
            name: `AnimeJL - T${season}E${episode}`,
            url: videoSrc,
            quality: "HD"
          });
        }
      } else if (type === "movie") {
        const movieUrl = `https://animejl.net/ver/${animeSlug}`;
        const movieResp = yield fetch(movieUrl);
        const movieHtml = yield movieResp.text();
        const $$ = cheerio3.load(movieHtml);
        const videoSrc = $$("video source").attr("src");
        if (videoSrc) {
          streams.push({
            name: "AnimeJL - Pel\xEDcula",
            url: videoSrc,
            quality: "HD"
          });
        }
      }
    } catch (e) {
      console.error("Error en AnimeJL:", e.message);
    }
    return streams;
  });
}

// src/mi-anime-es/providers/latanime.js
var latanime_exports = {};
__export(latanime_exports, {
  getStreams: () => getStreams4,
  name: () => name4
});
var cheerio4 = __toESM(require("cheerio-without-node-native"));
var name4 = "LatAnime";
function getStreams4(tmdbId, type, title, year, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const searchUrl = `https://latanime.org/buscar?q=${encodeURIComponent(title)}`;
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $ = cheerio4.load(searchHtml);
      const firstResult = $('a[href*="/anime/"]').first();
      const animeUrl = firstResult.attr("href");
      if (!animeUrl)
        return streams;
      const animeSlug = animeUrl.split("/").pop();
      if (type === "series") {
        const episodeUrl = `https://latanime.org/ver/${animeSlug}/capitulo-${episode}`;
        const epResp = yield fetch(episodeUrl);
        const epHtml = yield epResp.text();
        const $$ = cheerio4.load(epHtml);
        const videoSrc = $$("video source").attr("src");
        if (videoSrc) {
          streams.push({
            name: `LatAnime - T${season}E${episode}`,
            url: videoSrc,
            quality: "HD"
          });
        }
      } else if (type === "movie") {
        const movieUrl = `https://latanime.org/ver/${animeSlug}`;
        const movieResp = yield fetch(movieUrl);
        const movieHtml = yield movieResp.text();
        const $$ = cheerio4.load(movieHtml);
        const videoSrc = $$("video source").attr("src");
        if (videoSrc) {
          streams.push({
            name: "LatAnime - Pel\xEDcula",
            url: videoSrc,
            quality: "HD"
          });
        }
      }
    } catch (e) {
      console.error("Error en LatAnime:", e.message);
    }
    return streams;
  });
}

// src/mi-anime-es/providers/sololatino.js
var sololatino_exports = {};
__export(sololatino_exports, {
  getStreams: () => getStreams5,
  name: () => name5
});
var cheerio5 = __toESM(require("cheerio-without-node-native"));
var name5 = "SoloLatino";
function getStreams5(tmdbId, type, title, year, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const searchUrl = `https://sololatino.net/buscar?q=${encodeURIComponent(title)}`;
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $ = cheerio5.load(searchHtml);
      const firstResult = $('a[href*="/ver/"]').first();
      const href = firstResult.attr("href");
      if (!href)
        return streams;
      const contentIdMatch = href.match(/\/(\d+)-/);
      if (!contentIdMatch)
        return streams;
      const contentId = contentIdMatch[1];
      if (type === "series") {
        const episodeUrl = `https://sololatino.net/ver/serie/${contentId}-${title.replace(/ /g, "-")}?temporada=${season}&capitulo=${episode}`;
        const epResp = yield fetch(episodeUrl);
        const epHtml = yield epResp.text();
        const $$ = cheerio5.load(epHtml);
        const iframeSrc = $$("iframe[allowfullscreen]").attr("src");
        if (iframeSrc) {
          streams.push({
            name: `SoloLatino - T${season}E${episode}`,
            url: iframeSrc,
            quality: "HD"
          });
        }
      } else if (type === "movie") {
        const movieUrl = `https://sololatino.net/ver/pelicula/${contentId}-${title.replace(/ /g, "-")}`;
        const movieResp = yield fetch(movieUrl);
        const movieHtml = yield movieResp.text();
        const $$ = cheerio5.load(movieHtml);
        const iframeSrc = $$("iframe[allowfullscreen]").attr("src");
        if (iframeSrc) {
          streams.push({
            name: "SoloLatino - Pel\xEDcula",
            url: iframeSrc,
            quality: "HD"
          });
        }
      }
    } catch (e) {
      console.error("Error en SoloLatino:", e.message);
    }
    return streams;
  });
}

// src/mi-anime-es/providers/seriesmetro.js
var seriesmetro_exports = {};
__export(seriesmetro_exports, {
  getStreams: () => getStreams6,
  name: () => name6
});
var cheerio6 = __toESM(require("cheerio-without-node-native"));
var name6 = "SeriesMetro";
function getStreams6(tmdbId, type, title, year, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const searchUrl = `https://seriesmetro.net/search/${encodeURIComponent(title)}`;
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $ = cheerio6.load(searchHtml);
      const firstResult = $('a[href*="/ver/"]').first();
      const href = firstResult.attr("href");
      if (!href)
        return streams;
      const contentIdMatch = href.match(/\/ver\/(\d+)/);
      if (!contentIdMatch)
        return streams;
      const contentId = contentIdMatch[1];
      if (type === "series") {
        const episodeUrl = `https://seriesmetro.net/ver/${contentId}-${title.replace(/ /g, "-")}?temporada=${season}&capitulo=${episode}`;
        const epResp = yield fetch(episodeUrl);
        const epHtml = yield epResp.text();
        const $$ = cheerio6.load(epHtml);
        const videoSrc = $$("video source").attr("src");
        if (videoSrc) {
          streams.push({
            name: `SeriesMetro - T${season}E${episode}`,
            url: videoSrc,
            quality: "HD"
          });
        }
      } else if (type === "movie") {
        const movieUrl = `https://seriesmetro.net/ver/${contentId}`;
        const movieResp = yield fetch(movieUrl);
        const movieHtml = yield movieResp.text();
        const $$ = cheerio6.load(movieHtml);
        const videoSrc = $$("video source").attr("src");
        if (videoSrc) {
          streams.push({
            name: "SeriesMetro - Pel\xEDcula",
            url: videoSrc,
            quality: "HD"
          });
        }
      }
    } catch (e) {
      console.error("Error en SeriesMetro:", e.message);
    }
    return streams;
  });
}

// src/mi-anime-es/providers/cinecalidad.js
var cinecalidad_exports = {};
__export(cinecalidad_exports, {
  getStreams: () => getStreams7,
  name: () => name7
});
var cheerio7 = __toESM(require("cheerio-without-node-native"));
var name7 = "Cinecalidad";
function getStreams7(tmdbId, type, title, year, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const searchUrl = `https://cinecalidad.fun/?s=${encodeURIComponent(title)}`;
      const searchResp = yield fetch(searchUrl);
      const searchHtml = yield searchResp.text();
      const $ = cheerio7.load(searchHtml);
      const firstResult = $('a[href*="/pelicula/"]').first();
      const movieUrl = firstResult.attr("href");
      if (!movieUrl)
        return streams;
      const movieSlug = movieUrl.split("/").pop();
      if (type === "movie") {
        const moviePageResp = yield fetch(movieUrl);
        const moviePageHtml = yield moviePageResp.text();
        const $$ = cheerio7.load(moviePageHtml);
        const iframe = $$('iframe[src*="player"]').first() || $$('iframe[src*="drive"]').first();
        if (iframe) {
          const iframeSrc = iframe.attr("src");
          if (iframeSrc) {
            streams.push({
              name: "Cinecalidad - Pel\xEDcula",
              url: iframeSrc,
              quality: "HD"
            });
          }
        }
      } else if (type === "series") {
        console.log("Cinecalidad no soporta series directamente.");
      }
    } catch (e) {
      console.error("Error en Cinecalidad:", e.message);
    }
    return streams;
  });
}

// src/mi-anime-es/index.js
var PROVIDERS = [
  animeav1_exports,
  animeflv_exports,
  animejl_exports,
  latanime_exports,
  sololatino_exports,
  seriesmetro_exports,
  cinecalidad_exports
];
function getStreams8(tmdbId, type, title, year, season = 1, episode = 1) {
  return __async(this, null, function* () {
    console.log(`\u{1F50D} Buscando: ${title} (${year}) - ${type} - T${season}E${episode}`);
    let allStreams = [];
    yield Promise.all(PROVIDERS.map((provider) => __async(this, null, function* () {
      try {
        const streams = yield provider.getStreams(tmdbId, type, title, year, season, episode);
        if (streams && streams.length > 0) {
          allStreams = allStreams.concat(streams);
        }
      } catch (error) {
        console.error(`\u274C Error en ${provider.name || "proveedor"}:`, error.message);
      }
    })));
    return allStreams;
  });
}
