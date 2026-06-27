const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://latanime.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": UA,
    "Referer": BASE_URL + "/"
};

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

function cleanPlayerUrl(url) {
    return url
        .replace("https://monoschinos2.com/reproductor?url=", "")
        .replace("https://mojon.latanime.org/aqua/fn?url=", "")
        .replace("https://hglink.to", "https://streamwish.to")
        .replace("https://swdyu.com", "https://streamwish.to")
        .replace("https://mivalyo.com", "https://vidhidepro.com")
        .replace("https://filemoon.link", "https://filemoon.sx")
        .replace("https://sblona.com", "https://watchsb.com");
}

async function fetchText(url, headers) {
    try {
        var resp = await fetch(url, { headers: headers || HEADERS });
        if (!resp.ok) return null;
        return await resp.text();
    } catch (e) { return null; }
}

async function getTmdbTitles(tmdbId, type, season) {
    var titles = [];
    try {
        var r = await fetch("https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=es-MX", { headers: { "User-Agent": UA } }).then(r => r.json());
        if (type === "movie") { titles.push(r.title); titles.push(r.original_title); }
        else { titles.push(r.name); titles.push(r.original_name); }
    } catch (e) {}
    try {
        var r2 = await fetch("https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en-US", { headers: { "User-Agent": UA } }).then(r => r.json());
        if (type === "movie") titles.push(r2.title);
        else titles.push(r2.name);
    } catch (e) {}
    if (type === "tv" && season > 1) {
        try {
            var r3 = await fetch("https://api.themoviedb.org/3/tv/" + tmdbId + "/season/" + season + "?api_key=" + TMDB_KEY + "&language=es-MX", { headers: { "User-Agent": UA } }).then(r => r.json());
            if (r3.name && r3.name !== "Temporada " + season && r3.name !== "Season " + season) {
                titles.unshift(r3.name);
            }
        } catch (e) {}
    }
    return [...new Set(titles.filter(Boolean))];
}

async function searchOnSite(query) {
    try {
        var html = await fetchText(BASE_URL + "/buscar?q=" + encodeURIComponent(query));
        if (!html) return [];
        var results = [];
        var re = /<div[^>]*class="[^"]*col-6[^"]*my-3[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*my-1[^"]*"[^>]*>([^<]+)<\/h3>/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            results.push({ href: m[1].trim(), title: m[2].trim() });
        }
        if (!results.length) {
            var re2 = /<a[^>]*href="(\/anime\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
            while ((m = re2.exec(html)) !== null) {
                results.push({ href: m[1].trim(), title: m[2].trim() });
            }
        }
        return results;
    } catch (e) { return []; }
}

async function findAnime(tmdbId, mediaType, season) {
    var titles = await getTmdbTitles(tmdbId, mediaType, season);
    if (!titles.length) return null;

    for (var i = 0; i < titles.length; i++) {
        var query = titles[i];
        console.warn("[LatAnime] Buscando: " + query);
        var results = await searchOnSite(query);
        if (!results.length) continue;

        var cleanQuery = cleanTitle(query);
        var exact = results.find(r => cleanTitle(r.title) === cleanQuery);
        if (exact) { console.warn("[LatAnime] Exacto: " + exact.title); return exact; }

        var partial = results.find(r => {
            var ct = cleanTitle(r.title);
            return ct.includes(cleanQuery) || cleanQuery.includes(ct);
        });
        if (partial) { console.warn("[LatAnime] Parcial: " + partial.title); return partial; }

        if (i === titles.length - 1) {
            console.warn("[LatAnime] Primer resultado: " + results[0].title);
            return results[0];
        }
    }
    return null;
}

async function getEpisodeUrl(animeHref, epNumber) {
    try {
        var html = await fetchText(BASE_URL + animeHref);
        if (!html) return null;

        var epLinks = [];
        var re = /href="(\/ver\/[^"]+)"/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            epLinks.push(m[1]);
        }
        if (!epLinks.length) return null;

        var target = epLinks.find(link => {
            var cap = link.match(/capitulo-(\d+)/i);
            return cap && parseInt(cap[1]) === epNumber;
        });
        if (target) return target;

        var slugMatch = animeHref.match(/\/anime\/(.+)/);
        if (slugMatch) return "/ver/" + slugMatch[1] + "-capitulo-" + epNumber;
        return null;
    } catch (e) { return null; }
}

