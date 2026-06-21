// providers/animeflv.js
export const name = 'AnimeFLV';

const BASE = 'https://www.animeflv.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${BASE}/`,
};

function extractVideo(html) {
    // AnimeFLV usa iframes con reproductores externos
    return html.match(/<iframe[^>]*id="player"[^>]*src="([^"]+)"/)?.[1]
        || html.match(/<iframe[^>]*src="([^"]*(?:player|embed)[^"]*)"[^>]*>/)?.[1]
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/)?.[1]
        || null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) {
        console.warn('[AnimeFLV] Sin título, abortando');
        return [];
    }

    try {
        // 1. Buscar anime
        const searchHtml = await fetch(`${BASE}/browse?q=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
        const animeUrl = searchHtml.match(/<a\s+href="(\/anime\/[^"]+)"/)?.[1];
        if (!animeUrl) {
            console.warn(`[AnimeFLV] Sin resultados para: ${title}`);
            return [];
        }
        const animeId = animeUrl.split('/').pop();

        // 2. Construir URL del episodio o película
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = `${BASE}/ver/${animeId}-${episode}`;
        } else {
            targetUrl = `${BASE}/ver/${animeId}`;
        }

        const pageHtml = await fetch(targetUrl, { headers: HEADERS }).then(r => r.text());
        const videoUrl = extractVideo(pageHtml);
        if (!videoUrl) {
            console.warn('[AnimeFLV] No se encontró URL de video');
            return [];
        }

        const streamName = mediaType === 'tv'
            ? `AnimeFLV · T${season}E${episode}`
            : `AnimeFLV · Película`;

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        console.error('[AnimeFLV] Error:', err.message);
        return [];
    }
}
