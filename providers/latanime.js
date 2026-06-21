// providers/latanime.js

const BASE = 'https://latanime.org';
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

async function searchAnime(title) {
    try {
        const response = await fetch(BASE + '/animes?buscar=' + encodeURIComponent(title), { headers: HEADERS });
        const html = await response.text();
        const match = html.match(/href="(\/anime\/[^"]+)"/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

async function getEpisodeSlug(animePath, episode) {
    try {
        const response = await fetch(BASE + animePath, { headers: HEADERS });
        const html = await response.text();
        
        // Expresión regular tradicional para iterar de manera segura sin usar matchAll
        const regex = /href="(\/ver\/[^"]+episodio-(\d+)[^"]*)"/g;
        let match;
        
        while ((match = regex.exec(html)) !== null) {
            if (parseInt(match[2], 10) === episode) {
                return match[1];
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function getVideoFromMp4upload(mp4uploadUrl) {
    try {
        const headers = { ...HEADERS, 'Referer': BASE };
        const response = await fetch(mp4uploadUrl, { headers: headers });
        const html = await response.text();

        const match = html.match(/"file"\s*:\s*"([^"]+\.mp4[^"]*)"/)
            || html.match(/src\s*:\s*["']([^"']+\.mp4[^"']*)/)
            || html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/);

        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

async function getEpisodeStreams(episodePath) {
    try {
        const response = await fetch(BASE + episodePath, { headers: HEADERS });
        const html = await response.text();

        const mp4Match = html.match(/(https?:\/\/[^"'\s]*mp4upload[^"'\s]+)/);
        if (mp4Match) return mp4Match[1];

        const iframeMatch = html.match(/src="(https?:\/\/[^"]*mp4upload[^"]+)"/);
        if (iframeMatch) {
            return await getVideoFromMp4upload(iframeMatch[1]);
        }

        const directMp4Match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/);
        return directMp4Match ? directMp4Match[1] : null;
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
        // 1. Buscar anime
        const animePath = await searchAnime(title);
        if (!animePath) return [];

        // 2. Obtener slug del episodio
        let episodePath;
        if (mediaType === 'tv') {
            episodePath = await getEpisodeSlug(animePath, episode);
            if (!episodePath) {
                const animeSlug = animePath.replace('/anime/', '');
                episodePath = '/ver/' + animeSlug + '-episodio-' + episode;
            }
        } else {
            episodePath = animePath.replace('/anime/', '/ver/') + '-episodio-1';
        }

        // 3. Obtener stream
        const videoUrl = await getEpisodeStreams(episodePath);
        if (!videoUrl) return [];

        const streamName = mediaType === 'tv'
            ? 'LatAnime · E' + episode
            : 'LatAnime · Película';

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        return [];
    }
}

// Exportación CommonJS requerida por Nuvio
module.exports = {
    name: 'LatAnime',
    getStreams: getStreams
};
