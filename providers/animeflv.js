const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://www3.animeflv.net";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/"
};

const SKIP_HOSTS = [
    "streamwish.to", "awish.pro", "sfastwish.com", "wishfast.top", "strwish.com",
    "hanerix.com", "embedsb.com", "streamsb.net", "sbplay.org", "hqq.tv",
    "my.mail.ru", "terabox.com", "1fichier.com", "mixdrop.ps", "mixdrop.ag",
    "filelions.top", "luluvdo.com", "lulustream.com", "zippyshare.com",
];

function cleanTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

async function fetchText(url, headers = HEADERS) {
    try {
        const resp = await fetch(url, { headers });
        if (resp.status === 404) return "DEAD";
        const text = await resp.text();
        const lower = text.toLowerCase();
        if (
            lower.includes("file was deleted") ||
            lower.includes("no longer exists") ||
            lower.includes("file not found") ||
            lower.includes("content restricted") ||
            lower.includes("file was locked") ||
            text.length < 100
        ) return "DEAD";
        return text;
    } catch (e) {
        return null;
    }
}

async function getTmdbTitles(tmdbId, type, season) {
    let titleEsES = null;
    let titleEsMX = null;
    let titleOriginal = null;
    let titleEn = null;

    try {
        const r = await fetch(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=es-ES`
        ).then(r => r.json());
        titleEsES = type === "movie" ? r.title : r.name;
        titleOriginal = type === "movie" ? r.original_title : r.original_name;
    } catch (e) {}

    try {
        const r = await fetch(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=es-MX`
        ).then(r => r.json());
        titleEsMX = type === "movie" ? r.title : r.name;
    } catch (e) {}

    try {
        const r = await fetch(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`
        ).then(r => r.json());
        titleEn = type === "movie" ? r.title : r.name;
    } catch (e) {}

    if (type === "tv" && season > 1) {
        try {
            const r = await fetch(
                `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}&language=es-MX`
            ).then(r => r.json());
            if (r.name && r.name !== `Temporada ${season}` && r.name !== `Season ${season}`) {
                titleEsMX = r.name;
            }
        } catch (e) {}
        try {
            const r = await fetch(
                `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}&language=en-US`
            ).then(r => r.json());
            if (r.name && r.name !== `Season ${season}`) {
                titleEn = r.name;
            }
        } catch (e) {}
    }

    return { titleEsES, titleEsMX, titleOriginal, titleEn };
}

function generateQueries(info) {
    const queries = [];
    const add = (q) => {
        if (!q) return;
        const clean = q.replace(/[,;.:!?]/g, "").replace(/\s+/g, " ").trim();
        if (!queries.includes(clean)) queries.push(clean);
    };
    add(info.titleOriginal);
    add(info.titleEn);
    add(info.titleEsMX);
    if (info.titleEsES !== info.titleEsMX) add(info.titleEsES);
    return queries;
}

async function searchOnSite(query) {
    try {
        const url = `${BASE_URL}/browse?q=${encodeURIComponent(query)}`;
        const html = await fetchText(url);
        if (!html || html === "DEAD") return [];

        const results = [];

        const liRe = /<li[\s\S]*?<\/li>/g;
        let liMatch;
        while ((liMatch = liRe.exec(html)) !== null) {
            const li = liMatch[0];
            const hrefMatch = li.match(/href="\/anime\/([^"]+)"/);
            const titleMatch = li.match(/<h3[^>]*>([^<]+)<\/h3>/);
            const typeMatch = li.match(/class="Type[^"]*">([^<]+)<\/span>/);
            if (hrefMatch && titleMatch) {
                results.push({
                    slug: hrefMatch[1].trim(),
                    title: titleMatch[1].trim(),
                    type: typeMatch ? typeMatch[1].trim() : ""
                });
            }
        }
        return results;
    } catch (e) {
        console.warn(`[AnimeFLV] Search error for "${query}": ${e.message}`);
        return [];
    }
}

async function findAnime(tmdbId, mediaType, season) {
    const info = await getTmdbTitles(tmdbId, mediaType, season);
    if (!info.titleEsES && !info.titleEsMX && !info.titleOriginal && !info.titleEn) return null;

    const queries = generateQueries(info);
    let matchedAnime = null;
    let bestScore = -1;

    for (const q of queries) {
        console.warn(`[AnimeFLV] Searching: "${q}"`);
        const results = await searchOnSite(q);

        for (const res of results) {
            let score = 0;
            const cleanedResult = cleanTitle(res.title);
            const matchTitles = [
                info.titleOriginal, info.titleEn, info.titleEsMX, info.titleEsES
            ].filter(Boolean);

            for (const t of matchTitles) {
                const ct = cleanTitle(t);
                if (cleanedResult === ct) {
                    score = Math.max(score, 100);
                } else if (cleanedResult.includes(ct) || ct.includes(cleanedResult)) {
                    score = Math.max(score, 50);
                }
            }

            const normType = res.type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const isPelicula = normType.includes("pelicula") || normType.includes("movie");
            const isEspecial = normType.includes("especial") || normType.includes("ova");
            if (mediaType === "movie" && isPelicula) {
                score += 15;
            } else if (mediaType === "movie" && isEspecial) {
                score += 5;
            } else if (mediaType === "movie" && !isPelicula && !isEspecial) {
                score = Math.max(score - 20, 0);
            } else if (mediaType === "tv" && !isPelicula && !isEspecial) {
                score += 10;
            }

            console.warn(`  → "${res.title}" (${res.type}) Score: ${score}`);
            if (score > bestScore && score >= 40) {
                bestScore = score;
                matchedAnime = res;
            }
        }

        if (bestScore >= 100) break;
    }

    return matchedAnime;
}

async function getAnimeSlug(animeSlug) {
    try {
        const url = `${BASE_URL}/anime/${animeSlug}`;
        const html = await fetchText(url);
        if (!html || html === "DEAD") return null;

        const epMatch = html.match(/var episodes = (\[\[.*?\]\])/s);
        if (!epMatch) return null;

        const episodes = JSON.parse(epMatch[1]);
        return {
            slug: animeSlug,
            episodes: episodes.map(ep => ep[0])
        };
    } catch (e) {
        console.warn(`[AnimeFLV] Error getting anime slug: ${e.message}`);
        return null;
    }
}

async function getEpisodeServers(animeSlug, epNumber) {
    try {
        const url = `${BASE_URL}/ver/${animeSlug}-${epNumber}`;
        console.warn(`[AnimeFLV] Fetching episode: ${url}`);
        const html = await fetchText(url);
        if (!html || html === "DEAD") return [];

        const videosMatch = html.match(/var videos = (\{.*?\});/s);
        if (!videosMatch) {
            console.warn("[AnimeFLV] No se encontró var videos en la página");
            return [];
        }

        const videosObj = JSON.parse(videosMatch[1]);
        const servers = [];

        const subServers = videosObj.SUB || [];
        for (const s of subServers) {
            if (!s.title || (!s.url && !s.code)) continue;
            const embedUrl = (s.code || s.url || "")
                .replace("mega.nz/embed#!", "mega.nz/embed/")
                .replace("mega.nz/#!", "mega.nz/file/");
            const downloadUrl = (s.url || "")
                .replace("mega.nz/#!", "mega.nz/file/");
            servers.push({
                title: s.title,
                embed: embedUrl,
                download: downloadUrl,
                dub: false
            });
        }

        const dubServers = videosObj.DUB || [];
        for (const s of dubServers) {
            if (!s.title || (!s.url && !s.code)) continue;
            const embedUrl = (s.code || s.url || "")
                .replace("mega.nz/embed#!", "mega.nz/embed/")
                .replace("mega.nz/#!", "mega.nz/file/");
            const downloadUrl = (s.url || "")
                .replace("mega.nz/#!", "mega.nz/file/");
            servers.push({
                title: s.title,
                embed: embedUrl,
                download: downloadUrl,
                dub: true
            });
        }

        console.warn(`[AnimeFLV] Found ${servers.length} servers`);
        return servers;
    } catch (e) {
        console.warn(`[AnimeFLV] Error getting servers: ${e.message}`);
        return [];
    }
}

function unpackJs(html) {
    const packed = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]+?\.split\('\|'\)\)\)/);
    if (!packed) return html;
    const m = packed[0].match(/\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)\)/);
    if (!m) return html;
    let [, p, a, , k] = m;
    a = parseInt(a);
    k = k.split("|");
    const alpha = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const enc = (i, b) => i < b ? alpha[i] : enc(Math.floor(i / b), b) + alpha[i % b];
    for (let i = k.length - 1; i >= 0; i--) {
        if (k[i]) p = p.replace(new RegExp("\\b" + enc(i, a) + "\\b", "g"), k[i]);
    }
    return p;
}

async function resolveMp4Upload(embedUrl) {
    try {
        const idMatch = embedUrl.match(/mp4upload\.com\/(embed-|)([A-Za-z0-9]*)/);
        const realUrl = idMatch
            ? `https://www.mp4upload.com/embed-${idMatch[2]}.html`
            : embedUrl;
        const html = await fetchText(realUrl, { "Referer": embedUrl, "User-Agent": UA });
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const text = unpackJs(html);
        const mp4 = text.match(/player\.src\("([^"]+)"/) ||
                    text.match(/player\.src\([\s\S]*?src:\s*"([^"]+)"/);
        if (!mp4) return null;
        return {
            url: mp4[1],
            quality: "1080p",
            headers: { "Referer": realUrl, "User-Agent": UA }
        };
    } catch (e) {
        return null;
    }
}

