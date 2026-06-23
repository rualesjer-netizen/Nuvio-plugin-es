var cheerio = require('cheerio');
var crypto = require('crypto');

var BASE_URL = "https://animeav1.com";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function get(url, extraHeaders) {
    var headers = Object.assign({}, DEFAULT_HEADERS, extraHeaders || {});
    return fetch(url, { headers: headers, redirect: "follow" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
        var ct = res.headers.get("content-type") || "";
        if (ct.indexOf("json") !== -1) return res.json();
        return res.text();
    });
}

function normalizeTitle(t) {
    return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function b64decode(str) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var result = "", i = 0;
    var s = str.replace(/[^A-Za-z0-9+/]/g, "");
    while (i < s.length) {
        var a = chars.indexOf(s[i++]), b = chars.indexOf(s[i++]);
        var c = i < s.length ? chars.indexOf(s[i++]) : -1;
        var d = i < s.length ? chars.indexOf(s[i++]) : -1;
        var n = a << 18 | b << 12 | (c === -1 ? 0 : c) << 6 | (d === -1 ? 0 : d);
        result += String.fromCharCode(n >> 16 & 255);
        if (c !== -1) result += String.fromCharCode(n >> 8 & 255);
        if (d !== -1) result += String.fromCharCode(n & 255);
    }
    return result;
}

function unpack(payload, radix, symtab) {
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var unbase = function (str) {
        var result = 0;
        for (var i = 0; i < str.length; i++) result = result * radix + chars.indexOf(str[i]);
        return result;
    };
    return payload.replace(/\b([0-9a-zA-Z]+)\b/g, function (match) {
        var idx = unbase(match);
        return (isNaN(idx) || idx >= symtab.length || !symtab[idx]) ? match : symtab[idx];
    });}

