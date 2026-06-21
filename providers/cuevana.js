// providers/cuevana.js

const BASE = 'https://cuevana.you';
const PLAYER = 'https://tiktokshopping.xyz';
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

async function searchContent(title, mediaType) {
    try {
        const response = await fetch(BASE + '/search?q=' + encodeURIComponent(title), { headers: HEADERS });
        const html = await response.text();
        const prefix = mediaType === 'movie' ? '/pelicula/' : '/serie/';
        const match = html.match(new RegExp('href="([^"]*' + prefix + '[^"]+)"'));
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

async function getPlayerUrl(pageUrl) {
    try {
        const response = await fetch(pageUrl, { headers: HEADERS });
        const html = await response.text();

        const match = html.match(/url=(https:\/\/pixibay\.cc\/[^"&\s]+)/)
            || html.match(/src="(https:\/\/[^"]*tiktokshopping[^"]+)"/)
            || html.match(/src="(https:\/\/[^"]*pixibay[^"]+)"/);

        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

async function getM3u8(pixibayUrl) {
    try {
        const apiUrl = PLAYER + '/dl?op=get_slides&length=5061&url=' + encodeURIComponent(pixibayUrl);
        const headers = {
            ...HEADERS,
            'Referer': PLAYER + '/',
            'Origin': PLAYER,
        };

        const response = await fetch(apiUrl, { headers: headers });
        const text = await response.text();

        const match = text.match(/(https:\/\/tiktokshopping\.xyz\/stream\/[^"'\s]+\.m3u8)/)
            || text.match(/"file"\s*:\s*"([^"]+\.m3u8)"/)
            || text.match(/file\s*:\s*["']([^"']+\.m3u8)/);

        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

async function getStreams(tmdbId, mediaType, season, episode, meta) {
    const title = meta && meta.title ? meta.title : null;
    if (!title) {
        return [];
    }

    try {
        // 1. Buscar contenido
        let contentPath = await searchContent(title, mediaType);

        if (!contentPath) {
            const slug = slugify(title);
            const prefix = mediaType === 'movie' ? 'pelicula' : 'serie';
            contentPath = '/' + prefix + '/' + slug;
        }

        const contentUrl = contentPath.indexOf('http') === 0 ? contentPath : BASE + contentPath;

        // 2. Para series, ir al episodio
        let targetUrl = contentUrl;
        if (mediaType === 'tv') {
            const slugMatch = contentUrl.match(/\/serie\/([^/]+)/);
            if (!slugMatch) return [];
            targetUrl = BASE + '/serie/' + slugMatch[1] + '/' + season + '/' + episode;
        }

        // 3. Obtener URL de pixibay del player
        const pixibayUrl = await getPlayerUrl(targetUrl);
        if (!pixibayUrl) return [];

        // 4. Obtener el m3u8 final
        const m3u8Url = await getM3u8(pixibayUrl);
        if (!m3u8Url) return [];

        const streamName = mediaType === 'tv'
            ? 'Cuevana · T' + season + 'E' + episode
            : 'Cuevana · Película';

        return [{ name: streamName, url: m3u8Url, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

// Exportación CommonJS requerida por Nuvio
module.exports = {
    name: 'Cuevana',
    getStreams: getStreams
};
