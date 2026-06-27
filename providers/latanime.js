const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://latanime.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": BASE_URL + "/"
};

const SKIP_HOSTS = [
    "terabox.com", "1fichier.com", "zippyshare.com",
    "mixdrop.ps", "mixdrop.ag", "mega.nz", "mega.co"
];

// Mapeo de servidores igual que el Kotlin (conventions)
const SERVER_CONVENTIONS = [
    { key: "voe",        patterns: ["voe", "tubelessceliolymph", "simpulumlamerop", "urochsunloath", "nathanfromsubject", "yip.", "metagnathtuggers"] },
    { key: "okru",       patterns: ["ok.ru", "okru"] },
    { key: "filemoon",   patterns: ["filemoon", "moonplayer", "moviesm4u", "files.im"] },
    { key: "mp4upload",  patterns: ["mp4upload", "mp4"] },
    { key: "uqload",     patterns: ["uqload"] },
    { key: "doodstream", patterns: ["doodstream", "dood.", "ds2play", "doods.", "ds2video", "dooood", "d000d"] },
    { key: "yourupload", patterns: ["yourupload", "upload"] },
    { key: "streamwish", patterns: ["wishembed", "streamwish", "strwish", "wish", "swdyu", "iplayerhls", "streamgg"] },
    { key: "vidguard",   patterns: ["vembed", "guard", "listeamed", "bembed", "vgfplay"] },
    { key: "mixdrop",    patterns: ["mixdrop", "mxdrop"] },
];

function detectServer(url, serverTitle) {
    const urlLower = url.toLowerCase();
    const titleLower = serverTitle.toLowerCase();
    for (const conv of SERVER_CONVENTIONS) {
        if (conv.patterns.some(p => urlLower.includes(p) || titleLower.includes(p))) {
            return conv.key;
        }
    }
    return "generic";
}

// ── UTILS ─────────────────────────────────────────────────────

function cleanTitle(title) {
    if (!title) return "";
    return title.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function base64Decode(str) {
    try { return atob(str); } catch (e) { return null; }
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
            text.length < 100
        ) return "DEAD";
        return text;
    } catch (e) { return null; }
}

// ── TMDB ──────────────────────────────────────────────────────

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

    // Para series T2+, obtener el nombre de la temporada específica
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

// ── BÚSQUEDA EN LATANIME ──────────────────────────────────────
// Kotlin: GET("$baseUrl/buscar?q=$query&p=$page")
// Selector: "div.row > div:has(a)"
// Título: div.seriedetails > h3

async function searchOnSite(query) {
    try {
        const url = `${BASE_URL}/buscar?q=${encodeURIComponent(query)}`;
        const html = await fetchText(url);
        if (!html || html === "DEAD") return [];

        const results = [];
        // Extraer: href del anime y título h3
        const re = /href="(\/anime\/[^"]+)"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const path = m[1].trim();
            const title = m[2].trim();
            const slug = path.replace("/anime/", "");
            results.push({ slug, path, title });
        }
        return results;
    } catch (e) {
        console.warn(`[LatAnime] Search error: ${e.message}`);
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
        console.warn(`[LatAnime] Searching: "${q}"`);
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

            console.warn(`  → "${res.title}" Score: ${score}`);
            if (score > bestScore && score >= 40) {
                bestScore = score;
                matchedAnime = res;
            }
        }
        if (bestScore >= 100) break;
    }

    return matchedAnime;
}

// ── OBTENER EPISODIOS DEL ANIME ───────────────────────────────
// Kotlin: episodeListSelector() = "div.row > div > div.row > div > a"
// episode_number = title.substringAfter("Capitulo ").toFloatOrNull()
// URL del episodio está en el href del <a>

