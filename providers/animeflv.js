// providers/animeflv.js

const BASE = 'https://www.animeflv.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

function extractVideo(html) {
    const match = html.match(/<iframe[^>]*id="player"[^>]*src="([^"]+)"/)
        || html.match(/<iframe[^>]*src="([^"]*(?:player|embed)[^"]*)"[^>]*>/)
        || html.match(/file\s*:\s*"([^"]+\.m3u8)"/);
        
    return match ? match[1] : null;
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) {
        return [];
    }

    try {
        // 1. Buscar anime
        const responseSearch = await fetch(BASE + '/browse?q=' + encodeURIComponent(title), { headers: HEADERS });
        const searchHtml = await responseSearch.text();
        const animeUrlMatch = searchHtml.match(/<a\s+href="(\/anime\/[^"]+)"/);
        
        if (!animeUrlMatch) {
            return [];
        }
        
        const animeUrl = animeUrlMatch[1];
        const urlParts = animeUrl.split('/');
        const animeId = urlParts[urlParts.length - 1];

        // 2. Construir URL del episodio o película
        let targetUrl;
        if (mediaType === 'tv') {
            targetUrl = BASE + '/ver/' + animeId + '-' + episode;
        } else {
            targetUrl = BASE + '/ver/' + animeId;
        }

        const responsePage = await fetch(targetUrl, { headers: HEADERS });
        const pageHtml = await responsePage.text();
        const videoUrl = extractVideo(pageHtml);
        
        if (!videoUrl) {
            return [];
        }

        const streamName = mediaType === 'tv'
            ? 'AnimeFLV · T' + season + 'E' + episode
            : 'AnimeFLV · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

// Exportación CommonJS requerida por Nuvio
module.exports = {
    name: 'AnimeFLV',
    getStreams: getStreams
};
