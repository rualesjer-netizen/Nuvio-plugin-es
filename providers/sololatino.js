function getStreams(tmdbId, type, title, year, season, episode) {
    console.log('[SoloLatino] Buscando:', title);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sololatino.net/',
    };

    const searchUrl = `https://sololatino.net/buscar?q=${encodeURIComponent(title)}`;

    return fetch(searchUrl, { headers })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/<a\s+href="(\/ver\/[^"]+)"/);
            if (!match) return [];
            const href = match[1];
            const contentIdMatch = href.match(/\/(\d+)-/);
            if (!contentIdMatch) return [];
            const contentId = contentIdMatch[1];

            if (type === 'series') {
                const episodeUrl = `https://sololatino.net/ver/serie/${contentId}-${title.replace(/ /g, '-')}?temporada=${season}&capitulo=${episode}`;
                return fetch(episodeUrl, { headers })
                    .then(res => res.text())
                    .then(epHtml => {
                        const iframeMatch = epHtml.match(/<iframe[^>]*allowfullscreen[^>]*src="([^"]+)"/);
                        if (iframeMatch) {
                            return [{
                                name: `SoloLatino - T${season}E${episode}`,
                                url: iframeMatch[1],
                                quality: 'HD'
                            }];
                        }
                        return [];
                    });
            } else if (type === 'movie') {
                const movieUrl = `https://sololatino.net/ver/pelicula/${contentId}-${title.replace(/ /g, '-')}`;
                return fetch(movieUrl, { headers })
                    .then(res => res.text())
                    .then(movieHtml => {
                        const iframeMatch = movieHtml.match(/<iframe[^>]*allowfullscreen[^>]*src="([^"]+)"/);
                        if (iframeMatch) {
                            return [{
                                name: 'SoloLatino - Película',
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
            console.error('[SoloLatino] Error:', error.message);
            return [];
        });
}

module.exports = { getStreams };