// providers/pelisplus.js

const BASE = 'https://pelisplus.to';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

function extractVideo(html) {
    const match = html.match(/<iframe[^>]*src="([^"]*(?:embed|embed2|player)[^"]*)"[^>]*>/)
        || html.match(/url=(https:\/\/[^"&\s]+\.mp4)/)
        || html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/);
        
    return match ? match[1] : null;
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) return [];

    try {
        // 1. Buscar película o serie
        const responseSearch = await fetch(BASE + '/search?keyword=' + encodeURIComponent(title), { headers: HEADERS });
        const searchHtml = await responseSearch.text();
        const prefix = mediaType === 'movie' ? '/pelicula/' : '/serie/';
        const movieUrlMatch = searchHtml.match(new RegExp('href="([^"]*' + prefix + '[^"]+)"'));
        
        if (!movieUrlMatch) return [];
        const contentPath = movieUrlMatch[1];
        const contentUrl = contentPath.indexOf('http') === 0 ? contentPath : BASE + contentPath;

        // 2. Si es serie, ir a la ruta del episodio
        let targetUrl = contentUrl;
        if (mediaType === 'tv') {
            // Estructura clásica: /serie/slug/season/episode
            targetUrl = contentUrl + '/season/' + season + '/episode/' + episode;
        }

        const responsePage = await fetch(targetUrl, { headers: HEADERS });
        const pageHtml = await responsePage.text();
        const videoUrl = extractVideo(pageHtml);
        
        if (!videoUrl) return [];

        const streamName = mediaType === 'tv'
            ? 'PelisPlus · T' + season + 'E' + episode
            : 'PelisPlus · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

module.exports = {
    name: 'PelisPlus',
    getStreams: getStreams
};
