// providers/animeav1.js
export const name = 'AnimeAV1';

const BASE = 'https://animeav1.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Referer': `${BASE}/` };

// AES-CBC decrypt (para UPNS)
async function decryptAES(inputHex, key, iv) {
    const keyBytes = new TextEncoder().encode(key);
    const ivBytes = new TextEncoder().encode(iv);
    const data = new Uint8Array(inputHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBytes }, cryptoKey, data);
    return new TextDecoder().decode(decrypted);
}

// Resolver: PlayerZilla — /m3u8/{id}
async function resolvePlayerZilla(url) {
    try {
        const id = url.split('/').pop();
        const m3u8 = `https://player.zilla-networks.com/m3u8/${id}`;
        return { url: m3u8, quality: '1080p', headers: { 'Referer': url, 'User-Agent': UA } };
    } catch { return null; }
}

// Resolver: UPNS — API con AES decrypt
async function resolveUPNS(url) {
    try {
        const hash = url.split('#').pop().split('/').pop();
        const base = url.split('/').slice(0, 3).join('/');
        const encoded = await fetch(`${base}/api/v1/video?id=${hash}`, { headers: { 'User-Agent': UA } }).then(r => r.text());
        const ivList = ['1234567890oiuytr', '0123456789abcdef'];
        let decrypted = null;
        for (const iv of ivList) {
            try { decrypted = await decryptAES(encoded.trim(), 'kiemtienmua911ca', iv); break; } catch { }
        }
        if (!decrypted) return null;
        const m3u8 = decrypted.match(/"source":"([^"]+)"/)?.[1]?.replace(/\\\//g, '/');
        if (!m3u8) return null;
        return { url: m3u8, quality: '1080p', headers: { 'Referer': url, 'User-Agent': UA } };
    } catch { return null; }
}

// Resolver: Mp4Upload — unpack + player.src
async function resolveMp4Upload(url) {
    try {
        const idMatch = url.match(/mp4upload\.com\/(embed-|)([A-Za-z0-9]*)/);
        const realUrl = idMatch ? `https://www.mp4upload.com/embed-${idMatch[2]}.html` : url;
        const html = await fetch(realUrl, { headers: { 'Referer': url, 'User-Agent': UA } }).then(r => r.text());
        // Unpack p,a,c,k,e,d
        const packed = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]+?\.split\('\|'\)\)\)/)?.[0];
        let unpacked = packed ? unpack(packed) : html;
        const mp4 = unpacked.match(/player\.src\("([^"]+)"/)?.[1]
            || unpacked.match(/player\.src\([\s\S]*?src:\s*"([^"]+)"/)?.[1];
        if (!mp4) return null;
        return { url: mp4, quality: '1080p', headers: { 'Referer': realUrl, 'User-Agent': UA } };
    } catch { return null; }
}

function unpack(packed) {
    try {
        const m = packed.match(/\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)\)/);
        if (!m) return packed;
        let [, p, a, c, k] = m;
        a = parseInt(a); k = k.split('|');
        const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const enc = (i, b) => i < b ? alphabet[i] : enc(Math.floor(i / b), b) + alphabet[i % b];
        for (let i = parseInt(c) - 1; i >= 0; i--) {
            if (k[i]) p = p.replace(new RegExp('\\b' + enc(i, a) + '\\b', 'g'), k[i]);
        }
        return p;
    } catch { return packed; }
}

async function resolveEmbed(url) {
    if (!url) return null;
    const s = url.toLowerCase();
    if (s.includes('zilla-networks.com')) return await resolvePlayerZilla(url);
    if (s.includes('uns.bio') || s.includes('upns')) return await resolveUPNS(url);
    if (s.includes('mp4upload.com')) return await resolveMp4Upload(url);
    // Fallback genérico
    try {
        const html = await fetch(url, { headers: { 'Referer': BASE, 'User-Agent': UA } }).then(r => r.text());
        const m3u8 = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)?.[1];
        if (m3u8) return { url: m3u8, quality: 'HD', headers: { 'Referer': url, 'User-Agent': UA } };
        const mp4 = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i)?.[1];
        if (mp4) return { url: mp4, quality: 'HD', headers: { 'Referer': url, 'User-Agent': UA } };
    } catch { }
    return null;
}

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) { console.warn('[AnimeAV1] Sin título'); return []; }

    episode = parseInt(episode) || 1;

    try {
        // 1. Buscar anime
        const searchHtml = await fetch(`${BASE}/catalogo?search=${encodeURIComponent(title)}`, { headers: HEADERS }).then(r => r.text());
        const animePath = searchHtml.match(/href="(\/media\/[^"]+)"/)?.[1];
        if (!animePath) { console.warn(`[AnimeAV1] Sin resultados para: ${title}`); return []; }

        // 2. Construir URL del episodio
        // AnimeAV1 no maneja temporadas — solo número de episodio global
        const epUrl = mediaType === 'tv' ? `${BASE}${animePath}/${episode}` : `${BASE}${animePath}`;

        // 3. Cargar página del episodio y extraer embeds del script svelte
        const epHtml = await fetch(epUrl, { headers: HEADERS }).then(r => r.text());
        const script = epHtml.match(/script:containsData\(__sveltekit\)/) 
            ? '' 
            : epHtml.match(/<script[^>]*>([\s\S]*?__sveltekit[\s\S]*?)<\/script>/)?.[1] || '';

        // Extraer embeds: {server:"X", url:"Y"} dentro de DUB y SUB
        const embedsData = script.match(/embeds:\{([\s\S]*?)\},downloads/)?.[1] || '';
        const embedMatches = [...(embedsData || epHtml).matchAll(/\{server:"([^"]+)",\s*url:"([^"]+)"/g)];

        if (embedMatches.length === 0) { console.warn('[AnimeAV1] Sin embeds en:', epUrl); return []; }

        // 4. Resolver cada embed
        const streams = [];
        await Promise.all(embedMatches.map(async ([, server, rawUrl]) => {
            try {
                let url = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
                if (!url.startsWith('http')) return;

                const resolved = await resolveEmbed(url);
                if (!resolved?.url) return;

                const streamName = mediaType === 'tv'
                    ? `AnimeAV1 · E${episode} - ${server}`
                    : `AnimeAV1 · Película - ${server}`;

                streams.push({
                    name: streamName,
                    url: resolved.url,
                    quality: resolved.quality || 'HD',
                    headers: resolved.headers || HEADERS,
                });
            } catch { }
        }));

        return streams;

    } catch (err) {
        console.error('[AnimeAV1] Error:', err.message);
        return [];
    }
}