async function getEpisodeUrl(animePath, epNumber) {
    try {
        const html = await fetchText(`${BASE_URL}${animePath}`);
        if (!html || html === "DEAD") return null;

        // Selector: div.row > div > div.row > div > a
        // Cada <a> tiene href="/ver/slug-capitulo-N"
        const epLinks = [];
        const re = /href="(\/ver\/[^"]+)"/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            epLinks.push(m[1]);
        }

        if (!epLinks.length) return null;

        // Buscar el episodio que corresponde al número
        // LatAnime usa "capitulo-N" en la URL
        const target = epLinks.find(link => {
            const capMatch = link.match(/capitulo-(\d+)/i);
            return capMatch && parseInt(capMatch[1]) === epNumber;
        });

        if (target) return target;

        // Fallback: construir URL directamente
        // Formato: /ver/SLUG-capitulo-N
        const slugMatch = animePath.match(/\/anime\/(.+)/);
        if (slugMatch) {
            return `/ver/${slugMatch[1]}-capitulo-${epNumber}`;
        }

        return null;
    } catch (e) {
        console.warn(`[LatAnime] Error getting episode URL: ${e.message}`);
        return null;
    }
}

// ── OBTENER PLAYERS DEL EPISODIO ─────────────────────────────
// Kotlin: videoListSelector() = "li#play-video > a.play-video"
// Cada <a> tiene data-player (base64) y texto del servidor

async function getEpisodePlayers(episodePath) {
    try {
        const url = `${BASE_URL}${episodePath}`;
        console.warn(`[LatAnime] Fetching episode: ${url}`);
        const html = await fetchText(url);
        if (!html || html === "DEAD") return [];

        const players = [];

        // Selector: li#play-video > a.play-video
        // Atributo: data-player (base64 encoded URL)
        // Texto: nombre del servidor
        const re = /id="play-video"[\s\S]*?<a[^>]*class="play-video"[^>]*data-player="([^"]+)"[^>]*>([^<]*)<\/a>/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const encoded = m[1].trim();
            const serverTitle = m[2].trim();
            const decoded = base64Decode(encoded);
            if (decoded) {
                players.push({ serverTitle, url: decoded });
            }
        }

        // Fallback si el regex anterior no funciona — buscar todos los data-player
        if (!players.length) {
            const re2 = /data-player="([^"]+)"[^>]*>([^<]+)</g;
            while ((m = re2.exec(html)) !== null) {
                const encoded = m[1].trim();
                const serverTitle = m[2].trim();
                const decoded = base64Decode(encoded);
                if (decoded && decoded.startsWith("http")) {
                    players.push({ serverTitle, url: decoded });
                }
            }
        }

        console.warn(`[LatAnime] Found ${players.length} players`);
        return players;
    } catch (e) {
        console.warn(`[LatAnime] Error getting players: ${e.message}`);
        return [];
    }
}

// ── RESOLVERS ─────────────────────────────────────────────────

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
        return { url: mp4[1], quality: "1080p", headers: { "Referer": realUrl, "User-Agent": UA } };
    } catch (e) { return null; }
}

