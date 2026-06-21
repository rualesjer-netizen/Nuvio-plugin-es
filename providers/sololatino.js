// providers/sololatino.js
export const name = 'SoloLatino';

// ============================================================
// UTILS
// ============================================================

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const BASE_URL = 'https://player.pelisserieshoy.com';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const HEADERS = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://sololatino.net/',
};

function getStealthHeaders() {
    return {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-US,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'sec-ch-ua': '"Chromium";v="137", "Not-A.Brand";v="24", "Google Chrome";v="137"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
    };
}

// ============================================================
// MIRRORS
// ============================================================

const MIRRORS = {
    VOE: ['voe.sx', 'voe-sx', 'voex.sx', 'marissashare', 'cloudwindow'],
    STREAMWISH: ['hlswish', 'streamwish', 'hglink', 'embedwish', 'awish', 'strwish', 'filelions', 'wishfast', 'hanerix'],
    FILEMOON: ['filemoon', 'moonalu', 'moonembed', 'bysedikamoum', 'fmoon.top'],
    VIDHIDE: ['vidhide', 'minochinos', 'vadisov', 'vaiditv', 'amusemre', 'vidhidepro', 'mdfury', 'dintezuvio', 'vidoza', 'supervideo'],
    DOODSTREAM: ['dood.', 'dsvplay', 'doodstream', 'ds2video', 'ds2play', 'd000d', 'd0o0d'],
    GOODSTREAM: ['goodstream', 'gs.one'],
    OKRU: ['ok.ru', 'okru'],
    PIXELDRAIN: ['pixeldrain'],
    BUZZHEAVIER: ['buzzheavier', 'bzh.sh'],
    LULUSTREAM: ['lulustream', 'luluvdo', 'luluvids', 'pondy'],
    DROPCDN: ['dropcdn', 'dropload', 'dr0pstream'],
    FASTREAM: ['fastream', 'fastplay', 'fembed'],
    VIDMOLY: ['vidmoly'],
    VIDHIDE_EXTRA: ['masukestin', 'callistanise', 'vhaudm', 'vedonm'],
};

function isMirror(url, group) {
    if (!url || !MIRRORS[group]) return false;
    const s = url.toLowerCase();
    return MIRRORS[group].some(m => s.includes(m));
}

// ============================================================
// M3U8 QUALITY PARSER
// ============================================================

function getQualityFromHeight(h) {
    if (!h) return '1080p';
    h = parseInt(h);
    if (h >= 2160) return '4K';
    if (h >= 1440) return '1440p';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    if (h >= 360) return '360p';
    return '1080p';
}

async function validateStream(stream, signal = null) {
    if (!stream?.url) return stream;
    try {
        const isMp4 = stream.url.toLowerCase().includes('.mp4');
        const res = await fetch(stream.url, {
            method: isMp4 ? 'HEAD' : 'GET',
            headers: { 'User-Agent': UA, ...(stream.headers || {}) },
            signal,
        });
        if (!res.ok) return { ...stream, verified: false };
        if (isMp4) return { ...stream, verified: true, quality: stream.quality || '1080p', isReal: true };
        const text = await res.text();
        let bestHeight = 0;
        for (const line of text.split('\n')) {
            const m = line.match(/RESOLUTION=\d+x(\d+)/i);
            if (m && parseInt(m[1]) > bestHeight) bestHeight = parseInt(m[1]);
        }
        return {
            ...stream,
            verified: true,
            quality: bestHeight > 0 ? getQualityFromHeight(bestHeight) : (stream.quality || '1080p'),
            isReal: bestHeight > 0,
        };
    } catch {
        return { ...stream, verified: false };
    }
}

// ============================================================
// RESOLVER: VOE
// ============================================================

