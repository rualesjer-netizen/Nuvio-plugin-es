// providers/latanime.js
export const name = 'LatAnime';

const BASE = 'https://latanime.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = {
    'User-Agent': UA,
    'Referer': `${BASE}/`,
};

// ── UTILIDADES ────────────────────────────────────────────────

function base64Decode(str) {
    try { return atob(str); } catch { return ''; }
}

// Limpia URLs que vienen con prefijos de reproductores internos
function cleanPlayerUrl(url) {
    return url
        .replace('https://monoschinos2.com/reproductor?url=', '')
        .replace('https://mojon.latanime.org/aqua/fn?url=', '')
        .replaceAll('https://hglink.to', 'https://streamwish.to')
        .replaceAll('https://swdyu.com', 'https://streamwish.to')
        .replaceAll('https://mivalyo.com', 'https://vidhidepro.com')
        .replaceAll('https://filemoon.link', 'https://filemoon.sx')
        .replaceAll('https://sblona.com', 'https://watchsb.com');
}

// ── RESOLVERS ─────────────────────────────────────────────────

function unpackEval(payload, radix, symtab) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const unbase = s => { let r = 0; for (const c of s) { const p = chars.indexOf(c); if (p === -1) return NaN; r = r * radix + p; } return r; };
    return payload.replace(/\b([0-9a-zA-Z]+)\b/g, m => { const i = unbase(m); return (!isNaN(i) && i < symtab.length && symtab[i]) ? symtab[i] : m; });
}

async function resolveStreamWish(url) {
    try {
        const rawId = url.split('/').pop().replace(/\.html$/, '');
        const mirrors = [
            `https://hanerix.com/e/${rawId}`,
            `https://embedwish.com/e/${rawId}`,
            `https://streamwish.to/e/${rawId}`,
            url,
        ];
        const result = await new Promise(res => {
            let done = false; let pending = mirrors.length;
            mirrors.forEach(async mirror => {
                try {
                    const r = await fetch(mirror, { headers: { 'Referer': mirror, 'User-Agent': UA } });
                    if (!r.ok) throw '';
                    const html = await r.text();
                    let m3u8 = null;
                    const hm = html.match(/[0-9a-f]{32}/i);
                    if (hm) {
                        const dl = await fetch(`${new URL(mirror).origin}/dl?op=view&file_code=${rawId}&hash=${hm[0]}&embed=1&adb=1&hls4=1`, { headers: { 'User-Agent': UA, 'Referer': mirror, 'X-Requested-With': 'XMLHttpRequest' } });
                        if (dl.ok) { const t = await dl.text(); const mm = t.match(/https?:\/\/[^"']+\.m3u8[^"']*/); if (mm) m3u8 = mm[0]; }
                    }
                    if (!m3u8) { const pk = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/); if (pk) { const u = unpackEval(pk[1], parseInt(pk[2]), pk[4].split('|')); const mm = u.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/); if (mm) m3u8 = mm[0]; } }
                    if (!m3u8) { const f = html.match(/file\s*:\s*["']([^"']+)["']/i); if (f) m3u8 = f[1]; }
                    if (m3u8 && !done) { done = true; res({ url: m3u8.replace(/\\/g, ''), mirror }); }
                } catch { } finally { pending--; if (pending === 0 && !done) res(null); }
            });
            setTimeout(() => { if (!done) { done = true; res(null); } }, 3500);
        });
        if (!result) return null;
        return { url: result.url, quality: 'Auto', serverName: 'StreamWish', headers: { 'Referer': result.mirror, 'Origin': new URL(result.mirror).origin, 'User-Agent': UA } };
    } catch { return null; }
}

async function resolveVidHide(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': `https://${new URL(url).hostname}/` } });
        if (!res.ok) return null;
        const html = await res.text();
        let finalUrl = null;
        const pk = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
        if (pk) {
            const m = pk[0].match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
            if (m) {
                const k = m[4].split('|'); const a = parseInt(m[2]);
                const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
                const decode = (l, s) => { let r = ''; while (l > 0) { r = chars[l % s] + r; l = Math.floor(l / s); } return r || '0'; };
                const unpacked = m[1].replace(/\b\w+\b/g, l => { const s = parseInt(l, 36); return s < k.length && k[s] ? k[s] : decode(s, a); });
                const hls = unpacked.match(/"hls[24]"\s*:\s*"([^"]+)"/);
                if (hls) finalUrl = hls[1];
            }
        }
        if (!finalUrl) { const r = html.match(/"hls[24]"\s*:\s*"([^"]+)"/) || html.match(/file\s*:\s*["']([^"']+)["']/i); if (r) finalUrl = r[1]; }
        if (!finalUrl) return null;
        if (!finalUrl.startsWith('http')) finalUrl = new URL(url).origin + finalUrl;
        return { url: finalUrl, quality: '1080p', serverName: 'VidHide', headers: { 'Referer': url, 'Origin': new URL(url).origin, 'User-Agent': UA } };
    } catch { return null; }
}

