// providers/latanime.js
export const name = 'LatAnime';

const BASE = 'https://latanime.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = {
    'User-Agent': UA,
    'Referer': `${BASE}/`,
};

function base64Decode(str) {
    try { return atob(str); } catch { return ''; }
}

function cleanPlayerUrl(url) {
    return url
        .replace('https://monoschinos2.com/reproductor?url=', '')
        .replace('https://mojon.latanime.org/aqua/fn?url=', '')
        .replaceAll('https://hglink.to', 'https://streamwish.to')
        .replaceAll('https://swdyu.com', 'https://streamwish.to')
        .replaceAll('https://mivalyo.com', 'https://vidhidepro.com')
        .replaceAll('https://filemoon.link', 'https://filemoon.sx')
        .replaceAll('https://sblona.com', 'https://watchsb.com');
}

async function resolveEmbed(url) {
    if (!url) return null;
    try {
        const res = await fetch(url, { headers: { 'Referer': BASE, 'User-Agent': UA } });
        const html = await res.text();
        const m3u8 = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)?.[1];
        if (m3u8) return { url: m3u8, quality: 'HD', headers: { 'Referer': url, 'User-Agent': UA } };
        const mp4 = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i)?.[1];
        if (mp4) return { url: mp4, quality: 'HD', headers: { 'Referer': url, 'User-Agent': UA } };
    } catch { }
    return null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) {
        console.warn('[LatAnime] Sin título');
        return [];
    }

    season = parseInt(season) || 1;
    episode = parseInt(episode) || 1;

    try {
        // 1. Buscar anime
        const searchRes = await fetch(`${BASE}/buscar?q=${encodeURIComponent(title)}`, { headers: HEADERS });
        const searchHtml = await searchRes.text();
        const animePath = searchHtml.match(/href="(\/anime\/[^"]+)"/)?.[1];
        if (!animePath) {
            console.warn(`[LatAnime] Sin resultados para: ${title}`);
            return [];
        }

        // 2. Obtener path del episodio desde la página del anime
        let epPath = null;
        if (mediaType === 'tv') {
            const animeRes = await fetch(`${BASE}${animePath}`, { headers: HEADERS });
            const animeHtml = await animeRes.text();
            const epLinks = [...animeHtml.matchAll(/href="(\/ver\/[^"]+)"/g)].map(m => m[1]);
            epPath = epLinks.find(l => l.match(new RegExp(`episodio-0*${episode}(?:[^0-9]|$)`)))
                || `/ver/${animePath.replace('/anime/', '')}-episodio-${episode}`;
        } else {
            epPath = `/ver/${animePath.replace('/anime/', '')}-episodio-1`;
        }

        // 3. Cargar página del episodio y extraer players (data-player en base64)
        const epRes = await fetch(`${BASE}${epPath}`, { headers: HEADERS });
        if (!epRes.ok) {
            console.warn('[LatAnime] Episodio no encontrado:', epPath);
            return [];
        }
        const epHtml = await epRes.text();

        const playerMatches = [...epHtml.matchAll(/data-player="([^"]+)"/g)];
        if (playerMatches.length === 0) {
            console.warn('[LatAnime] Sin players en:', epPath);
            return [];
        }

        // 4. Decodificar y resolver cada player
        const streams = [];
        await Promise.all(playerMatches.map(async ([, encoded]) => {
            try {
                const decoded = base64Decode(encoded);
                const cleanUrl = cleanPlayerUrl(decoded);
                if (!cleanUrl?.startsWith('http')) return;

                const resolved = await resolveEmbed(cleanUrl);
                if (!resolved?.url) return;

                const streamName = mediaType === 'tv'
                    ? `LatAnime · T${season}E${episode}`
                    : `LatAnime · Película`;

                streams.push({
                    name: streamName,
                    url: resolved.url,
                    quality: resolved.quality || 'HD',
                    headers: resolved.headers || HEADERS,
                });
            } catch { }
        }));

        return streams;

    } catch (err) {
        console.error('[LatAnime] Error:', err.message);
        return [];
    }
}
