// providers/cinecalidad.js

const BASE = 'https://cinecalidad.fun';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

function extractVideo(html) {
    const match = html.match(/<iframe[^>]*src="([^"]*(?:player|embed)[^"]*)"[^>]*>/)
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/)
        || html.match(/<source[^>]+src="([^"]+\.mp4[^"]*)"/);
        
    return match ? match[1] : null;
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    // Cinecalidad solo tiene películas
    if (mediaType !== 'movie') return [];

    const title = meta && meta.title ? meta.title : null;
    if (!title) {
        return [];
    }

    try {
        // 1. Buscar película
        const responseSearch = await fetch(BASE + '/?s=' + encodeURIComponent(title), { headers: HEADERS });
        const searchHtml = await responseSearch.text();
        const moviePathMatch = searchHtml.match(/<a\s+href="(\/pelicula\/[^"]+)"/);
        
        if (!moviePathMatch) {
            return [];
        }
        
        const moviePath = moviePathMatch[1];

        // 2. Obtener página de la película
        const responseMovie = await fetch(BASE + moviePath, { headers: HEADERS });
        const movieHtml = await responseMovie.text();
        const videoUrl = extractVideo(movieHtml);
        
        if (!videoUrl) {
            return [];
        }

        return [{ name: 'Cinecalidad · Película', url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

// Exportación CommonJS requerida por Nuvio
module.exports = {
    name: 'Cinecalidad',
    getStreams: getStreams
};
