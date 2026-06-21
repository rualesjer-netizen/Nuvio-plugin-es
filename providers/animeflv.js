// providers/animeflv.js

const BASE = 'https://www.animeflv.net';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

function slugify(title) {
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) return [];

    try {
        // 1. Intentar resolver por slug directo (método más rápido y efectivo)
        const animeSlug = slugify(title);
        let targetUrl = BASE + '/ver/' + animeSlug + '-' + episode;
        
        if (mediaType !== 'tv') {
            targetUrl = BASE + '/ver/' + animeSlug + '-pelicula';
        }

        let responsePage = await fetch(targetUrl, { headers: HEADERS });
        let pageHtml = await responsePage.text();

        // 2. Si el slug directo falla (404), buscar de forma tradicional
        if (pageHtml.indexOf('404 Not Found') !== -1 || pageHtml.length < 1000) {
            const responseSearch = await fetch(BASE + '/browse?q=' + encodeURIComponent(title), { headers: HEADERS });
            const searchHtml = await responseSearch.text();
            const animeUrlMatch = searchHtml.match(/<a\s+href="\/anime\/([^"]+)"/);
            
            if (animeUrlMatch) {
                const animeId = animeUrlMatch[1];
                targetUrl = mediaType === 'tv' 
                    ? BASE + '/ver/' + animeId + '-' + episode 
                    : BASE + '/ver/' + animeId;
                
                responsePage = await fetch(targetUrl, { headers: HEADERS });
                pageHtml = await responsePage.text();
            }
        }

        // 3. Extracción robusta de los scripts de video (servidores en la nube)
        // AnimeFLV guarda la lista de servidores en una variable de JS llamada 'videos'
        const videoScript = pageHtml.match(/var\s+videos\s*=\s*([^\n;]+)/);
        if (!videoScript) return [];

        // Extraer enlaces directos de reproductores comunes dentro del texto plano
        const streamMatch = videoScript[1].match(/(https?:\/\/[^"'\s]*(?:mega|embed|stream|player|mp4upload)[^"'\s]*)/);
        if (!streamMatch) return [];

        // Limpiar backslashes del JSON si existen
        const videoUrl = streamMatch[1].replace(/\\/g, '');

        const streamName = mediaType === 'tv'
            ? 'AnimeFLV · T' + season + 'E' + episode
            : 'AnimeFLV · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

module.exports = {
    name: 'AnimeFLV',
    getStreams: getStreams
};
