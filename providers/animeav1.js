// providers/animeav1.js
export const name = 'AnimeAV1';

const BASE = 'https://animeav1.com';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${BASE}/`,
};

async function search(title) {
    const html = await fetch(`${BASE}/catalogo?search=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
    // Resultados en formato: /media/slug
    return html.match(/href="(\/media\/[^"/]+)"/)?.[1] || null;
}

async function getPlayerUrl(episodeUrl) {
    const html = await fetch(episodeUrl, { headers: HEADERS }).then(r => r.text());
    // Player directo en el HTML: https://player.zilla-networks.com/play/HASH
    return html.match(/https:\/\/player\.zilla-networks\.com\/play\/[a-f0-9]+/)?.[0] || null;
}

async function getM3u8FromZilla(playerUrl) {
    const headers = {
        ...HEADERS,
        'Referer': `${BASE}/`,
    };
    const html = await fetch(playerUrl, { headers }).then(r => r.text());

    // Zilla expone el m3u8 en el HTML del player
    return html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)/)?.[1]
        || html.match(/"src"\s*:\s*"([^"]+\.m3u8[^"]*)"/)?.[1]
        || html.match(/source\s*:\s*["']([^"']+\.m3u8[^"']*)/)?.[1]
        || html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/)?.[1]
        || null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) {
        console.warn('[AnimeAV1] Sin título, abortando');
        return [];
    }

    try {
        // 1. Buscar anime
        const animePath = await search(title);
        if (!animePath) {
            console.warn(`[AnimeAV1] Sin resultados para: ${title}`);
            return [];
        }

        // 2. Construir URL del episodio
        // AnimeAV1 no maneja temporadas, solo número de episodio global
        const episodeUrl = mediaType === 'tv'
            ? `${BASE}${animePath}/${episode}`
            : `${BASE}${animePath}`; // películas/OVAs sin número

        // 3. Obtener URL del player zilla-networks
        const playerUrl = await getPlayerUrl(episodeUrl);
        if (!playerUrl) {
            console.warn('[AnimeAV1] No se encontró player URL en:', episodeUrl);
            return [];
        }

        // 4. Extraer m3u8 del player
        const m3u8Url = await getM3u8FromZilla(playerUrl);
        if (!m3u8Url) {
            console.warn('[AnimeAV1] No se pudo extraer m3u8 del player:', playerUrl);
            return [];
        }

        const streamName = mediaType === 'tv'
            ? `AnimeAV1 · E${episode}`
            : `AnimeAV1 · OVA/Movie`;

        return [{ name: streamName, url: m3u8Url, quality: 'HD' }];

    } catch (err) {
        console.error('[AnimeAV1] Error:', err.message);
        return [];
    }
}
