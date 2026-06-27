const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE = "https://animeav1.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": USER_AGENT,
    "Referer": BASE + "/"
};

// ── UTILS ─────────────────────────────────────────────────────

function cleanTitle(t) {
    if (!t) return "";
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

function unpackPacker(html) {
    var m = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)\)/);
    if (!m) return html;
    var payload = m[1], radix = parseInt(m[2]), symtab = m[4].split("|");
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var unbase = function(str) {
        var result = 0;
        for (var i = 0; i < str.length; i++) result = result * radix + chars.indexOf(str[i]);
        return result;
    };
    return payload.replace(/\b([0-9a-zA-Z]+)\b/g, function(match) {
        var idx = unbase(match);
        return (isNaN(idx) || idx >= symtab.length || !symtab[idx]) ? match : symtab[idx];
    });
}

async function fetchText(url, headers) {
    try {
        var resp = await fetch(url, { headers: headers || HEADERS, redirect: "follow" });
        if (!resp.ok) return null;
        return await resp.text();
    } catch (e) { return null; }
}

async function fetchJson(url, headers) {
    try {
        var resp = await fetch(url, { headers: headers || HEADERS, redirect: "follow" });
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) { return null; }
}

// ── TMDB ──────────────────────────────────────────────────────

async function getTMDBSeasonTitle(tmdbId, mediaType, season) {
    try {
        if (mediaType === "movie") {
            var res = await fetchJson(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`);
            return res ? (res.title || res.original_title || null) : null;
        }
        var res = await fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}&language=es-MX`);
        if (res && res.name && res.name !== `Temporada ${season}` && res.name !== `Season ${season}`) {
            return res.name;
        }
        var series = await fetchJson(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`);
        return series ? (series.name || series.original_name || null) : null;
    } catch (e) {
        console.warn(`[AnimeAV1] TMDB Error: ${e.message}`);
        return null;
    }
}

// ── BÚSQUEDA ──────────────────────────────────────────────────

async function searchAnime(title) {
    try {
        var html = await fetchText(`${BASE}/catalogo?search=${encodeURIComponent(title)}`);
        if (!html) return null;
        
        var results = [];
        var re = /href="(\/media\/[^/"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            results.push({ path: m[1], name: m[2].trim() });
        }
        
        if (!results.length) {
            var simple = html.match(/href="(\/media\/[^/"]+)"/);
            return simple ? { path: simple[1], name: "" } : null;
        }
        
        var cleanTitleStr = cleanTitle(title);
        var exact = results.find(r => cleanTitle(r.name) === cleanTitleStr);
        if (exact) return exact;
        
        var partial = results.find(r => {
            var cn = cleanTitle(r.name);
            return cn.includes(cleanTitleStr) || cleanTitleStr.includes(cn);
        });
        if (partial) return partial;
        
        return results[0];
    } catch (e) {
        console.warn(`[AnimeAV1] Search error: ${e.message}`);
        return null;
    }
}

// ── EXTRACCIÓN DE EMBEDS ──────────────────────────────────────

function extractEmbeds(html) {
    var script = html.match(/<script[^>]*>([\s\S]*?__sveltekit[\s\S]*?)<\/script>/);
    if (!script) return [];
    
    var embedsData = script[1].match(/embeds:\s*\{([\s\S]*?)\}/);
    if (!embedsData) return [];
    
    var embeds = [];
    var re = /\{\s*server:\s*"([^"]+)"\s*,\s*url:\s*"([^"]+)"\s*\}/g;
    var m;
    while ((m = re.exec(embedsData[1])) !== null) {
        var url = m[2];
        if (url.startsWith("//")) url = "https:" + url;
        if (url.startsWith("http")) {
            embeds.push({ server: m[1], url: url });
        }
    }
    return embeds;
}

// ── RESOLVERS ─────────────────────────────────────────────────

// PlayerZilla - M3U8 directo (el mejor)
async function resolvePlayerZilla(url) {
    var id = url.split("/").pop();
    return {
        url: `https://player.zilla-networks.com/m3u8/${id}`,
        quality: "1080p",
        verified: true,
        headers: { "Referer": url, "User-Agent": USER_AGENT }
    };
}

// Mp4Upload
async function resolveMp4Upload(url) {
    try {
        var idMatch = url.match(/mp4upload\.com\/(embed-|)([A-Za-z0-9]*)/);
        var realUrl = idMatch ? `https://www.mp4upload.com/embed-${idMatch[2]}.html` : url;
        var html = await fetchText(realUrl, { "Referer": url, "User-Agent": USER_AGENT });
        if (!html) return null;
        
        var unpacked = unpackPacker(html);
        var srcMatch = unpacked.match(/player\.src\("([^"]+)"/) || unpacked.match(/player\.src\W*src:\s*"([^"]+)"/);
        if (!srcMatch) return null;
        
        var qMatch = unpacked.toLowerCase().match(/height=(\d+)/);
        return {
            url: srcMatch[1],
            quality: qMatch ? qMatch[1] + "p" : "1080p",
            verified: true,
            headers: { "Referer": realUrl, "User-Agent": USER_AGENT }
        };
    } catch (e) {
        console.warn(`[Mp4Upload] Error: ${e.message}`);
        return null;
    }
}

// Voe (con decodificación multi-paso)
async function resolveVoe(url) {
    try {
        var html = await fetchText(url, { "Referer": url });
        if (!html) return null;
        
        if (html.indexOf("window.location.href") !== -1 && html.length < 2000) {
            var rm = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
            if (rm) return await resolveVoe(rm[1]);
        }
        
        var jsonMatch = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
        if (jsonMatch) {
            try {
                var parsed = JSON.parse(jsonMatch[1].trim());
                var encText = Array.isArray(parsed) ? parsed[0] : parsed;
                if (typeof encText === "string") {
                    var decoded = encText.replace(/[a-zA-Z]/g, function(c) {
                        var code = c.charCodeAt(0);
                        var limit = c <= "Z" ? 90 : 122;
                        var shifted = code + 13;
                        return String.fromCharCode(limit >= shifted ? shifted : shifted - 26);
                    });
                    
                    var noise = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
                    for (var i = 0; i < noise.length; i++) {
                        decoded = decoded.split(noise[i]).join("");
                    }
                    
                    var b64_1 = b64decode(decoded);
                    if (b64_1) {
                        var shiftedStr = "";
                        for (var j = 0; j < b64_1.length; j++) {
                            shiftedStr += String.fromCharCode(b64_1.charCodeAt(j) - 3);
                        }
                        var reversed = shiftedStr.split("").reverse().join("");
                        var decrypted = b64decode(reversed);
                        if (decrypted) {
                            var finalData = JSON.parse(decrypted);
                            if (finalData && (finalData.source || finalData.direct_access_url)) {
                                return {
                                    url: finalData.source || finalData.direct_access_url,
                                    quality: "1080p",
                                    verified: true,
                                    headers: { "Referer": url, "User-Agent": USER_AGENT }
                                };
                            }
                        }
                    }
                }
            } catch (ex) {
                console.warn(`[VOE] Decrypt error: ${ex.message}`);
            }
        }
        
        var re = /(?:mp4|hls)['"\s]*:\s*['"]([^'"]+)['"]/gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            var candidate = m[1];
            if (!candidate) continue;
            var finalUrl = candidate;
            if (finalUrl.indexOf("aHR0") === 0) {
                try { finalUrl = b64decode(finalUrl); } catch (e) {}
            }
            return { url: finalUrl, quality: "1080p", verified: true, headers: { "Referer": url, "User-Agent": USER_AGENT } };
        }
        return null;
    } catch (e) {
        console.warn(`[VOE] Error: ${e.message}`);
        return null;
    }
}

// StreamWish / FileLions
async function resolveStreamWish(url, serverName) {
    try {
        var rawId = url.split("/").pop().replace(/\.html$/, "");
        var embedHost = url.match(/^(https?:\/\/[^/]+)/)[1];
        
        var html = await fetchText(url, {
            "Referer": BASE + "/",
            "User-Agent": USER_AGENT,
            "Accept": "text/html"
        });
        if (!html) return null;
        
        var m3u8 = null;
        var hm = html.match(/[0-9a-f]{32}/i);
        if (hm) {
            var dl = await fetchText(embedHost + "/dl?op=view&file_code=" + rawId + "&hash=" + hm[0] + "&embed=1&adb=1&hls4=1", {
                "User-Agent": USER_AGENT,
                "Referer": url,
                "X-Requested-With": "XMLHttpRequest"
            });
            if (dl) {
                var mm = dl.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
                if (mm) m3u8 = mm[0];
            }
        }
        
        if (!m3u8) {
            var f = html.match(/file\s*:\s*["']([^"']+)["']/i);
            if (f) m3u8 = f[1];
        }
        
        if (!m3u8) {
            var packMatch = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)\)/);
            if (packMatch) {
                var unpacked = unpackPacker(html);
                var m3 = unpacked.match(/["']([^"']{30,}\.m3u8[^"']*)["']/);
                if (m3) m3u8 = m3[1];
            }
        }
        
        if (!m3u8) {
            var rawM3u8 = html.match(/https?:\/\/[^"'\s\]]+\.m3u8[^"'\s\]]*/i);
            if (rawM3u8) m3u8 = rawM3u8[0];
        }
        
        if (m3u8) {
            return {
                url: m3u8.replace(/\\/g, ""),
                quality: "1080p",
                verified: true,
                headers: { "User-Agent": USER_AGENT, "Referer": embedHost + "/", "Origin": embedHost }
            };
        }
        return null;
    } catch (e) {
        console.warn(`[${serverName || "StreamWish"}] Error: ${e.message}`);
        return null;
    }
}

// VidHide
async function resolveVidHide(url) {
    try {
        var html = await fetchText(url, { "Referer": BASE + "/", "User-Agent": USER_AGENT });
        if (!html) return null;
        
        var m3u8 = null;
        var f = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (f) m3u8 = f[1];
        
        if (!m3u8) {
            var packMatch = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)\)/);
            if (packMatch) {
                var unpacked = unpackPacker(html);
                var m = unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
                if (m) m3u8 = m[1];
            }
        }
        
        if (m3u8) {
            var embedHost = url.match(/^(https?:\/\/[^/]+)/)[1];
            return {
                url: m3u8.replace(/\\/g, ""),
                quality: "1080p",
                verified: true,
                headers: { "User-Agent": USER_AGENT, "Referer": embedHost + "/", "Origin": embedHost }
            };
        }
        return null;
    } catch (e) {
        console.warn(`[VidHide] Error: ${e.message}`);
        return null;
    }
}

