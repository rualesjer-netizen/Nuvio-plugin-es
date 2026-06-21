function getStreams(tmdbId, mediaType, season, episode, meta) {
    var title = meta && meta.title ? meta.title : "";
    var BASE = 'https://sololatino.net';
    var headers = { 'User-Agent': 'Mozilla/5.0' };

    // Búsqueda directa y exclusiva de SoloLatino
    return fetch(BASE + '/buscar?q=' + encodeURIComponent(title), { headers: headers })
        .then(function(res) { return res.text(); })
        .then(function(html) {
            // Buscamos el link que coincida con el contenido
            var hrefMatch = html.match(/<a\s+href="(\/ver\/[^"]+)"/);
            if (!hrefMatch) return [];

            var targetUrl = BASE + hrefMatch[1];
            
            // Si es serie, ajustamos el URL con los parámetros de temporada/episodio
            if (mediaType === 'tv') {
                targetUrl += '?temporada=' + season + '&capitulo=' + episode;
            }

            return fetch(targetUrl, { headers: headers })
                .then(function(r) { return r.text(); })
                .then(function(pageHtml) {
                    // Extraer el stream (m3u8, mp4 o iframe)
                    var match = pageHtml.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)/) 
                             || pageHtml.match(/src=["']([^"']+\.mp4[^"']*)["']/)
                             || pageHtml.match(/<iframe[^>]+src=["']([^"']+)["']/);
                             
                    if (!match) return [];
                    
                    return [{ 
                        name: 'SoloLatino · ' + (mediaType === 'tv' ? 'T' + season + 'E' + episode : 'Película'), 
                        url: match[1], 
                        quality: 'HD' 
                    }];
                });
        })
        .catch(function() { return []; });
}

global.getStreams = getStreams;