async function getPlayers(episodePath) {
    try {
        var url = BASE_URL + episodePath;
        console.warn("[LatAnime] Episodio: " + url);
        var html = await fetchText(url);
        if (!html) return [];

        var players = [];
        var re = /<li[^>]*id="play-video"[^>]*>[\s\S]*?<a[^>]*data-player="([^"]+)"[^>]*>([^<]*)<\/a>/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            var encoded = m[1].trim();
            var serverTitle = m[2].trim();
            try {
                var decoded = b64decode(encoded);
                var cleanUrl = cleanPlayerUrl(decoded);
                if (cleanUrl && cleanUrl.startsWith("http")) {
                    players.push({ serverTitle: serverTitle, url: cleanUrl });
                }
            } catch (e) {}
        }

        if (!players.length) {
            var re2 = /data-player="([^"]+)"/g;
            while ((m = re2.exec(html)) !== null) {
                try {
                    var decoded2 = b64decode(m[1].trim());
                    var cleanUrl2 = cleanPlayerUrl(decoded2);
                    if (cleanUrl2 && cleanUrl2.startsWith("http")) {
                        players.push({ serverTitle: "Server", url: cleanUrl2 });
                    }
                } catch (e) {}
            }
        }

        console.warn("[LatAnime] Players encontrados: " + players.length);
        return players;
    } catch (e) { return []; }
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

