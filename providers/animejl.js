// providers/animejl.js

const BASE = 'https://animejl.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

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
        // 1. Buscar anime
        const responseSearch = await fetch(BASE + '/buscar?q=' + encodeURIComponent(title), { headers: HEADERS });
        const searchHtml = await responseSearch.text();
        const animeUrlMatch = searchHtml.match(/<a\s+href="(\/anime\/[^"]+)"/);
        
        if (!animeUrlMatch) {
            return [];
        }
        
        const animeUrl = animeUrlMatch[1];
        const urlParts = animeUrl.split('/');
        const animeSlug = urlParts[urlParts.length - 1];

        // 2. Construir URL del episodio o película
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = BASE + '/ver/' + animeSlug + '/' + episode;
        } else {
            targetUrl = BASE + '/ver/' + animeSlug;
        }

        const responsePage = await fetch(targetUrl, { headers: HEADERS });
        const pageHtml = await responsePage.text();
        const videoUrl = extractVideo(pageHtml);
        
        if (!videoUrl) {
            return [];
        }

        const streamName = mediaType === 'tv'
            ? 'AnimeJL · T' + season + 'E' + episode
            : 'AnimeJL · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

// Exportación CommonJS requerida por Nuvio
module.exports = {
    name: 'AnimeJL',
    getStreams: getStreams
};
