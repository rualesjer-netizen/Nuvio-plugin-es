// providers/cinecalidad.js
export const name = 'Cinecalidad';

const BASE = 'https://cinecalidad.fun';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${BASE}/`,
};

function extractVideo(html) {
    // Cinecalidad usa iframes con reproductores
    return html.match(/<iframe[^>]*src="([^"]*(?:player|embed)[^"]*)"[^>]*>/)?.[1]
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/)?.[1]
        || html.match(/<source[^>]+src="([^"]+\.mp4[^"]*)"/)?.[1]
        || null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    // Cinecalidad solo tiene películas
    if (mediaType !== 'movie') return [];

    const { title } = meta;
    if (!title) {
        console.warn('[Cinecalidad] Sin título, abortando');
        return [];
    }

    try {
        // 1. Buscar película
        const searchHtml = await fetch(`${BASE}/?s=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
        const moviePath = searchHtml.match(/<a\s+href="(\/pelicula\/[^"]+)"/)?.[1];
        if (!moviePath) {
            console.warn(`[Cinecalidad] Sin resultados para: ${title}`);
            return [];
        }

        // 2. Obtener página de la película
        const movieHtml = await fetch(`${BASE}${moviePath}`, { headers: HEADERS }).then(r => r.text());
        const videoUrl = extractVideo(movieHtml);
        if (!videoUrl) {
            console.warn('[Cinecalidad] No se encontró URL de video');
            return [];
        }

        return [{ name: 'Cinecalidad · Película', url: videoUrl, quality: 'HD' }];

    } catch (err) {
        console.error('[Cinecalidad] Error:', err.message);
        return [];
    }
}
