// providers/seriesmetro.js

const BASE = 'https://seriesmetro.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

function slugify(title) {
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function extractVideo(html) {
    const match = html.match(/<source[^>]+src="([^"]+\.m3u8[^"]*)"/)
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/)
        || html.match(/<source[^>]+src="([^"]+\.mp4[^"]*)"/)
        || html.match(/<iframe[^>]*src="([^"]*(?:player|embed)[^"]*)"[^>]*>/);
        
    return match ? match[1] : null;
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) {
        return [];
    }

    try {
        // 1. Buscar contenido
        const responseSearch = await fetch(BASE + '/search/' + encodeURIComponent(title), { headers: HEADERS });
        const searchHtml = await responseSearch.text();
        const hrefMatch = searchHtml.match(/<a\s+href="(\/ver\/[^"]+)"/);
        
        if (!hrefMatch) {
            return [];
        }

        const href = hrefMatch[1];
        const idMatch = href.match(/\/ver\/(\d+)/);
        if (!idMatch) {
            return [];
        }

        const contentId = idMatch[1];

        // 2. Construir URL
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = BASE + '/ver/' + contentId + '-' + slugify(title) + '?temporada=' + season + '&capitulo=' + episode;
        } else {
            targetUrl = BASE + '/ver/' + contentId + '-' + slugify(title);
        }

        const responsePage = await fetch(targetUrl, { headers: HEADERS });
        const pageHtml = await responsePage.text();
        const videoUrl = extractVideo(pageHtml);
        
        if (!videoUrl) {
            return [];
        }

        const streamName = mediaType === 'tv'
            ? 'SeriesMetro · T' + season + 'E' + episode
            : 'SeriesMetro · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

// Exportación CommonJS requerida por Nuvio
module.exports = {
    name: 'SeriesMetro',
    getStreams: getStreams
};
