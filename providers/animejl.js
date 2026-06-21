// providers/animejl.js
export const name = 'AnimeJL';

const BASE = 'https://animejl.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${BASE}/`,
};

function extractVideo(html) {
    return html.match(/<source[^>]+src="([^"]+\.m3u8[^"]*)"/)?.[1]
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/)?.[1]
        || html.match(/<source[^>]+src="([^"]+\.mp4[^"]*)"/)?.[1]
        || html.match(/<iframe[^>]*src="([^"]*(?:player|embed)[^"]*)"[^>]*>/)?.[1]
        || null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) {
        console.warn('[AnimeJL] Sin título, abortando');
        return [];
    }

    try {
        // 1. Buscar anime
        const searchHtml = await fetch(`${BASE}/buscar?q=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
        const animeUrl = searchHtml.match(/<a\s+href="(\/anime\/[^"]+)"/)?.[1];
        if (!animeUrl) {
            console.warn(`[AnimeJL] Sin resultados para: ${title}`);
            return [];
        }
        const animeSlug = animeUrl.split('/').pop();

        // 2. Construir URL del episodio o película
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = `${BASE}/ver/${animeSlug}/${episode}`;
        } else {
            targetUrl = `${BASE}/ver/${animeSlug}`;
        }

        const pageHtml = await fetch(targetUrl, { headers: HEADERS }).then(r => r.text());
        const videoUrl = extractVideo(pageHtml);
        if (!videoUrl) {
            console.warn('[AnimeJL] No se encontró URL de video');
            return [];
        }

        const streamName = mediaType === 'tv'
            ? `AnimeJL · T${season}E${episode}`
            : `AnimeJL · Película`;

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        console.error('[AnimeJL] Error:', err.message);
        return [];
    }
}