async function resolveStreamtape(embedUrl) {
    try {
        const html = await fetchText(embedUrl, { ...HEADERS, "Referer": BASE_URL + "/" });
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const linkMatch = html.match(
            /getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*(['"][^'"]+['"])\s*\+\s*\((['"][^'"]+['"])\)(?:\.substring\((\d+)\))?/
        );
        if (linkMatch) {
            const prefix = linkMatch[1].replace(/['"]/g, "");
            let main = linkMatch[2].replace(/['"]/g, "");
            if (linkMatch[3]) main = main.substring(parseInt(linkMatch[3]));
            const path = prefix + main;
            const finalUrl = path.startsWith("//")
                ? "https:" + path
                : "https://streamtape.com" + (path.startsWith("/") ? "" : "/") + path;
            return {
                url: finalUrl,
                quality: "720p",
                headers: { "Referer": embedUrl, "User-Agent": UA }
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function resolveVoe(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i) ||
                  html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m) {
            return {
                url: m[1],
                quality: "1080p",
                headers: { "Referer": embedUrl, "User-Agent": UA }
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function resolveOkRu(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/videoUrl\s*=\s*"([^"]+)"/i) ||
                  html.match(/"url"\s*:\s*"([^"]+\.mp4[^"]*)"/i);
        if (m) {
            return {
                url: m[1].replace(/\\/g, ""),
                quality: "720p",
                headers: { "Referer": embedUrl, "User-Agent": UA }
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function resolveYourUpload(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/property\s*=\s*"og:video"[\s\S]*?content\s*=\s*"([^"]+)"/i);
        if (m) {
            return {
                url: m[1],
                quality: "720p",
                headers: { "Referer": embedUrl, "User-Agent": UA }
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function resolveFilemoon(embedUrl) {
    try {
        const urlObj = new URL(embedUrl);
        const videoId = urlObj.pathname.split("/").filter(Boolean).pop();
        if (!videoId) return null;
        const detailsRes = await fetch(
            `https://${urlObj.hostname}/api/videos/${videoId}/embed/details`,
            { headers: { "X-Requested-With": "XMLHttpRequest", "Referer": embedUrl, "User-Agent": UA } }
        );
        const details = await detailsRes.json();
        if (!details.embed_frame_url) return null;
        const pd = new URL(details.embed_frame_url).origin;
        const ch = await (await fetch(
            `${pd}/api/videos/access/challenge`,
            { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA } }
        )).json();
        if (!ch.challenge_id) return null;
        const vid = Math.random().toString(36).substring(2, 15);
        const did = Math.random().toString(36).substring(2, 15);
        const att = await (await fetch(
            `${pd}/api/videos/access/attest`,
            {
                method: "POST",
                body: JSON.stringify({
                    viewer_id: vid, device_id: did,
                    challenge_id: ch.challenge_id, nonce: ch.nonce,
                    signature: "MEUCIQDYi5fX9gG8_5t_4v8p_Q8o8l5v8v8v8v8v8v8v8v8v",
                    public_key: { kty: "EC", crv: "P-256", x: "thRcTF9d89tZ704lTYciJq48dtIaoqf9L0Is1gK29II", y: "v8Oo5z9N9406uE4RnU3dlmpbAaMQtt61uynn6kgz4_Q" },
                    client: { user_agent: UA, platform: "Windows", languages: ["es-ES"] },
                    storage: { cookie: vid, local_storage: vid },
                    attributes: { entropy: "high" }
                }),
                headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA }
            }
        )).json();
        if (!att.token) return null;
        const play = await (await fetch(
            `${pd}/api/videos/${videoId}/embed/playback`,
            {
                method: "POST",
                body: JSON.stringify({ fingerprint: { token: att.token, viewer_id: att.viewer_id || vid, device_id: att.device_id || did, confidence: att.confidence } }),
                headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA }
            }
        )).json();
        const src = play?.playback?.sources?.[0]?.url;
        if (!src) return null;
        return {
            url: src,
            quality: "1080p",
            headers: { "User-Agent": UA, "Referer": pd, "Origin": pd }
        };
    } catch (e) {
        return null;
    }
}

async function resolveEmbed(serverName, embedUrl) {
    if (!embedUrl) return null;
    if (embedUrl.includes("mega.nz") || embedUrl.includes("mega.co")) return null;

    try {
        const embedHost = new URL(embedUrl).hostname;
        if (SKIP_HOSTS.some(h => embedHost.includes(h))) {
            console.warn(`[AnimeFLV] Skipping host: ${embedHost}`);
            return null;
        }
    } catch (_) {}

    const name = serverName.toLowerCase();
    const url = embedUrl.toLowerCase();

    if (name.includes("mp4upload") || url.includes("mp4upload.com")) {
        return await resolveMp4Upload(embedUrl);
    }
    if (name.includes("streamtape") || url.includes("streamtape.com")) {
        return await resolveStreamtape(embedUrl);
    }
    if (name.includes("voe") || url.includes("voe.sx")) {
        return await resolveVoe(embedUrl);
    }
    if (name.includes("ok") || url.includes("ok.ru") || url.includes("odnoklassniki")) {
        return await resolveOkRu(embedUrl);
    }
    if (name.includes("yourupload") || url.includes("yourupload.com")) {
        return await resolveYourUpload(embedUrl);
    }
    if (name.includes("filemoon") || url.includes("filemoon")) {
        return await resolveFilemoon(embedUrl);
    }

    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m3u8) return { url: m3u8[1], quality: "HD", headers: { "Referer": embedUrl, "User-Agent": UA } };
        const mp4 = html.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
        if (mp4) return { url: mp4[1], quality: "HD", headers: { "Referer": embedUrl, "User-Agent": UA } };
    } catch (e) {}

    return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const seasonNum = parseInt(season) || 1;
    const epNum = parseInt(episode) || 1;

    console.warn(`[AnimeFLV] TMDB: ${tmdbId} | T${seasonNum}E${epNum}`);

    const matchedAnime = await findAnime(tmdbId, mediaType, seasonNum);
    if (!matchedAnime) {
        console.warn("[AnimeFLV] No se encontró el anime");
        return [];
    }
    console.warn(`[AnimeFLV] Match: "${matchedAnime.title}" → ${matchedAnime.slug}`);

    const servers = await getEpisodeServers(matchedAnime.slug, epNum);
    if (!servers.length) {
        console.warn("[AnimeFLV] Sin servidores para este episodio");
        return [];
    }

    const streams = [];
    for (const server of servers) {
        const embedUrl = server.embed || server.download;
        if (!embedUrl) continue;

        console.warn(`[AnimeFLV] Resolviendo: ${server.title} → ${embedUrl}`);
        const resolved = await resolveEmbed(server.title, embedUrl);

        if (!resolved || resolved === "DEAD") continue;

        if (resolved?.url) {
            streams.push({
                name: "AnimeFLV",
                title: `${server.title}${server.dub ? " · DUB" : " · SUB"}`,
                url: resolved.url,
                quality: resolved.quality || "HD",
                headers: resolved.headers || HEADERS
            });
        }
    }

    console.warn(`[AnimeFLV] ${streams.length} streams encontrados`);
    return streams;
}

module.exports = { getStreams };
