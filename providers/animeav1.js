function getStreams(tmdbId, mediaType, season, episode, meta) {
    var title = meta && meta.title ? meta.title : "";
    var BASE = 'https://animeav1.com';
    var headers = { 'User-Agent': 'Mozilla/5.0' };

    return fetch(BASE + '/catalogo?search=' + encodeURIComponent(title), { headers: headers })
        .then(function(res) { return res.text(); })
        .then(function(html) {
            var match = html.match(/href="(\/media\/[^"/]+)"/);
            if (!match) return [];
            
            var episodeUrl = BASE + match[1] + (mediaType === 'tv' ? '/' + episode : '');
            return fetch(episodeUrl, { headers: headers })
                .then(function(r) { return r.text(); })
                .then(function(h) {
                    var playerMatch = h.match(/https:\/\/player\.zilla-networks\.com\/play\/[a-f0-9]+/);
                    if (!playerMatch) return [];
                    
                    return fetch(playerMatch[0], { headers: headers })
                        .then(function(resp) { return resp.text(); })
                        .then(function(v) {
                            var m3u8 = v.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
                            if (!m3u8) return [];
                            return [{ name: 'AnimeAV1 - HD', url: m3u8[0], quality: 'HD' }];
                        });
                });
        })
        .catch(function() { return []; });
}

global.getStreams = getStreams;