function localAtob(input) {
    if (!input) return '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '').replace(/[\s\n\r\t]/g, '');
    let output = '';
    for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

async function resolveVoe(url, signal = null) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal });
        if (!res.ok) return null;
        const html = await res.text();

        const jsonMatch = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1].trim());
                let encText = Array.isArray(parsed) ? parsed[0] : parsed;
                if (typeof encText !== 'string') return null;
                let decoded = encText.replace(/[a-zA-Z]/g, c => {
                    const code = c.charCodeAt(0);
                    const limit = c <= 'Z' ? 90 : 122;
                    const shifted = code + 13;
                    return String.fromCharCode(limit >= shifted ? shifted : shifted - 26);
                });
                for (const n of ['@$', '^^', '~@', '%?', '*~', '!!', '#&']) decoded = decoded.split(n).join('');
                const b64_1 = localAtob(decoded);
                if (!b64_1) throw new Error('atob1 fail');
                let shifted = '';
                for (let j = 0; j < b64_1.length; j++) shifted += String.fromCharCode(b64_1.charCodeAt(j) - 3);
                const decrypted = localAtob(shifted.split('').reverse().join(''));
                if (!decrypted) throw new Error('atob2 fail');
                const data = JSON.parse(decrypted);
                if (data?.source) {
                    return { url: data.source, quality: '1080p', verified: true, isReal: true, serverName: 'VOE', headers: { 'User-Agent': UA, 'Referer': url } };
                }
            } catch { }
        }

        const m3u8 = html.match(/["'](https?:\/\/[^"']+?\.m3u8[^"']*?)["']/i)?.[1];
        if (m3u8) return { url: m3u8, quality: '1080p', verified: true, serverName: 'VOE', headers: { 'Referer': url, 'User-Agent': UA } };
        return null;
    } catch { return null; }
}

// ============================================================
// RESOLVER: STREAMWISH / HLSWISH
// ============================================================

function unpackEval(payload, radix, symtab) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const unbase = str => { let r = 0; for (const c of str) { const p = chars.indexOf(c); if (p === -1) return NaN; r = r * radix + p; } return r; };
    return payload.replace(/\b([0-9a-zA-Z]+)\b/g, match => { const idx = unbase(match); return (!isNaN(idx) && idx < symtab.length && symtab[idx]) ? symtab[idx] : match; });
}

async function resolveStreamWish(url, signal = null) {
    try {
        const rawId = url.split('/').pop().replace(/\.html$/, '');
        const mirrors = [
            `https://hanerix.com/e/${rawId}`,
            `https://embedwish.com/e/${rawId}`,
            `https://hglink.to/e/${rawId}`,
            url,
            `https://streamwish.to/e/${rawId}`,
            `https://awish.pro/e/${rawId}`,
        ];

        const result = await new Promise(resolve => {
            let done = false; let pending = mirrors.length;
            mirrors.forEach(async mirror => {
                try {
                    const resp = await fetch(mirror, { headers: { 'Referer': mirror, 'User-Agent': UA }, signal });
                    if (!resp.ok) throw new Error();
                    const html = await resp.text();
                    let m3u8 = null;

                    const hashMatch = html.match(/[0-9a-f]{32}/i);
                    if (hashMatch) {
                        const dlUrl = `${new URL(mirror).origin}/dl?op=view&file_code=${rawId}&hash=${hashMatch[0]}&embed=1&adb=1&hls4=1`;
                        const dlRes = await fetch(dlUrl, { headers: { 'User-Agent': UA, 'Referer': mirror, 'X-Requested-With': 'XMLHttpRequest' }, signal });
                        if (dlRes.ok) { const t = await dlRes.text(); const m = t.match(/https?:\/\/[^"']+\.m3u8[^"']*/); if (m) m3u8 = m[0]; }
                    }

                    if (!m3u8) {
                        const packed = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
                        if (packed) { const u = unpackEval(packed[1], parseInt(packed[2]), packed[4].split('|')); const m = u.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/); if (m) m3u8 = m[0]; }
                    }

                    if (!m3u8) { const f = html.match(/file\s*:\s*["']([^"']+)["']/i); if (f) m3u8 = f[1]; }

                    if (m3u8 && !done) { done = true; resolve({ url: m3u8.replace(/\\/g, ''), mirror }); }
                } catch { } finally { pending--; if (pending === 0 && !done) resolve(null); }
            });
            setTimeout(() => { if (!done) { done = true; resolve(null); } }, 3500);
        });

        if (!result) return null;
        return { url: result.url, quality: 'Auto', verified: true, isReal: true, serverName: 'StreamWish', headers: { 'Referer': result.mirror, 'Origin': new URL(result.mirror).origin, 'User-Agent': UA } };
    } catch { return null; }
}

// ============================================================
// RESOLVER: VIDHIDE
// ============================================================

async function resolveVidHide(url, signal = null) {
    try {
        const res = await fetch(url, { signal, headers: { 'User-Agent': UA, 'Referer': `https://${new URL(url).hostname}/` } });
        if (!res.ok) return null;
        const html = await res.text();

        let finalUrl = null;
        const packed = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
        if (packed) {
            const m = packed[0].match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
            if (m) {
                const k = m[4].split('|'); const a = parseInt(m[2]);
                const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
                const decode = (l, s) => { let r = ''; while (l > 0) { r = chars[l % s] + r; l = Math.floor(l / s); } return r || '0'; };
                const unpacked = m[1].replace(/\b\w+\b/g, l => { const s = parseInt(l, 36); return s < k.length && k[s] ? k[s] : decode(s, a); });
                const hls = unpacked.match(/"hls[24]"\s*:\s*"([^"]+)"/);
                if (hls) finalUrl = hls[1];
            }
        }

        if (!finalUrl) {
            const raw = html.match(/"hls[24]"\s*:\s*"([^"]+)"/) || html.match(/file\s*:\s*["']([^"']+)["']/i);
            if (raw) finalUrl = raw[1];
        }

        if (!finalUrl) return null;
        if (!finalUrl.startsWith('http')) finalUrl = new URL(url).origin + finalUrl;
        return { url: finalUrl, quality: '1080p', verified: true, serverName: 'VidHide', headers: { 'Referer': url, 'Origin': new URL(url).origin, 'User-Agent': UA } };
    } catch { return null; }
}

