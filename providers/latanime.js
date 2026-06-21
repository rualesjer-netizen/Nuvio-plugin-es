// providers/latanime.js
export const name = 'LatAnime';

const BASE = 'https://latanime.org';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${BASE}/`,
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
    const html = await fetch(`${BASE}/animes?buscar=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
    // Resultados en /anime/slug
    return html.match(/href="(\/anime\/[^"]+)"/)?.[1] || null;
}

async function getEpisodeSlug(animePath, episode) {
    // Obtener la página del anime para sacar el slug del episodio
    const html = await fetch(`${BASE}${animePath}`, { headers: HEADERS }).then(r => r.text());
    // Episodios en formato: /ver/slug-episodio-N
    const epLinks = [...html.matchAll(/href="(\/ver\/[^"]+episodio-(\d+)[^"]*)"/g)];
    const epLink = epLinks.find(m => parseInt(m[2]) === episode);
    return epLink?.[1] || null;
}

async function getVideoFromMp4upload(mp4uploadUrl) {
    // mp4upload tiene su propio embed — extraer el mp4 directo
    const embedUrl = mp4uploadUrl.replace('mp4upload.com/embed-', 'mp4upload.com/').replace('.html', '');
    const html = await fetch(mp4uploadUrl, {
        headers: { ...HEADERS, 'Referer': BASE }
    }).then(r => r.text());

    return html.match(/"file"\s*:\s*"([^"]+\.mp4[^"]*)"/)?.[1]
        || html.match(/src\s*:\s*["']([^"']+\.mp4[^"']*)/)?.[1]
        || html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/)?.[1]
        || null;
}

async function getEpisodeStreams(episodePath) {
    const html = await fetch(`${BASE}${episodePath}`, { headers: HEADERS }).then(r => r.text());

    // LatAnime carga los servidores con JS/AJAX usando CSRF token
    // Intentar extraer directamente cualquier URL de video del HTML
    const mp4Match = html.match(/(https?:\/\/[^"'\s]*mp4upload[^"'\s]+)/);
    if (mp4Match) return mp4Match[1];

    // Buscar iframe de mp4upload
    const iframeMatch = html.match(/src="(https?:\/\/[^"]*mp4upload[^"]+)"/);
    if (iframeMatch) {
        return await getVideoFromMp4upload(iframeMatch[1]);
    }

    // Buscar cualquier .mp4 directo
    return html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/)?.[1] || null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) {
        console.warn('[LatAnime] Sin título, abortando');
        return [];
    }

    try {
        // 1. Buscar anime
        const animePath = await searchAnime(title);
        if (!animePath) {
            console.warn(`[LatAnime] Sin resultados para: ${title}`);
            return [];
        }

        // 2. Obtener slug del episodio desde la página del anime
        let episodePath;
        if (mediaType === 'tv') {
            episodePath = await getEpisodeSlug(animePath, episode);
            if (!episodePath) {
                // Fallback: construir slug directo
                const animeSlug = animePath.replace('/anime/', '');
                episodePath = `/ver/${animeSlug}-episodio-${episode}`;
                console.warn(`[LatAnime] Intentando slug directo: ${episodePath}`);
            }
        } else {
            episodePath = animePath.replace('/anime/', '/ver/') + '-episodio-1';
        }

        // 3. Obtener stream del episodio
        const videoUrl = await getEpisodeStreams(episodePath);
        if (!videoUrl) {
            console.warn('[LatAnime] No se pudo extraer URL de video');
            return [];
        }

        const streamName = mediaType === 'tv'
            ? `LatAnime · E${episode}`
            : `LatAnime · Película`;

        return [{ name: streamName, url: videoUrl, quality: 'HD' }];

    } catch (err) {
        console.error('[LatAnime] Error:', err.message);
        return [];
    }
}