async function resolveMp4Upload(url) {
    try {
        var idMatch = url.match(/mp4upload\.com\/(embed-|)([A-Za-z0-9]*)/);
        var realUrl = idMatch ? "https://www.mp4upload.com/embed-" + idMatch[2] + ".html" : url;
        var html = await fetchText(realUrl, { "Referer": url, "User-Agent": UA });
        if (!html) return null;
        var unpacked = unpackPacker(html);
        var srcMatch = unpacked.match(/player\.src\("([^"]+)"/) || unpacked.match(/player\.src\W*src:\s*"([^"]+)"/);
        if (!srcMatch) return null;
        var qMatch = unpacked.toLowerCase().match(/height=(\d+)/);
        return { url: srcMatch[1], quality: qMatch ? qMatch[1] + "p" : "1080p", headers: { "Referer": realUrl, "User-Agent": UA } };
    } catch (e) { return null; }
}

async function resolveVoe(url) {
    try {
        var html = await fetchText(url);
        if (!html) return null;
        var m = html.match(/"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i) || html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m) return { url: m[1], quality: "1080p", headers: { "Referer": url, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveOkRu(url) {
    try {
        var html = await fetchText(url);
        if (!html) return null;
        var m = html.match(/videoUrl\s*=\s*"([^"]+)"/i) || html.match(/"url"\s*:\s*"([^"]+\.mp4[^"]*)"/i);
        if (m) return { url: m[1].replace(/\\/g, ""), quality: "720p", headers: { "Referer": url, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveYourUpload(url) {
    try {
        var html = await fetchText(url);
        if (!html) return null;
        var m = html.match(/property\s*=\s*"og:video"[\s\S]*?content\s*=\s*"([^"]+)"/i);
        if (m) return { url: m[1], quality: "720p", headers: { "Referer": url, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveDood(url) {
    try {
        var embedUrl = url.includes("/e/") ? url : url.replace(/\/(d|f)\//, "/e/");
        var html = await fetchText(embedUrl, { "User-Agent": UA, "Referer": url });
        if (!html) return null;
        var m = html.match(/\$\.get\(['"](\/pass_md5\/[\w-]+)\/([\w-]+)['"]/i);
        if (!m) return null;
        var domain = new URL(embedUrl).origin;
        var base = await fetchText(domain + m[1], { "User-Agent": UA, "Referer": embedUrl });
        if (!base) return null;
        var chars2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var rand = "";
        for (var i = 0; i < 10; i++) rand += chars2[Math.floor(Math.random() * chars2.length)];
        return { url: base + rand + "?token=" + m[2] + "&expiry=" + Date.now(), quality: "720p", headers: { "User-Agent": UA, "Referer": domain + "/" } };
    } catch (e) { return null; }
}

async function resolveStreamWish(url) {
    try {
        var rawId = url.split("/").pop().replace(/\.html$/, "");
        var mirrors = [
            "https://hanerix.com/e/" + rawId,
            "https://embedwish.com/e/" + rawId,
            "https://streamwish.to/e/" + rawId,
            url
        ];
        var result = await new Promise(function(res) {
            var done = false, pending = mirrors.length;
            mirrors.forEach(async function(mirror) {
                try {
                    var r = await fetch(mirror, { headers: { "Referer": mirror, "User-Agent": UA } });
                    if (!r.ok) throw "";
                    var html = await r.text();
                    var m3u8 = null;
                    var hm = html.match(/[0-9a-f]{32}/i);
                    if (hm) {
                        var dl = await fetch(new URL(mirror).origin + "/dl?op=view&file_code=" + rawId + "&hash=" + hm[0] + "&embed=1&adb=1&hls4=1", { headers: { "User-Agent": UA, "Referer": mirror, "X-Requested-With": "XMLHttpRequest" } });
                        if (dl.ok) { var t = await dl.text(); var mm = t.match(/https?:\/\/[^"']+\.m3u8[^"']*/); if (mm) m3u8 = mm[0]; }
                    }
                    if (!m3u8) { var f = html.match(/file\s*:\s*["']([^"']+)["']/i); if (f) m3u8 = f[1]; }
                    if (m3u8 && !done) { done = true; res({ url: m3u8.replace(/\\/g, ""), mirror: mirror }); }
                } catch (_) {} finally { pending--; if (pending === 0 && !done) res(null); }
            });
            setTimeout(function() { if (!done) { done = true; res(null); } }, 4000);
        });
        if (!result) return null;
        return { url: result.url, quality: "1080p", headers: { "Referer": result.mirror, "Origin": new URL(result.mirror).origin, "User-Agent": UA } };
    } catch (e) { return null; }
}

async function resolveFilemoon(url) {
    try {
        var urlObj = new URL(url);
        var videoId = urlObj.pathname.split("/").filter(Boolean).pop();
        if (!videoId) return null;
        var details = await fetch("https://" + urlObj.hostname + "/api/videos/" + videoId + "/embed/details", { headers: { "X-Requested-With": "XMLHttpRequest", "Referer": url, "User-Agent": UA } }).then(r => r.json());
        if (!details.embed_frame_url) return null;
        var pd = new URL(details.embed_frame_url).origin;
        var ch = await fetch(pd + "/api/videos/access/challenge", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA } }).then(r => r.json());
        if (!ch.challenge_id) return null;
        var vid = Math.random().toString(36).substring(2, 15);
        var did = Math.random().toString(36).substring(2, 15);
        var att = await fetch(pd + "/api/videos/access/attest", { method: "POST", body: JSON.stringify({ viewer_id: vid, device_id: did, challenge_id: ch.challenge_id, nonce: ch.nonce, signature: "MEUCIQDYi5fX9gG8_5t_4v8p_Q8o8l5v8v8v8v8v8v8v8v8v", public_key: { kty: "EC", crv: "P-256", x: "thRcTF9d89tZ704lTYciJq48dtIaoqf9L0Is1gK29II", y: "v8Oo5z9N9406uE4RnU3dlmpbAaMQtt61uynn6kgz4_Q" }, client: { user_agent: UA, platform: "Windows", languages: ["es-ES"] }, storage: { cookie: vid, local_storage: vid }, attributes: { entropy: "high" } }), headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA } }).then(r => r.json());
        if (!att.token) return null;
        var play = await fetch(pd + "/api/videos/" + videoId + "/embed/playback", { method: "POST", body: JSON.stringify({ fingerprint: { token: att.token, viewer_id: att.viewer_id || vid, device_id: att.device_id || did, confidence: att.confidence } }), headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": details.embed_frame_url, "Origin": pd, "User-Agent": UA } }).then(r => r.json());
        var src = play && play.playback && play.playback.sources && play.playback.sources[0] && play.playback.sources[0].url;
        if (!src) return null;
        return { url: src, quality: "1080p", headers: { "User-Agent": UA, "Referer": pd, "Origin": pd } };
    } catch (e) { return null; }
}

async function resolveUqload(url) {
    try {
        var html = await fetchText(url);
        if (!html) return null;
        var m = html.match(/sources\s*:\s*\[\s*["']([^"']+)["']\s*\]/i) || html.match(/"file"\s*:\s*"([^"]+\.mp4[^"]*)"/i);
        if (m) return { url: m[1], quality: "720p", headers: { "Referer": url, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveVidGuard(url) {
    try {
        var html = await fetchText(url);
        if (!html) return null;
        var m = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m) return { url: m[1], quality: "1080p", headers: { "Referer": url, "User-Agent": UA } };
        return null;
    } catch (e) { return null; }
}

async function resolveMixDrop(url) {
    try {
        var html = await fetchText(url);
        if (!html) return null;
        var m = html.match(/(?:wurl|MDCore\.wurl)\s*=\s*"([^"]+)"/i);
        if (m) {
            var finalUrl = m[1].startsWith("//") ? "https:" + m[1] : m[1];
            return { url: finalUrl, quality: "720p", headers: { "Referer": url, "User-Agent": UA } };
        }
        return null;
    } catch (e) { return null; }
}

async function resolveEmbed(serverTitle, embedUrl) {
    if (!embedUrl || !embedUrl.startsWith("http")) return null;
    var s = embedUrl.toLowerCase();
    var t = (serverTitle || "").toLowerCase();

    if (s.includes("mp4upload") || t.includes("mp4")) return await resolveMp4Upload(embedUrl);
    if (s.includes("voe") || t.includes("voe")) return await resolveVoe(embedUrl);
    if (s.includes("ok.ru") || s.includes("okru") || t.includes("okru")) return await resolveOkRu(embedUrl);
    if (s.includes("yourupload") || t.includes("upload")) return await resolveYourUpload(embedUrl);
    if (s.includes("dood") || s.includes("ds2play") || t.includes("dood")) return await resolveDood(embedUrl);
    if (s.includes("streamwish") || s.includes("wishembed") || s.includes("strwish") || t.includes("wish")) return await resolveStreamWish(embedUrl);
    if (s.includes("filemoon") || s.includes("files.im") || t.includes("filemoon")) return await resolveFilemoon(embedUrl);
    if (s.includes("uqload") || t.includes("uqload")) return await resolveUqload(embedUrl);
    if (s.includes("vembed") || s.includes("guard") || s.includes("bembed") || t.includes("guard")) return await resolveVidGuard(embedUrl);
    if (s.includes("mixdrop") || t.includes("mixdrop")) return await resolveMixDrop(embedUrl);

    try {
        var html = await fetchText(embedUrl);
        if (!html) return null;
        var m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        if (m3u8) return { url: m3u8[1], quality: "HD", headers: { "Referer": embedUrl, "User-Agent": UA } };
        var mp4 = html.match(/(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i);
        if (mp4) return { url: mp4[1], quality: "HD", headers: { "Referer": embedUrl, "User-Agent": UA } };
    } catch (e) {}
    return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    var seasonNum = parseInt(season) || 1;
    var epNum = parseInt(episode) || 1;

    console.warn("[LatAnime] TMDB: " + tmdbId + " T" + seasonNum + "E" + epNum);

    var matched = await findAnime(tmdbId, mediaType, seasonNum);
    if (!matched) { console.warn("[LatAnime] No encontrado"); return []; }
    console.warn("[LatAnime] Match: " + matched.title + " → " + matched.href);

    var episodePath = null;
    if (mediaType === "tv") {
        episodePath = await getEpisodeUrl(matched.href, epNum);
        if (!episodePath) {
            var slugMatch = matched.href.match(/\/anime\/(.+)/);
            if (slugMatch) episodePath = "/ver/" + slugMatch[1] + "-capitulo-" + epNum;
        }
    } else {
        episodePath = await getEpisodeUrl(matched.href, 1);
        if (!episodePath) {
            var slugMatch2 = matched.href.match(/\/anime\/(.+)/);
            if (slugMatch2) episodePath = "/ver/" + slugMatch2[1] + "-capitulo-1";
        }
    }

    if (!episodePath) { console.warn("[LatAnime] Sin URL de episodio"); return []; }

    var players = await getPlayers(episodePath);
    if (!players.length) { console.warn("[LatAnime] Sin players"); return []; }

    var streams = [];
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var resolved = await resolveEmbed(player.serverTitle, player.url);
        if (resolved && resolved.url) {
            streams.push({
                name: "LatAnime",
                title: player.serverTitle || "Server",
                url: resolved.url,
                quality: resolved.quality || "HD",
                headers: resolved.headers || HEADERS
            });
        }
    }

    console.warn("[LatAnime] Streams: " + streams.length);
    return streams;
}

module.exports = { getStreams };