// ============================================================
// RESOLVER: FILEMOON
// ============================================================

async function resolveFilemoon(url, signal = null) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const videoId = urlObj.pathname.split('/').filter(Boolean).pop();
        if (!videoId) return null;

        const detailsRes = await fetch(`https://${hostname}/api/videos/${videoId}/embed/details`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': url, 'User-Agent': UA }
        });
        const details = await detailsRes.json();
        const frameUrl = details.embed_frame_url;
        if (!frameUrl) return null;

        const playbackDomain = new URL(frameUrl).origin;
        const challengeRes = await fetch(`${playbackDomain}/api/videos/access/challenge`, {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': frameUrl, 'Origin': playbackDomain, 'User-Agent': UA }
        });
        const challenge = await challengeRes.json();
        if (!challenge.challenge_id) return null;

        const viewerId = Math.random().toString(36).substring(2, 15);
        const deviceId = Math.random().toString(36).substring(2, 15);

        const attestRes = await fetch(`${playbackDomain}/api/videos/access/attest`, {
            method: 'POST',
            body: JSON.stringify({
                viewer_id: viewerId, device_id: deviceId,
                challenge_id: challenge.challenge_id, nonce: challenge.nonce,
                signature: 'MEUCIQDYi5fX9gG8_5t_4v8p_Q8o8l5v8v8v8v8v8v8v8v8v',
                public_key: { kty: 'EC', crv: 'P-256', x: 'thRcTF9d89tZ704lTYciJq48dtIaoqf9L0Is1gK29II', y: 'v8Oo5z9N9406uE4RnU3dlmpbAaMQtt61uynn6kgz4_Q' },
                client: { user_agent: UA, platform: 'Windows', languages: ['es-ES'] },
                storage: { cookie: viewerId, local_storage: viewerId },
                attributes: { entropy: 'high' }
            }),
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Referer': frameUrl, 'Origin': playbackDomain, 'User-Agent': UA }
        });
        const attestData = await attestRes.json();
        if (!attestData.token) return null;

        const playRes = await fetch(`${playbackDomain}/api/videos/${videoId}/embed/playback`, {
            method: 'POST',
            body: JSON.stringify({ fingerprint: { token: attestData.token, viewer_id: attestData.viewer_id || viewerId, device_id: attestData.device_id || deviceId, confidence: attestData.confidence } }),
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Referer': frameUrl, 'Origin': playbackDomain, 'User-Agent': UA }
        });
        const playData = await playRes.json();

        if (playData?.playback?.sources?.[0]?.url) {
            return { url: playData.playback.sources[0].url, quality: 'HD', verified: true, serverName: 'Filemoon', headers: { 'User-Agent': UA, 'Referer': playbackDomain, 'Origin': playbackDomain } };
        }
        return null;
    } catch { return null; }
}