// DoodStream
async function resolveDood(url) {
    try {
        var embedUrl = url.includes("/e/") ? url : url.replace(/\/(d|f)\//, "/e/");
        embedUrl = embedUrl.replace("dsvplay.com", "d0000d.com");
        
        var html = await fetchText(embedUrl, { "User-Agent": USER_AGENT, "Referer": BASE + "/" });
        if (!html) return null;
        
        var m = html.match(/\$\.get\(['"](\/pass_md5\/[\w-]+\/[\w-]+)['"]/i);
        if (!m) return null;
        
        var domain = new URL(embedUrl).origin;
        var base = await fetchText(domain + m[1], { "User-Agent": USER_AGENT, "Referer": embedUrl });
        if (!base) return null;
        
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var rand = "";
        for (var i = 0; i < 10; i++) rand += chars[Math.floor(Math.random() * chars.length)];
        
        var tokenMatch = m[1].match(/\/pass_md5\/[\w-]+\/([\w-]+)/);
        var token = tokenMatch ? tokenMatch[1] : "";
        
        return {
            url: base + rand + "?token=" + token + "&expiry=" + Date.now(),
            quality: "720p",
            verified: true,
            headers: { "User-Agent": USER_AGENT, "Referer": domain + "/" }
        };
    } catch (e) {
        console.warn(`[DoodStream] Error: ${e.message}`);
        return null;
    }
}

// YourUpload
async function resolveYourUpload(url) {
    try {
        var html = await fetchText(url, { "Referer": BASE + "/", "User-Agent": USER_AGENT });
        if (!html) return null;
        
        var m = html.match(/property\s*=\s*"og:video"[\s\S]*?content\s*=\s*"([^"]+)"/i);
        if (m) {
            return {
                url: m[1],
                quality: "720p",
                verified: true,
                headers: { "Referer": url, "User-Agent": USER_AGENT }
            };
        }
        return null;
    } catch (e) {
        console.warn(`[YourUpload] Error: ${e.message}`);
        return null;
    }
}

// PixelDrain
async function resolvePixelDrain(url) {
    try {
        var id = url.split("/").pop();
        var apiUrl = `https://pixeldrain.com/api/file/${id}/info`;
        var data = await fetchJson(apiUrl, { "User-Agent": USER_AGENT, "Referer": url });
        
        if (data && data.id) {
            return {
                url: `https://pixeldrain.com/u/${id}`,
                quality: "1080p",
                verified: true,
                headers: { "Referer": url, "User-Agent": USER_AGENT }
            };
        }
        return null;
    } catch (e) {
        console.warn(`[PixelDrain] Error: ${e.message}`);
        return null;
    }
}

// Resolver principal
async function resolveEmbed(url, serverName) {
    if (!url || !url.startsWith("http")) return null;
    
    var s = url.toLowerCase();
    var t = (serverName || "").toLowerCase();
    
    if (s.includes("player.zilla") || s.includes("zilla-networks") || t.includes("hls")) {
        return await resolvePlayerZilla(url);
    }
    if (s.includes("voe") || t.includes("voe")) {
        return await resolveVoe(url);
    }
    if (s.includes("mp4upload") || t.includes("mp4")) {
        return await resolveMp4Upload(url);
    }
    if (s.includes("streamwish") || s.includes("wishembed") || s.includes("strwish") || 
        s.includes("swdyu") || s.includes("filelions") || s.includes("fviplions") || 
        t.includes("wish") || t.includes("filelions")) {
        return await resolveStreamWish(url, serverName);
    }
    if (s.includes("vidhide") || s.includes("ahvsh") || s.includes("streamhide") || 
        s.includes("guccihide") || s.includes("streamvid") || t.includes("vidhide")) {
        return await resolveVidHide(url);
    }
    if (s.includes("dood") || s.includes("ds2play") || s.includes("d0000d") || 
        s.includes("ds2video") || t.includes("dood")) {
        return await resolveDood(url);
    }
    if (s.includes("yourupload") || t.includes("upload")) {
        return await resolveYourUpload(url);
    }
    if (s.includes("pixeldrain") || t.includes("pixel")) {
        return await resolvePixelDrain(url);
    }
    
    // Fallback: buscar m3u8 o mp4 directamente
    try {
        var html = await fetchText(url);
        if (!html) return null;
        
        var m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m3u8) {
            return {
                url: m3u8[1],
                quality: "HD",
                verified: false,
                headers: { "Referer": url, "User-Agent": USER_AGENT }
            };
        }
        
        var mp4 = html.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
        if (mp4) {
            return {
                url: mp4[1],
                quality: "HD",
                verified: false,
                headers: { "Referer": url, "User-Agent": USER_AGENT }
            };
        }
    } catch (e) {}
    
    return null;
}

// ── GET STREAMS PRINCIPAL ─────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode, title) {
    var seasonNum = parseInt(season) || 1;
    var epNum = parseInt(episode) || 1;
    var searchTitle = title;
    
    var tmdbTitle = await getTMDBSeasonTitle(tmdbId, mediaType, seasonNum);
    if (tmdbTitle) searchTitle = tmdbTitle;
    
    if (!searchTitle) return [];
    
    try {
        var anime = await searchAnime(searchTitle);
        if (!anime) return [];
        
        var epUrl = mediaType === "tv" ? `${BASE}${anime.path}/${epNum}` : `${BASE}${anime.path}`;
        var epHtml = await fetchText(epUrl);
        if (!epHtml) return [];
        
        var embeds = extractEmbeds(epHtml);
        if (!embeds.length) return [];
        
        console.warn(`[AnimeAV1] ${embeds.length} embed(s) encontrados`);
        
        var streams = [];
        var promises = embeds.map(async function(embed) {
            try {
                var resolved = await resolveEmbed(embed.url, embed.server);
                if (!resolved || !resolved.url) return null;
                
                var qualityLabel = resolved.quality || "HD";
                var checkMark = resolved.verified ? "✅" : "";
                
                return {
                    name: "AnimeAV1",
                    title: `${embed.server} · ${qualityLabel}${checkMark} - T${seasonNum}E${epNum}`,
                    url: resolved.url,
                    quality: qualityLabel,
                    verified: resolved.verified || false,
                    headers: resolved.headers || HEADERS
                };
            } catch (e) {
                console.warn(`[AnimeAV1] Error resolving ${embed.server}: ${e.message}`);
                return null;
            }
        });
        
        var results = await Promise.all(promises);
        streams = results.filter(r => r !== null);
        
        console.warn(`[AnimeAV1] Total streams: ${streams.length}`);
        return streams;
    } catch (err) {
        console.warn(`[AnimeAV1] Error: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
