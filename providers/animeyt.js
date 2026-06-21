Entero // providers/animeyt.js

const BASE = 'https://animeyt.es';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

function extractVideo(html) {
    const match = html.match(/<iframe[^>]*src="([^"]*(?:player|embed|embeds)[^"]*)"[^>]*>/)
        || html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/)
        || html.match(/<source[^>]+src="([^"]+\.mp4[^"]*)"/);
        
    return match ? match[1] : null;
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) return [];

    try {
        // 1. Buscar el anime en el sitio
        const responseSearch = await fetch(BASE + '/?s=' + encodeURIComponent(title), { headers: HEADERS });
        const searchHtml = await responseSearch.text();
        const animeUrlMatch = searchHtml.match(/<a\s+href="https:\/\/animeyt\.es\/anime\/([^"]+)"/);
        
        if (!animeUrlMatch) return [];
        const animeSlug = animeUrlMatch[1];

        // 2. Construir ruta dependiendo de si es serie (tv) o película (movie)
        let targetUrl;
        if (mediaType === 'tv') {
            // Estructura común de episodios en AnimeYT
            targetUrl = BASE + '/ver/' + animeSlug + '-' + episode;
        } else {
            targetUrl = BASE + '/anime/' + animeSlug;
        }

        const responsePage = await fetch(targetUrl, { headers: HEADERS });
        const pageHtml = await responsePage.text();
        const videoUrl = extractVideo(pageHtml);
        
        if (!videoUrl) return [];

        const streamName = mediaType === 'tv'
            ? 'AnimeYT · T' + season + 'E' + episode
            : 'AnimeYT · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

module.exports = {
    name: 'AnimeYT',
    getStreams: getStreams
};