// ============================================================
// RESOLVER: DOODSTREAM
// ============================================================

async function resolveDoodStream(url, signal = null) {
    try {
        let embedUrl = url.includes('/e/') ? url : url.replace(/\/(d|f)\//, '/e/');
        const res = await fetch(embedUrl, { signal, headers: { 'User-Agent': UA, 'Referer': 'https://lamovie.cc/' } });
        if (!res.ok) return null;
        const html = await res.text();

        const match = html.match(/\$\.get\(['"](\/pass_md5\/[\w-]+)\/([\w-]+)['"]/i);
        if (!match) return null;

        const domain = new URL(embedUrl).origin;
        const passRes = await fetch(`${domain}${match[1]}`, { headers: { 'User-Agent': UA, 'Referer': embedUrl }, signal });
        if (!passRes.ok) return null;
        const base = await passRes.text();

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let rand = '';
        for (let i = 0; i < 10; i++) rand += chars[Math.floor(Math.random() * chars.length)];

        return { url: `${base}${rand}?token=${match[2]}&expiry=${Date.now()}`, quality: '720p', verified: true, serverName: 'DoodStream', headers: { 'User-Agent': UA, 'Referer': `${domain}/` } };
    } catch { return null; }
}

// ============================================================
// RESOLVER: GOODSTREAM
// ============================================================

async function resolveGoodStream(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://goodstream.one/', 'Accept-Language': 'es-MX,es;q=0.9' } });
        const html = await res.text();
        const m = html.match(/file:\s*"([^"]+)"/);
        if (!m) return null;
        return { url: m[1], quality: '1080p', verified: true, serverName: 'GoodStream', headers: { 'Referer': url, 'Origin': 'https://goodstream.one', 'User-Agent': UA } };
    } catch { return null; }
}

// ============================================================
// RESOLVER PRINCIPAL (router)
// ============================================================

async function resolveEmbed(url, signal = null) {
    if (!url) return null;
    const s = url.toLowerCase();

    if (isMirror(s, 'VOE')) return await resolveVoe(url, signal);
    if (isMirror(s, 'STREAMWISH') || s.includes('filelions')) return await resolveStreamWish(url, signal);
    if (isMirror(s, 'FILEMOON')) return await resolveFilemoon(url, signal);
    if (isMirror(s, 'VIDHIDE') || isMirror(s, 'VIDHIDE_EXTRA')) return await resolveVidHide(url, signal);
    if (isMirror(s, 'DOODSTREAM')) return await resolveDoodStream(url, signal);
    if (isMirror(s, 'GOODSTREAM')) return await resolveGoodStream(url);

    // Fallback genérico — buscar .m3u8 o .mp4 directo en el HTML
    try {
        const res = await fetch(url, { headers: { 'Referer': url, 'User-Agent': UA }, signal });
        const html = await res.text();
        const m3u8 = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i)?.[1];
        if (m3u8) return { url: m3u8, quality: 'HD', verified: true, serverName: 'Server', headers: { 'Referer': url } };
        const mp4 = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i)?.[1];
        if (mp4) return { url: mp4, quality: 'HD', verified: true, serverName: 'Server', headers: { 'Referer': url } };
    } catch { }

    return { url, quality: 'SD', verified: false, headers: { 'User-Agent': UA, 'Referer': url } };
}

// ============================================================
// TMDB → IMDB
// ============================================================

