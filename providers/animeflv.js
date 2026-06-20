function getStreams(tmdbId, type, title, year, season, episode) {
    console.log('[AnimeFLV] Buscando:', title);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.animeflv.net/',
    };

    const searchUrl = `https://www.animeflv.net/browse?q=${encodeURIComponent(title)}`;

    return fetch(searchUrl, { headers })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/<a\s+href="(\/anime\/[^"]+)"/);
            if (!match) return [];
            const animeUrl = match[1];
            const animeId = animeUrl.split('/').pop();

            if (type === 'series') {
                const episodeUrl = `https://www.animeflv.net/ver/${animeId}/${episode}`;
                return fetch(episodeUrl, { headers })
                    .then(res => res.text())
                    .then(epHtml => {
                        const iframeMatch = epHtml.match(/<iframe[^>]*id="player"[^>]*src="([^"]+)"/);
                        if (iframeMatch) {
                            return [{
                                name: `AnimeFLV - T${season}E${episode}`,
                                url: iframeMatch[1],
                                quality: 'HD'
                            }];
                        }
                        return [];
                    });
            } else if (type === 'movie') {
                const movieUrl = `https://www.animeflv.net/ver/${animeId}`;
                return fetch(movieUrl, { headers })
                    .then(res => res.text())
                    .then(movieHtml => {
                        const iframeMatch = movieHtml.match(/<iframe[^>]*id="player"[^>]*src="([^"]+)"/);
                        if (iframeMatch) {
                            return [{
                                name: 'AnimeFLV - Película',
                                url: iframeMatch[1],
                                quality: 'HD'
                            }];
                        }
                        return [];
                    });
            }
            return [];
        })
        .catch(error => {
            console.error('[AnimeFLV] Error:', error.message);
            return [];
        });
}

module.exports = { getStreams };