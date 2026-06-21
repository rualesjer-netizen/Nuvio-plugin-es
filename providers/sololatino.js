// providers/sololatino.js
export const name = 'SoloLatino';

const BASE = 'https://sololatino.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${BASE}/`,
};

function slugify(title) {
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function extractVideo(html) {
    // SoloLatino usa iframes con allowfullscreen
    return html.match(/<iframe[^>]*allowfullscreen[^>]*src="([^"]+)"/)?.[1]
        || html.match(/<iframe[^>]*src="([^"]+)"[^>]*allowfullscreen/)?.[1]
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/)?.[1]
        || html.match(/<source[^>]+src="([^"]+\.mp4[^"]*)"/)?.[1]
        || null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) {
        console.warn('[SoloLatino] Sin título, abortando');
        return [];
    }

    try {
        // 1. Buscar contenido
        const searchHtml = await fetch(`${BASE}/buscar?q=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
        const href = searchHtml.match(/<a\s+href="(\/ver\/[^"]+)"/)?.[1];
        if (!href) {
            console.warn(`[SoloLatino] Sin resultados para: ${title}`);
            return [];
        }

        const contentId = href.match(/\/(\d+)-/)?.[1];
        if (!contentId) {
            console.warn('[SoloLatino] No se pudo extraer contentId');
            return [];
        }

        const titleSlug = slugify(title);

        // 2. Construir URL según tipo
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = `${BASE}/ver/serie/${contentId}-${titleSlug}?temporada=${season}&capitulo=${episode}`;
        } else {
            targetUrl = `${BASE}/ver/pelicula/${contentId}-${titleSlug}`;
        }

        const pageHtml = await fetch(targetUrl, { headers: HEADERS }).then(r => r.text());
        const videoUrl = extractVideo(pageHtml);
        if (!videoUrl) {
            console.warn('[SoloLatino] No se encontró URL de video');
            return [];
        }

        const streamName = mediaType === 'tv'
            ? `SoloLatino · T${season}E${episode}`
            : `SoloLatino · Película`;

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        console.error('[SoloLatino] Error:', err.message);
        return [];
    }
}