function unpackPacker(html) {
    var packMatch = html.match(/eval\(function\(p,a,c,k,e,[a-z]\){[\s\S]+?}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/);
    if (packMatch) return unpack(packMatch[1], parseInt(packMatch[2]), packMatch[4].split('|'));
    return html;
}

function decryptAES(hexString, keyStr, ivStr) {
    try {
        var decipher = crypto.createDecipheriv('aes-128-cbc', keyStr, ivStr);
        var decrypted = decipher.update(hexString, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) { return null; }
}

function getTmdbInfo(tmdbId, mediaType) {
    var type = mediaType === "movie" ? "movie" : "tv";
    var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=es-MX";
    return get(url).then(function (data) {
        var title = type === "movie" ? data.title || data.original_title : data.name || data.original_name;
        var originalTitle = type === "movie" ? data.original_title || data.title : data.original_name || data.name;
        var year = (type === "movie" ? data.release_date || "" : data.first_air_date || "").slice(0, 4);
        return { title: title, originalTitle: originalTitle, year: year };
    }).catch(function () { return null; });
}

function resolvePlayerZilla(url) {
    var id = url.substring(url.lastIndexOf('/') + 1);
    var videoUrl = "https://player.zilla-networks.com/m3u8/" + id;
    return Promise.resolve({
        url: videoUrl, quality: "1080p", verified: true,
        headers: { "Referer": BASE_URL + "/" }
    });
}

function resolveMp4Upload(url) {
    var idMatch = url.match(/mp4upload\.com\/(embed-|)([A-Za-z0-9]*)/);
    var realUrl = idMatch ? "https://www.mp4upload.com/embed-" + idMatch[2] + ".html" : url;
    
    return get(realUrl, { "Referer": BASE_URL + "/" }).then(function(html) {
        var unpacked = unpackPacker(html);
        var srcMatch = unpacked.match(/player\.src\("(.*?)"\)/) || unpacked.match(/player\.src\W*src:\s*"(.*?)"/);
        if (srcMatch) {
            var qMatch = unpacked.toLowerCase().match(/height=(\d+)/);
            return {
                url: srcMatch[1], quality: (qMatch ? qMatch[1] + "p" : "1080p"), verified: true,
                headers: { "Referer": realUrl, "User-Agent": DEFAULT_HEADERS["User-Agent"] }
            };        }
        return null;
    }).catch(function (err) { console.log("[Mp4Upload] Error: " + err.message); return null; });
}

function resolveAnimeavUPNS(url) {
    var hash = url.split('#').pop().split('/').pop();
    var baseUrl = url.match(/^(https?:\/\/[^/]+)/)[1];
    var apiUrl = baseUrl + "/api/v1/video?id=" + hash;
    var headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0" };
    
    return get(apiUrl, headers).then(function(hexString) {
        hexString = hexString.trim();
        var key = "kiemtienmua911ca";
        var ivs = ["1234567890oiuytr", "0123456789abcdef"];
        
        for (var i = 0; i < ivs.length; i++) {
            var decrypted = decryptAES(hexString, key, ivs[i]);
            if (decrypted) {
                var sourceMatch = decrypted.match(/"source":"(.*?)"/);
                if (sourceMatch) {
                    var m3u8 = sourceMatch[1].replace(/\\\//g, "/");
                    return {
                        url: m3u8, quality: "1080p", verified: true,
                        headers: { "Referer": url, "User-Agent": DEFAULT_HEADERS["User-Agent"] }
                    };
                }
            }
        }
        return null;
    }).catch(function (err) { console.log("[UPNS] Error: " + err.message); return null; });
}

function resolveHlswish(embedUrl) {
    var embedHost = embedUrl.match(/^(https?:\/\/[^/]+)/)[1];
    return get(embedUrl, { "Referer": BASE_URL + "/", "Accept": "text/html" }).then(function (data) {
        var fileMatch = data.match(/file\s*:\s*["']([^"']+)["']/i);
        if (fileMatch) return { url: fileMatch[1], quality: "1080p", verified: true, headers: { "Referer": embedHost + "/" } };
        
        var packMatch = data.match(/eval\(function\(p,a,c,k,e,[a-z]\){[\s\S]+?}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/);
        if (packMatch) {
            var unpacked = unpack(packMatch[1], parseInt(packMatch[2]), packMatch[4].split('|'));
            var m3u8Match = unpacked.match(/["']([^"']+\.m3u8[^"']*)["']/);
            if (m3u8Match) return { url: m3u8Match[1], quality: "1080p", verified: true, headers: { "Referer": embedHost + "/" } };
        }
        return null;
    }).catch(function () { return null; });
}

function resolveVoe(embedUrl) {    return get(embedUrl, { "Referer": embedUrl }).then(function (data) {
        var re = /(?:mp4|hls)['"\s]*:\s*['"]([^'"]+)['"]/gi;
        var m = re.exec(data);
        if (m) {
            var url = m[1];
            if (url.indexOf("aHR0") === 0) try { url = b64decode(url); } catch (e) {}
            return { url: url, quality: "1080p", verified: true, headers: { "Referer": embedUrl } };
        }
        return null;
    }).catch(function () { return null; });
}

function resolveDoodstream(embedUrl) {
    var UA = DEFAULT_HEADERS["User-Agent"];
    var embedHost = embedUrl.replace(/\/(d|f)\//, "/e/").replace("dsvplay.com", "d0000d.com");
    return get(embedHost, { "User-Agent": UA, "Referer": BASE_URL + "/" }).then(function(html) {
        var match = html.match(/\$.get\(['"]\/pass_md5\/[\w-]+\/([\w-]+)['"]/i);
        if (!match) return null;
        var token = match[1];
        var domain = new URL(embedHost).origin;
        return get(domain + "/pass_md5/" + token + "/" + token, { "User-Agent": UA, "Referer": embedHost }).then(function(videoBaseUrl) {
            if (!videoBaseUrl) return null;
            var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var randomString = "";
            for (var i = 0; i < 10; i++) randomString += chars.charAt(Math.floor(Math.random() * chars.length));
            var finalUrl = videoBaseUrl + randomString + "?token=" + token + "&expiry=" + Date.now();
            return { url: finalUrl, quality: "720p", verified: true, headers: { "User-Agent": UA, "Referer": domain + "/" } };
        });
    }).catch(function () { return null; });
}

function resolvePacker(embedUrl) {
    return get(embedUrl, { "Referer": BASE_URL + "/" }).then(function (html) {
        var unpacked = unpackPacker(html);
        var streamMatch = unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/) || unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/);
        if (streamMatch) {
            var hlsLink = streamMatch[1];
            if (hlsLink.startsWith('/')) hlsLink = embedUrl.match(/^(https?:\/\/[^/]+)/)[1] + hlsLink;
            return { url: hlsLink, quality: "1080p", verified: true, headers: { "Referer": embedUrl } };
        }
        return null;
    }).catch(function () { return null; });
}

function getResolver(url) {
    if (url.indexOf('zilla-networks.com') !== -1 || url.indexOf('player.zilla') !== -1) return resolvePlayerZilla;
    if (url.indexOf('mp4upload.com') !== -1) return resolveMp4Upload;
    if (url.indexOf('uns.bio') !== -1 || url.indexOf('animeav1.uns') !== -1) return resolveAnimeavUPNS;
    
    if (url.indexOf('hlswish') !== -1 || url.indexOf('streamwish') !== -1 || url.indexOf('strwish') !== -1 || url.indexOf('vibuxer') !== -1) return resolveHlswish;    if (url.indexOf('voe.sx') !== -1) return resolveVoe;
    if (url.indexOf('dood') !== -1 || url.indexOf('d0000d') !== -1 || url.indexOf('ds2video') !== -1 || url.indexOf('ds2play') !== -1 || url.indexOf('dsvplay') !== -1) return resolveDoodstream;
    
    return resolvePacker;
}

function getServerName(url) {
    if (url.indexOf('zilla') !== -1) return "PlayerZilla";
    if (url.indexOf('mp4upload') !== -1) return "Mp4Upload";
    if (url.indexOf('uns.bio') !== -1) return "AnimeAV UPNS";
    if (url.indexOf('hlswish') !== -1 || url.indexOf('streamwish') !== -1) return "StreamWish";
    if (url.indexOf('voe.sx') !== -1) return "VOE";
    if (url.indexOf('dood') !== -1 || url.indexOf('d0000d') !== -1) return "DoodStream";
    return "Servidor";
}

function searchAnimeAV(title, season) {
    var query = title;
    if (season > 1) query += " Temporada " + season;
    
    var searchUrl = BASE_URL + "/catalogo?search=" + encodeURIComponent(query);
    return get(searchUrl, { "Referer": BASE_URL + "/" }).then(function(html) {
        var $ = cheerio.load(html);
        var results = [];
        $('div.grid.grid-cols-2 article.group\\/item').each(function() {
            var t = $(this).find('h3').text().trim() || $(this).find('span.sr-only').text().trim();
            var href = $(this).find('a').attr('href');
            if (href) results.push({ title: t, url: href.startsWith('http') ? href : BASE_URL + href });
        });
        
        if (results.length === 0 && season > 1) {
            return get(BASE_URL + "/catalogo?search=" + encodeURIComponent(title), { "Referer": BASE_URL + "/" }).then(function(html2) {
                var $2 = cheerio.load(html2);
                $2('div.grid.grid-cols-2 article.group\\/item').each(function() {
                    var t = $(this).find('h3').text().trim();
                    var href = $(this).find('a').attr('href');
                    if (href) results.push({ title: t, url: href.startsWith('http') ? href : BASE_URL + href });
                });
                return results;
            });
        }
        return results;
    }).then(function(results) {
        if (results.length === 0) return null;
        var normTitle = normalizeTitle(title);
        results.sort(function(a, b) {
            var scoreA = normalizeTitle(a.title).indexOf(normTitle) !== -1 ? 1 : 0;
            var scoreB = normalizeTitle(b.title).indexOf(normTitle) !== -1 ? 1 : 0;
            return scoreB - scoreA;
        });        return results[0].url;
    }).catch(function(err) {
        console.log("[AnimeAV] Error buscando: " + err.message);
        return null;
    });
}

function getEpisodeEmbeds(animeUrl, episode) {
    return get(animeUrl, { "Referer": BASE_URL + "/" }).then(function(html) {
        var $ = cheerio.load(html);
        var episodeUrl = null;
        
        $('article.group\\/item').each(function() {
            var epNum = $(this).find('span.text-lead').text().trim();
            if (String(epNum) === String(episode)) {
                var href = $(this).find('a').attr('href');
                if (href) episodeUrl = href.startsWith('http') ? href : BASE_URL + href;
            }
        });
        
        if (!episodeUrl) episodeUrl = animeUrl + "/" + episode;
        
        return get(episodeUrl, { "Referer": BASE_URL + "/" }).then(function(epHtml) {
            var script = "";
            cheerio.load(epHtml)('script').each(function() {
                var data = cheerio.load(epHtml)(this).html();
                if (data && data.indexOf('__sveltekit') !== -1) script += data;
            });
            
            if (!script) return [];
            
            var embedsStart = script.indexOf('embeds:{');
            var downloadsStart = script.indexOf('},downloads');
            if (embedsStart === -1 || downloadsStart === -1) return [];
            
            var embedsData = script.substring(embedsStart + 8, downloadsStart);
            var embeds = [];
            
            ['DUB', 'SUB'].forEach(function(type) {
                var typeStart = embedsData.indexOf(type + ':[');
                if (typeStart !== -1) {
                    var listStart = typeStart + type.length + 2;
                    var listEnd = embedsData.indexOf(']', listStart);
                    if (listEnd !== -1) {
                        var listContent = embedsData.substring(listStart, listEnd);
                        var itemRegex = /\{server:"([^"]+)",\s*url:"([^"]+)"/g;
                        var match;
                        while ((match = itemRegex.exec(listContent)) !== null) {
                            var server = match[1];
                            var url = match[2];                            if (url.startsWith('//')) url = 'https:' + url;
                            embeds.push({ server: server, url: url, type: type });
                        }
                    }
                }
            });
            return embeds;
        });
    }).catch(function(err) {
        console.log("[AnimeAV] Error obteniendo embeds: " + err.message);
        return [];
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    var resolvedType = mediaType === "series" ? "tv" : mediaType || "movie";
    console.log("[AnimeAV] Buscando TMDB: " + tmdbId + " S" + season + "E" + episode);

    return getTmdbInfo(tmdbId, resolvedType).then(function(info) {
        if (!info || !info.title) return [];
        console.log('[AnimeAV] TMDB: "' + info.title + '"');

        return searchAnimeAV(info.title, season || 1).then(function(animeUrl) {
            if (!animeUrl) {
                console.log("[AnimeAV] No encontrado en la web");
                return [];
            }
            console.log("[AnimeAV] URL del anime: " + animeUrl);

            return getEpisodeEmbeds(animeUrl, episode).then(function(embeds) {
                if (embeds.length === 0) return [];
                console.log("[AnimeAV] " + embeds.length + " embed(s) encontrados");

                var promises = embeds.map(function(embed) {
                    var resolver = getResolver(embed.url);
                    if (!resolver) return Promise.resolve(null);

                    return resolver(embed.url).then(function(result) {
                        if (result && result.url) {
                            var serverName = getServerName(embed.url);
                            var langLabel = embed.type === 'SUB' ? "Subtitulado" : "Latino";
                            return {
                                name: "AnimeAV1",
                                title: langLabel + " · " + serverName + " · " + (result.quality || "1080p"),
                                url: result.url,
                                quality: result.quality || "1080p",
                                verified: result.verified || false,
                                headers: result.headers || {}
                            };
                        }                        return null;
                    }).catch(function() { return null; });
                });

                return Promise.all(promises).then(function(results) {
                    var finalStreams = results.filter(function(r) { return r !== null; });
                    console.log("[AnimeAV] Total final: " + finalStreams.length + " streams");
                    return finalStreams;
                });
            });
        });
    }).catch(function(err) {
        console.log("[AnimeAV] Error fatal: " + err.message);
        return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
