// providers/seriesmetro.js
export const name = 'SeriesMetro';

const BASE = 'https://seriesmetro.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${BASE}/`,
};

function slugify(title) {
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

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
        console.warn('[SeriesMetro] Sin título, abortando');
        return [];
    }

    try {
        // 1. Buscar contenido
        const searchHtml = await fetch(`${BASE}/search/${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
        const href = searchHtml.match(/<a\s+href="(\/ver\/[^"]+)"/)?.[1];
        if (!href) {
            console.warn(`[SeriesMetro] Sin resultados para: ${title}`);
            return [];
        }

        const contentId = href.match(/\/ver\/(\d+)/)?.[1];
        if (!contentId) {
            console.warn('[SeriesMetro] No se pudo extraer contentId');
            return [];
        }

        // 2. Construir URL
        // SeriesMetro usa query params para temporada y capítulo
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = `${BASE}/ver/${contentId}-${slugify(title)}?temporada=${season}&capitulo=${episode}`;
        } else {
            targetUrl = `${BASE}/ver/${contentId}-${slugify(title)}`;
        }

        const pageHtml = await fetch(targetUrl, { headers: HEADERS }).then(r => r.text());
        const videoUrl = extractVideo(pageHtml);
        if (!videoUrl) {
            console.warn('[SeriesMetro] No se encontró URL de video');
            return [];
        }

        const streamName = mediaType === 'tv'
            ? `SeriesMetro · T${season}E${episode}`
            : `SeriesMetro · Película`;

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        console.error('[SeriesMetro] Error:', err.message);
        return [];
    }
}