async function resolveFilemoon(url) {
    try {
        const urlObj = new URL(url);
        const videoId = urlObj.pathname.split('/').filter(Boolean).pop();
        if (!videoId) return null;
        const detailsRes = await fetch(`https://${urlObj.hostname}/api/videos/${videoId}/embed/details`, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': url, 'User-Agent': UA } });
        const details = await detailsRes.json();
        if (!details.embed_frame_url) return null;
        const pd = new URL(details.embed_frame_url).origin;
        const ch = await (await fetch(`${pd}/api/videos/access/challenge`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': details.embed_frame_url, 'Origin': pd, 'User-Agent': UA } })).json();
        if (!ch.challenge_id) return null;
        const vid = Math.random().toString(36).substring(2, 15);
        const did = Math.random().toString(36).substring(2, 15);
        const att = await (await fetch(`${pd}/api/videos/access/attest`, { method: 'POST', body: JSON.stringify({ viewer_id: vid, device_id: did, challenge_id: ch.challenge_id, nonce: ch.nonce, signature: 'MEUCIQDYi5fX9gG8_5t_4v8p_Q8o8l5v8v8v8v8v8v8v8v8v', public_key: { kty: 'EC', crv: 'P-256', x: 'thRcTF9d89tZ704lTYciJq48dtIaoqf9L0Is1gK29II', y: 'v8Oo5z9N9406uE4RnU3dlmpbAaMQtt61uynn6kgz4_Q' }, client: { user_agent: UA, platform: 'Windows', languages: ['es-ES'] }, storage: { cookie: vid, local_storage: vid }, attributes: { entropy: 'high' } }), headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Referer': details.embed_frame_url, 'Origin': pd, 'User-Agent': UA } })).json();
        if (!att.token) return null;
        const play = await (await fetch(`${pd}/api/videos/${videoId}/embed/playback`, { method: 'POST', body: JSON.stringify({ fingerprint: { token: att.token, viewer_id: att.viewer_id || vid, device_id: att.device_id || did, confidence: att.confidence } }), headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Referer': details.embed_frame_url, 'Origin': pd, 'User-Agent': UA } })).json();
        const src = play?.playback?.sources?.[0]?.url;
        if (!src) return null;
        return { url: src, quality: 'HD', serverName: 'Filemoon', headers: { 'User-Agent': UA, 'Referer': pd, 'Origin': pd } };
    } catch { return null; }
}

// Fallback genérico — busca m3u8/mp4 directo en el HTML
async function resolveGeneric(url) {
    try {
        const res = await fetch(url, { headers: { 'Referer': BASE, 'User-Agent': UA } });
        const html = await res.text();
        const m3u8 = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)?.[1];
        if (m3u8) return { url: m3u8, quality: 'HD', serverName: 'Server', headers: { 'Referer': url } };
        const mp4 = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i)?.[1];
        if (mp4) return { url: mp4, quality: 'HD', serverName: 'Server', headers: { 'Referer': url } };
        // mp4upload
        const mpu = html.match(/src="(https?:\/\/[^"]*mp4upload[^"]+)"/)?.[1];
        if (mpu) {
            const mpRes = await fetch(mpu, { headers: { 'Referer': url, 'User-Agent': UA } });
            const mpHtml = await mpRes.text();
            const mpSrc = mpHtml.match(/"file"\s*:\s*"([^"]+\.mp4[^"]*)"/)?.[1]
                || mpHtml.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i)?.[1];
            if (mpSrc) return { url: mpSrc, quality: 'HD', serverName: 'Mp4Upload', headers: { 'Referer': mpu } };
        }
    } catch { }
    return null;
}

async function resolveEmbed(url) {
    if (!url) return null;
    const s = url.toLowerCase();
    try {
        if (s.includes('streamwish') || s.includes('hglink') || s.includes('embedwish') || s.includes('awish') || s.includes('hanerix')) return await resolveStreamWish(url);
        if (s.includes('vidhide') || s.includes('vidhidepro') || s.includes('mivalyo')) return await resolveVidHide(url);
        if (s.includes('filemoon') || s.includes('filemoon.sx')) return await resolveFilemoon(url);
        return await resolveGeneric(url);
    } catch { return null; }
}

// ── BÚSQUEDA ──────────────────────────────────────────────────

async function searchAnime(title) {
    try {
        const res = await fetch(`${BASE}/buscar?q=${encodeURIComponent(title)}`, { headers: HEADERS });
        const html = await res.text();
        // Selector: .col-6.my-3 > a[href]
        const matches = [...html.matchAll(/href="(\/anime\/[^"]+)"/g)];
        return matches[0]?.[1] || null;
    } catch { return null; }
}

async function getEpisodePath(animePath, episode) {
    try {
        const res = await fetch(`${BASE}${animePath}`, { headers: HEADERS });
        const html = await res.text();
        // Episodios: div.row div a[href*=/ver/]
        const epLinks = [...html.matchAll(/href="(\/ver\/[^"]+)"/g)].map(m => m[1]);
        // LatAnime ordena del más reciente al más antiguo — buscar el que contenga el número
        const ep = epLinks.find(l => l.includes(`-${episode}`) || l.endsWith(`-${episode}/`) || l.match(new RegExp(`episodio-0*${episode}(?:[^0-9]|$)`)));
        return ep || null;
    } catch { return null; }
}

// ── getStreams PRINCIPAL ───────────────────────────────────────

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    const { title } = meta;
    if (!title) { console.warn('[LatAnime] Sin título'); return []; }

    season = parseInt(season) || 1;
    episode = parseInt(episode) || 1;

    try {
        // 1. Buscar anime
        const animePath = await searchAnime(title);
        if (!animePath) { console.warn(`[LatAnime] Sin resultados para: ${title}`); return []; }

        // 2. Obtener path del episodio
        let epPath = null;
        if (mediaType === 'tv') {
            epPath = await getEpisodePath(animePath, episode);
            if (!epPath) {
                // Fallback: construir slug directo
                const slug = animePath.replace('/anime/', '');
                epPath = `/ver/${slug}-episodio-${episode}`;
                console.warn(`[LatAnime] Fallback slug: ${epPath}`);
            }
        } else {
            // Película/OVA — ir directo a la página del anime
            epPath = animePath.replace('/anime/', '/ver/') + '-episodio-1';
        }

        // 3. Cargar página del episodio y extraer players
        const epRes = await fetch(`${BASE}${epPath}`, { headers: HEADERS });
        if (!epRes.ok) { console.warn('[LatAnime] Episodio no encontrado:', epPath); return []; }
        const epHtml = await epRes.text();

        // Extraer todos los data-player (base64) — igual que el código Kotlin original
        const playerMatches = [...epHtml.matchAll(/data-player="([^"]+)"/g)];
        if (playerMatches.length === 0) { console.warn('[LatAnime] Sin players en:', epPath); return []; }

        const streams = [];
        await Promise.all(playerMatches.map(async ([, encoded]) => {
            try {
                const decoded = base64Decode(encoded);
                const cleanUrl = cleanPlayerUrl(decoded);
                if (!cleanUrl || !cleanUrl.startsWith('http')) return;

                const resolved = await resolveEmbed(cleanUrl);
                if (!resolved?.url) return;

                const streamName = mediaType === 'tv'
                    ? `LatAnime · T${season}E${episode} - ${resolved.serverName || 'Server'}`
                    : `LatAnime · Película - ${resolved.serverName || 'Server'}`;

                streams.push({
                    name: streamName,
                    url: resolved.url,
                    quality: resolved.quality || 'HD',
                    headers: resolved.headers || { 'Referer': BASE, 'User-Agent': UA },
                });
            } catch { }
        }));

        return streams;

    } catch (err) {
        console.error('[LatAnime] Error:', err.message);
        return [];
    }
}