async function getImdbId(tmdbId, mediaType) {
    const rawId = tmdbId.toString().split(':')[0];
    if (rawId.startsWith('tt')) return rawId;
    try {
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${rawId}/external_ids?api_key=${TMDB_API_KEY}`, { headers: { 'User-Agent': UA } });
        const data = await res.json();
        return data.imdb_id || null;
    } catch { return null; }
}

// ============================================================
// STREAM DIRECTO DEL PLAYER
// ============================================================

async function getDirectStream(id, token, cookie, playerUrl) {
    try {
        const headers = { ...HEADERS, 'Referer': playerUrl, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
        if (cookie) headers['cookie'] = cookie;
        const res = await fetch(`${BASE_URL}/s.php`, { method: 'POST', headers, body: `a=2&v=${id}&tok=${token}` });
        const data = await res.json();
        if (!data?.u) return null;
        let videoUrl = data.u;
        if (data.sig) videoUrl = `${BASE_URL}/p.php?url=${encodeURIComponent(data.u)}&sig=${data.sig}`;
        if (!videoUrl.startsWith('http')) videoUrl = BASE_URL + videoUrl;
        return videoUrl;
    } catch { return null; }
}

// ============================================================
// getStreams PRINCIPAL
// ============================================================

export async function getStreams(tmdbId, mediaType, season, episode, meta = {}) {
    if (!tmdbId) return [];

    try {
        const imdbId = await getImdbId(tmdbId, mediaType);
        if (!imdbId) { console.warn('[SoloLatino] Sin IMDB ID para:', tmdbId); return []; }

        const epStr = episode < 10 ? `0${episode}` : `${episode}`;
        const slug = mediaType === 'movie' ? imdbId : `${imdbId}-${season}x${epStr}`;
        const playerUrl = `${BASE_URL}/f/${slug}`;

        const playerRes = await fetch(playerUrl, { headers: HEADERS });
        if (!playerRes.ok) return [];

        const html = await playerRes.text();
        const cookie = playerRes.headers.get('set-cookie') || '';

        const tokenMatch = html.match(/(?:let\s+token|const\s+_t|tok|_t|token)\s*.*['"]([a-f0-9]{32})['"]/);
        if (!tokenMatch) { console.warn('[SoloLatino] Sin token en player'); return []; }
        const token = tokenMatch[1];

        const postHeaders = { ...HEADERS, 'Referer': playerUrl, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
        if (cookie) postHeaders['cookie'] = cookie;

        await fetch(`${BASE_URL}/s.php`, { method: 'POST', headers: postHeaders, body: `a=click&tok=${token}` }).catch(() => {});
        await sleep(1000);

        const scanRes = await fetch(`${BASE_URL}/s.php`, { method: 'POST', headers: postHeaders, body: `a=1&tok=${token}` });
        const scanData = await scanRes.json();

        const uniqueServers = new Map();
        if (scanData?.s) scanData.s.forEach(ser => { if (ser[1]) uniqueServers.set(ser[1], { ...ser, lang: 'Latino' }); });
        if (scanData?.langs_s) {
            (scanData.langs_s.LAT || []).forEach(ser => { if (ser[1]) uniqueServers.set(ser[1], { ...ser, lang: 'Latino' }); });
            (scanData.langs_s.ESP || scanData.langs_s.CAS || []).forEach(ser => { if (ser[1]) uniqueServers.set(ser[1], { ...ser, lang: 'Castellano' }); });
        }

        const servers = Array.from(uniqueServers.values())
            .filter(ser => !['Seek', 'Lulu'].some(x => ser[0]?.includes(x)))
            .slice(0, 5);

        if (servers.length === 0) { console.warn('[SoloLatino] Sin servidores'); return []; }

        const results = await Promise.all(servers.map(async (ser) => {
            const [serverName, id] = ser;
            const lang = ser.lang || 'Latino';

            let videoUrl = await getDirectStream(id, token, cookie, playerUrl);
            if (!videoUrl) return null;

            // Intentar resolver embed (VOE, StreamWish, Filemoon, etc.)
            const resolved = await resolveEmbed(videoUrl);
            const finalUrl = resolved?.url || videoUrl;
            const quality = resolved?.quality || 'HD';
            const headers = resolved?.headers || { 'User-Agent': UA, 'Referer': playerUrl };

            const streamName = mediaType === 'tv'
                ? `SoloLatino · T${season}E${episode} [${lang}] - ${resolved?.serverName || serverName}`
                : `SoloLatino · Película [${lang}] - ${resolved?.serverName || serverName}`;

            return { name: streamName, url: finalUrl, quality, headers };
        }));

        return results.filter(Boolean);

    } catch (err) {
        console.error('[SoloLatino] Error:', err.message);
        return [];
    }
}