async function resolveVoe(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i) ||
                  html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m) return { url: m[1], quality: "1080p", headers: { "Referer": embedUrl, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveOkRu(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/videoUrl\s*=\s*"([^"]+)"/i) ||
                  html.match(/"url"\s*:\s*"([^"]+\.mp4[^"]*)"/i);
        if (m) return { url: m[1].replace(/\\/g, ""), quality: "720p", headers: { "Referer": embedUrl, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveYourUpload(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/property\s*=\s*"og:video"[\s\S]*?content\s*=\s*"([^"]+)"/i);
        if (m) return { url: m[1], quality: "720p", headers: { "Referer": embedUrl, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveDoodStream(embedUrl) {
    try {
        let url = embedUrl.includes("/e/") ? embedUrl : embedUrl.replace(/\/(d|f)\//, "/e/");
        const html = await fetchText(url, { "User-Agent": UA, "Referer": embedUrl });
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/\$\.get\(['"](\/pass_md5\/[\w-]+)\/([\w-]+)['"]/i);
        if (!m) return null;
        const domain = new URL(url).origin;
        const passRes = await fetchText(`${domain}${m[1]}`, { "User-Agent": UA, "Referer": url });
        if (!passRes || passRes === "DEAD") return null;
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let rand = "";
        for (let i = 0; i < 10; i++) rand += chars[Math.floor(Math.random() * chars.length)];
        return { url: `${passRes}${rand}?token=${m[2]}&expiry=${Date.now()}`, quality: "720p", headers: { "User-Agent": UA, "Referer": `${domain}/` } };
    } catch (e) { return null; }
}

async function resolveStreamWish(embedUrl) {
    try {
        const rawId = embedUrl.split("/").pop().replace(/\.html$/, "");
        const mirrors = [
            `https://hanerix.com/e/${rawId}`,
            `https://embedwish.com/e/${rawId}`,
            `https://streamwish.to/e/${rawId}`,
            embedUrl,
        ];
        const result = await new Promise(res => {
            let done = false;
            let pending = mirrors.length;
            mirrors.forEach(async mirror => {
                try {
                    const r = await fetch(mirror, { headers: { "Referer": mirror, "User-Agent": UA } });
                    if (!r.ok) throw "";
                    const html = await r.text();
                    let m3u8 = null;
                    const hm = html.match(/[0-9a-f]{32}/i);
                    if (hm) {
                        const dl = await fetch(
                            `${new URL(mirror).origin}/dl?op=view&file_code=${rawId}&hash=${hm[0]}&embed=1&adb=1&hls4=1`,
                            { headers: { "User-Agent": UA, "Referer": mirror, "X-Requested-With": "XMLHttpRequest" } }
                        );
                        if (dl.ok) { const t = await dl.text(); const mm = t.match(/https?:\/\/[^"']+\.m3u8[^"']*/); if (mm) m3u8 = mm[0]; }
                    }
                    if (!m3u8) { const f = html.match(/file\s*:\s*["']([^"']+)["']/i); if (f) m3u8 = f[1]; }
                    if (m3u8 && !done) { done = true; res({ url: m3u8.replace(/\\/g, ""), mirror }); }
                } catch (_) { } finally { pending--; if (pending === 0 && !done) res(null); }
            });
            setTimeout(() => { if (!done) { done = true; res(null); } }, 4000);
        });
        if (!result) return null;
        return { url: result.url, quality: "1080p", headers: { "Referer": result.mirror, "Origin": new URL(result.mirror).origin, "User-Agent": UA } };
    } catch (e) { return null; }
}

async function resolveFilemoon(embedUrl) {
    try {
        const urlObj = new URL(embedUrl);
        const videoId = urlObj.pathname.split("/").filter(Boolean).pop();
        if (!videoId) return null;
        const details = await fetch(
            `https://${urlObj.hostname}/api/videos/${videoId}/embed/details`,
            { headers: { "X-Requested-With": "XMLHttpRequest", "Referer": embedUrl, "User-Agent": UA } }
        ).then(r => r.json());
        if (!details.embed_frame_url) return null;
        const pd = new URL(details.embed_frame_url).origin;
        const ch = await fetch(
            `${pd}/api/videos/access/challenge`,
            { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA } }
        ).then(r => r.json());
        if (!ch.challenge_id) return null;
        const vid = Math.random().toString(36).substring(2, 15);
        const did = Math.random().toString(36).substring(2, 15);
        const att = await fetch(
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
        ).then(r => r.json());
        if (!att.token) return null;
        const play = await fetch(
            `${pd}/api/videos/${videoId}/embed/playback`,
            {
                method: "POST",
                body: JSON.stringify({ fingerprint: { token: att.token, viewer_id: att.viewer_id || vid, device_id: att.device_id || did, confidence: att.confidence } }),
                headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA }
            }
        ).then(r => r.json());
        const src = play?.playback?.sources?.[0]?.url;
        if (!src) return null;
        return { url: src, quality: "1080p", headers: { "User-Agent": UA, "Referer": pd, "Origin": pd } };
    } catch (e) { return null; }
}

async function resolveUqload(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/sources\s*:\s*\[\s*["']([^"']+)["']\s*\]/i) ||
                  html.match(/"file"\s*:\s*"([^"]+\.mp4[^"]*)"/i);
        if (m) return { url: m[1], quality: "720p", headers: { "Referer": embedUrl, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveVidGuard(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                  html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m) return { url: m[1], quality: "1080p", headers: { "Referer": embedUrl, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveMixDrop(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        if (!html || html === "DEAD") return html === "DEAD" ? "DEAD" : null;
        const m = html.match(/(?:wurl|MDCore\.wurl)\s*=\s*"([^"]+)"/i);
        if (m) {
            const url = m[1].startsWith("//") ? "https:" + m[1] : m[1];
            return { url, quality: "720p", headers: { "Referer": embedUrl, "User-Agent": UA } };
        }
        return null;
    } catch (e) { return null; }
}

async function resolveEmbed(serverTitle, embedUrl) {
    if (!embedUrl) return null;

    try {
        const host = new URL(embedUrl).hostname;
        if (SKIP_HOSTS.some(h => host.includes(h))) return null;
    } catch (_) { return null; }

    const serverKey = detectServer(embedUrl, serverTitle);
    console.warn(`[LatAnime] Resolving [${serverKey}] ${serverTitle}: ${embedUrl.substring(0, 60)}...`);

    switch (serverKey) {
        case "mp4upload":  return await resolveMp4Upload(embedUrl);
        case "voe":        return await resolveVoe(embedUrl);
        case "okru":       return await resolveOkRu(embedUrl);
        case "yourupload": return await resolveYourUpload(embedUrl);
        case "doodstream": return await resolveDoodStream(embedUrl);
        case "streamwish": return await resolveStreamWish(embedUrl);
        case "filemoon":   return await resolveFilemoon(embedUrl);
        case "uqload":     return await resolveUqload(embedUrl);
        case "vidguard":   return await resolveVidGuard(embedUrl);
        case "mixdrop":    return await resolveMixDrop(embedUrl);
        default: {
            // Fallback genérico — buscar .m3u8 o .mp4 en el HTML
            try {
                const html = await fetchText(embedUrl);
                if (!html || html === "DEAD") return null;
                const m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
                if (m3u8) return { url: m3u8[1], quality: "HD", headers: { "Referer": embedUrl, "User-Agent": UA } };
                const mp4 = html.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
                if (mp4) return { url: mp4[1], quality: "HD", headers: { "Referer": embedUrl, "User-Agent": UA } };
            } catch (e) {}
            return null;
        }
    }
}

// ── getStreams PRINCIPAL ───────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
    const seasonNum = parseInt(season) || 1;
    const epNum = parseInt(episode) || 1;

    console.warn(`[LatAnime] TMDB: ${tmdbId} | T${seasonNum}E${epNum}`);

    // 1. Encontrar el anime en LatAnime
    const matchedAnime = await findAnime(tmdbId, mediaType, seasonNum);
    if (!matchedAnime) {
        console.warn("[LatAnime] No se encontró el anime");
        return [];
    }
    console.warn(`[LatAnime] Match: "${matchedAnime.title}" → ${matchedAnime.path}`);

    // 2. Obtener URL del episodio desde la página del anime
    // LatAnime: /anime/SLUG → lista de episodios con href="/ver/SLUG-capitulo-N"
    let episodePath = null;
    if (mediaType === "tv") {
        episodePath = await getEpisodeUrl(matchedAnime.path, epNum);
        if (!episodePath) {
            // Fallback directo
            episodePath = `/ver/${matchedAnime.slug}-capitulo-${epNum}`;
            console.warn(`[LatAnime] Fallback URL: ${episodePath}`);
        }
    } else {
        // Películas/OVAs — episodio 1
        episodePath = await getEpisodeUrl(matchedAnime.path, 1);
        if (!episodePath) {
            episodePath = `/ver/${matchedAnime.slug}-capitulo-1`;
        }
    }

    // 3. Obtener players del episodio (data-player en base64)
    // Kotlin: videoListSelector() = "li#play-video > a.play-video"
    const players = await getEpisodePlayers(episodePath);
    if (!players.length) {
        console.warn("[LatAnime] Sin players para este episodio");
        return [];
    }

    // 4. Resolver cada player
    const streams = [];
    for (const player of players) {
        const resolved = await resolveEmbed(player.serverTitle, player.url);
        if (!resolved || resolved === "DEAD") continue;
        if (resolved?.url) {
            streams.push({
                name: "LatAnime",
                title: `${player.serverTitle}`,
                url: resolved.url,
                quality: resolved.quality || "HD",
                headers: resolved.headers || HEADERS
            });
        }
    }

    console.warn(`[LatAnime] ${streams.length} streams encontrados`);
    return streams;
}

module.exports = { getStreams };
