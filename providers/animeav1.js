// providers/animeav1.js

const BASE = 'https://animeav1.com';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE + '/',
};

async function search(title) {
    try {
        const response = await fetch(BASE + '/catalogo?search=' + encodeURIComponent(title), { headers: HEADERS });
        const html = await response.text();
        const match = html.match(/href="(\/media\/[^"/]+)"/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

async function getPlayerUrl(episodeUrl) {
    try {
        const response = await fetch(episodeUrl, { headers: HEADERS });
        const html = await response.text();
        const match = html.match(/https:\/\/player\.zilla-networks\.com\/play\/[a-f0-9]+/);
        return match ? match[0] : null;
    } catch (e) {
        return null;
    }
}

async function getM3u8FromZilla(playerUrl) {
    try {
        const headers = { ...HEADERS, 'Referer': BASE + '/' };
        const response = await fetch(playerUrl, { headers: headers });
        const html = await response.text();

        const m3u8Match = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)/)
            || html.match(/"src"\s*:\s*"([^"]+\.m3u8[^"]*)"/)
            || html.match(/source\s*:\s*["']([^"']+\.m3u8[^"']*)/)
            || html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);

        return m3u8Match ? m3u8Match[1] : null;
    } catch (e) {
        return null;
    }
}

// Cambiamos los exports modernos por la asignación directa que Nuvio reconoce
async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) {
        return [];
    }

    try {
        // 1. Buscar anime
        const animePath = await search(title);
        if (!animePath) return [];

        // 2. Construir URL del episodio
        const episodeUrl = mediaType === 'tv'
            ? BASE + animePath + '/' + episode
            : BASE + animePath;

        // 3. Obtener URL del player
        const playerUrl = await getPlayerUrl(episodeUrl);
        if (!playerUrl) return [];

        // 4. Extraer m3u8
        const m3u8Url = await getM3u8FromZilla(playerUrl);
        if (!m3u8Url) return [];

        const streamName = mediaType === 'tv'
            ? 'AnimeAV1 · E' + episode
            : 'AnimeAV1 · OVA/Movie';

        // Retorna el array con el formato que Nuvio mapea en "Test Provider"
        return [{ 
            name: streamName, 
            url: m3u8Url, 
            quality: 'HD' 
        }];

    } catch (err) {
        return [];
    }
}

// Exportación compatible con CommonJS/Nuvio
module.exports = {
    name: 'AnimeAV1',
    getStreams: getStreams
};
