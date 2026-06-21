// providers/sololatino.js

const BASE = 'https://sololatino.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

function slugify(title) {
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function extractVideo(html) {
    const match = html.match(/<iframe[^>]*allowfullscreen[^>]*src="([^"]+)"/)
        || html.match(/<iframe[^>]*src="([^"]+)"[^>]*allowfullscreen/)
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/)
        || html.match(/<source[^>]+src="([^"]+\.mp4[^"]*)"/);
        
    return match ? match[1] : null;
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) {
        return [];
    }

    try {
        // 1. Buscar contenido
        const responseSearch = await fetch(BASE + '/buscar?q=' + encodeURIComponent(title), { headers: HEADERS });
        const searchHtml = await responseSearch.text();
        const hrefMatch = searchHtml.match(/<a\s+href="(\/ver\/[^"]+)"/);
        
        if (!hrefMatch) {
            return [];
        }

        const href = hrefMatch[1];
        const idMatch = href.match(/\/(\d+)-/);
        if (!idMatch) {
            return [];
        }

        const contentId = idMatch[1];
        const titleSlug = slugify(title);

        // 2. Construir URL según tipo
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = BASE + '/ver/serie/' + contentId + '-' + titleSlug + '?temporada=' + season + '&capitulo=' + episode;
        } else {
            targetUrl = BASE + '/ver/pelicula/' + contentId + '-' + titleSlug;
        }

        const responsePage = await fetch(targetUrl, { headers: HEADERS });
        const pageHtml = await responsePage.text();
        const videoUrl = extractVideo(pageHtml);
        
        if (!videoUrl) {
            return [];
        }

        const streamName = mediaType === 'tv'
            ? 'SoloLatino · T' + season + 'E' + episode
            : 'SoloLatino · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

// Exportación CommonJS requerida por Nuvio
module.exports = {
    name: 'SoloLatino',
    getStreams: getStreams
};
