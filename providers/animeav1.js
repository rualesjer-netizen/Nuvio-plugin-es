const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE = "https://animeav1.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": USER_AGENT,
    "Referer": BASE + "/"
};

async function getTMDBSeasonTitle(tmdbId, mediaType, season) {
    try {
        if (mediaType === "movie") {
            const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json());
            return res.title || res.original_title || null;
        }
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json());
        if (res.name && res.name !== `Temporada ${season}` && res.name !== `Season ${season}`) {
            return res.name;
        }
        const series = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`).then(r => r.json());
        return series.name || series.original_name || null;
    } catch (e) {
        console.warn(`[AnimeAV1] TMDB Error: ${e.message}`);
        return null;
    }
}

async function searchAnime(title) {
    try {
        const html = await fetch(`${BASE}/catalogo?search=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
        const results = [];
        const re = /href="(\/media\/[^/"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            results.push({ path: m[1], name: m[2].trim() });
        }
        if (!results.length) {
            const simple = html.match(/href="(\/media\/[^/"]+)"/);
            return simple ? simple[1] : null;
        }
        const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const cleanTitle = clean(title);
        const exact = results.find(r => clean(r.name) === cleanTitle);
        if (exact) return exact.path;
        const partial = results.find(r => clean(r.name).includes(cleanTitle) || cleanTitle.includes(clean(r.name)));
        if (partial) return partial.path;
        return results[0].path;
    } catch (e) {
        console.warn(`[AnimeAV1] Search error: ${e.message}`);
        return null;
    }
}

function extractEmbeds(html) {
    const script = html.match(/<script[^>]*>([\s\S]*?__sveltekit[\s\S]*?)<\/script>/);
    if (!script) return [];
    const embedsData = script[1].match(/embeds:\{([\s\S]*?)\},downloads/);
    if (!embedsData) return [];
    const embeds = [];
    const re = /\{server:"([^"]+)",\s*url:"([^"]+)"/g;
    let m;
    while ((m = re.exec(embedsData[1])) !== null) {
        let url = m[2];
        if (url.startsWith("//")) url = "https:" + url;
        if (url.startsWith("http")) embeds.push({ server: m[1], url });
    }
    return embeds;
}

async function resolvePlayerZilla(url) {
    const id = url.split("/").pop();
    return {
        url: `https://player.zilla-networks.com/m3u8/${id}`,
        quality: "1080p",
        headers: { "Referer": url, "User-Agent": USER_AGENT }
    };
}

async function resolveMp4Upload(url) {
    try {
        const idMatch = url.match(/mp4upload\.com\/(embed-|)([A-Za-z0-9]*)/);
        const realUrl = idMatch ? `https://www.mp4upload.com/embed-${idMatch[2]}.html` : url;
        const html = await fetch(realUrl, { headers: { "Referer": url, "User-Agent": USER_AGENT } }).then(r => r.text());
        const packed = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]+?\.split\('\|'\)\)\)/);
        let text = html;
        if (packed) {
            const m = packed[0].match(/\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)\)/);
            if (m) {
                let [, p, a, , k] = m;
                a = parseInt(a); k = k.split("|");
                const alpha = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const enc = (i, b) => i < b ? alpha[i] : enc(Math.floor(i / b), b) + alpha[i % b];
                for (let i = k.length - 1; i >= 0; i--) {
                    if (k[i]) p = p.replace(new RegExp("\\b" + enc(i, a) + "\\b", "g"), k[i]);
                }
                text = p;
            }
        }
        const mp4 = text.match(/player\.src\("([^"]+)"/) || text.match(/player\.src\([\s\S]*?src:\s*"([^"]+)"/);
        if (!mp4) return null;
        return { url: mp4[1], quality: "1080p", headers: { "Referer": realUrl, "User-Agent": USER_AGENT } };
    } catch (e) {
        return null;
    }
}

async function resolveEmbed(url) {
    const s = url.toLowerCase();
    if (s.includes("zilla-networks.com")) return await resolvePlayerZilla(url);
    if (s.includes("mp4upload.com")) return await resolveMp4Upload(url);
    return null;
}

async function getStreams(tmdbId, mediaType, season, episode, title) {
    const seasonNum = parseInt(season) || 1;
    const epNum = parseInt(episode) || 1;

    let searchTitle = title;
    const tmdbTitle = await getTMDBSeasonTitle(tmdbId, mediaType, seasonNum);
    if (tmdbTitle) searchTitle = tmdbTitle;

    if (!searchTitle) return [];

    try {
        const animePath = await searchAnime(searchTitle);
        if (!animePath) return [];

        const epUrl = mediaType === "tv" ? `${BASE}${animePath}/${epNum}` : `${BASE}${animePath}`;
        const epHtml = await fetch(epUrl, { headers: HEADERS }).then(r => r.text());

        const embeds = extractEmbeds(epHtml);
        if (!embeds.length) return [];

        const streams = [];
        for (const embed of embeds) {
            try {
                const resolved = await resolveEmbed(embed.url);
                if (!resolved) continue;
                streams.push({
                    name: "AnimeAV1",
                    title: `${embed.server} - T${seasonNum}E${epNum}`,
                    url: resolved.url,
                    quality: resolved.quality || "HD",
                    headers: resolved.headers || HEADERS
                });
            } catch (e) {}
        }

        return streams;
    } catch (err) {
        console.warn(`[AnimeAV1] Error: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
