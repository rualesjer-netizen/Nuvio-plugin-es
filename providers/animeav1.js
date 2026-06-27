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
