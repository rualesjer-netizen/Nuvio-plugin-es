const BASE = 'https://animeav1.com';
const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Referer': BASE + '/' };

// Sufijos de temporada que usa AnimeAV1
var SEASON_SUFFIXES = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

function unpack(packed) {
    var m = packed.match(/\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)\)/);
    if (!m) return packed;
    var p = m[1], a = parseInt(m[2]), k = m[4].split('|');
    var alpha = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    function enc(i, b) { return i < b ? alpha[i] : enc(Math.floor(i / b), b) + alpha[i % b]; }
    for (var i = k.length - 1; i >= 0; i--) {
        if (k[i]) p = p.replace(new RegExp('\\b' + enc(i, a) + '\\b', 'g'), k[i]);
    }
    return p;
}

function resolvePlayerZilla(url) {
    var id = url.split('/').pop();
    return Promise.resolve({
        url: 'https://player.zilla-networks.com/m3u8/' + id,
        quality: '1080p',
        headers: { 'Referer': url, 'User-Agent': UA }
    });
}

function resolveMp4Upload(url) {
    var idMatch = url.match(/mp4upload\.com\/(embed-|)([A-Za-z0-9]*)/);
    var realUrl = idMatch ? 'https://www.mp4upload.com/embed-' + idMatch[2] + '.html' : url;
    return fetch(realUrl, { headers: { 'Referer': url, 'User-Agent': UA } })
        .then(function(r) { return r.text(); })
        .then(function(html) {
            var packed = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]+?\.split\('\|'\)\)\)/);
            var text = packed ? unpack(packed[0]) : html;
            var mp4 = text.match(/player\.src\("([^"]+)"/) || text.match(/player\.src\([\s\S]*?src:\s*"([^"]+)"/);
            if (!mp4) return null;
            return { url: mp4[1], quality: '1080p', headers: { 'Referer': realUrl, 'User-Agent': UA } };
        })
        .catch(function() { return null; });
}

function resolveGeneric(url) {
    return fetch(url, { headers: { 'Referer': BASE + '/', 'User-Agent': UA } })
        .then(function(r) { return r.text(); })
        .then(function(html) {
            var m3u8 = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
            if (m3u8) return { url: m3u8[1], quality: 'HD', headers: { 'Referer': url, 'User-Agent': UA } };
            var mp4 = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);
            if (mp4) return { url: mp4[1], quality: 'HD', headers: { 'Referer': url, 'User-Agent': UA } };
            return null;
        })
        .catch(function() { return null; });
}

function resolveEmbed(url) {
    if (!url) return Promise.resolve(null);
    var s = url.toLowerCase();
    if (s.includes('zilla-networks.com')) return resolvePlayerZilla(url);
    if (s.includes('mp4upload.com')) return resolveMp4Upload(url);
    return resolveGeneric(url);
}

function getTitle(tmdbId, mediaType) {
    var type = mediaType === 'movie' ? 'movie' : 'tv';
    return fetch('https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=es-MX', { headers: { 'User-Agent': UA } })
        .then(function(r) { return r.json(); })
        .then(function(data) { return data.title || data.name || null; })
        .catch(function() { return null; });
}

function searchAnime(query) {
    return fetch(BASE + '/catalogo?search=' + encodeURIComponent(query), { headers: HEADERS })
        .then(function(r) { return r.text(); })
        .then(function(html) {
            var m = html.match(/href="(\/media\/[^"]+)"/);
            return m ? m[1] : null;
        })
        .catch(function() { return null; });
}

function getEpisodeStreams(epUrl, seasonLabel, epNum) {
    return fetch(epUrl, { headers: HEADERS })
        .then(function(r) { return r.text(); })
        .then(function(html) {
            var embedsMatch = html.match(/embeds:\{([\s\S]*?)\},downloads/);
            var searchIn = embedsMatch ? embedsMatch[1] : html;
            var matches = [];
            var re = /\{server:"([^"]+)",\s*url:"([^"]+)"/g;
            var m;
            while ((m = re.exec(searchIn)) !== null) {
                matches.push({ server: m[1], url: m[2] });
            }
            return Promise.all(matches.map(function(embed) {
                var url = embed.url.startsWith('//') ? 'https:' + embed.url : embed.url;
                if (!url.startsWith('http')) return null;
                return resolveEmbed(url)
                    .then(function(resolved) {
                        if (!resolved) return null;
                        return {
                            name: 'AnimeAV1',
                            title: seasonLabel + ' Ep. ' + epNum + ' - ' + embed.server,
                            url: resolved.url,
                            quality: resolved.quality || 'HD',
                            headers: resolved.headers || HEADERS
                        };
                    })
                    .catch(function() { return null; });
            }))
            .then(function(results) {
                return results.filter(function(r) { return r !== null; });
            });
        })
        .catch(function() { return []; });
}

function getStreams(tmdbId, mediaType, season, episode) {
    var seasonNum = parseInt(season) || 1;
    var epNum = parseInt(episode) || 1;
    var suffix = SEASON_SUFFIXES[seasonNum - 1] || (' ' + seasonNum);

    return getTitle(tmdbId, mediaType)
        .then(function(baseTitle) {
            if (!baseTitle) {
                console.warn('[AnimeAV1] No se pudo obtener título para: ' + tmdbId);
                return [];
            }

            // Para T1 buscar "Date A Live", para T2 "Date A Live II", etc.
            var searchTitle = baseTitle + suffix;
            console.log('[AnimeAV1] Buscando: ' + searchTitle);

            return searchAnime(searchTitle)
                .then(function(animePath) {
                    // Si no encuentra con sufijo, intentar con título base (para T1)
                    if (!animePath && seasonNum === 1) {
                        return searchAnime(baseTitle);
                    }
                    return animePath;
                })
                .then(function(animePath) {
                    if (!animePath) {
                        console.warn('[AnimeAV1] Sin resultados para: ' + searchTitle);
                        return [];
                    }
                    var epUrl = mediaType === 'tv'
                        ? BASE + animePath + '/' + epNum
                        : BASE + animePath;
                    var seasonLabel = baseTitle + (suffix || '');
                    return getEpisodeStreams(epUrl, seasonLabel, epNum);
                });
        })
        .catch(function(err) {
            console.error('[AnimeAV1] Error: ' + err.message);
            return [];
        });
}

module.exports = { getStreams };
