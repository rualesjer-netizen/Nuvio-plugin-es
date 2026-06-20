function getStreams(tmdbId, type, title, year, season, episode) {
    console.log('[SeriesMetro] Buscando:', title);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://seriesmetro.net/',
    };

    const searchUrl = `https://seriesmetro.net/search/${encodeURIComponent(title)}`;

    return fetch(searchUrl, { headers })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/<a\s+href="(\/ver\/[^"]+)"/);
            if (!match) return [];
            const href = match[1];
            const contentIdMatch = href.match(/\/ver\/(\d+)/);
            if (!contentIdMatch) return [];
            const contentId = contentIdMatch[1];

            if (type === 'series') {
                const episodeUrl = `https://seriesmetro.net/ver/${contentId}-${title.replace(/ /g, '-')}?temporada=${season}&capitulo=${episode}`;
                return fetch(episodeUrl, { headers })
                    .then(res => res.text())
                    .then(epHtml => {
                        const srcMatch = epHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                        if (srcMatch) {
                            return [{
                                name: `SeriesMetro - T${season}E${episode}`,
                                url: srcMatch[1],
                                quality: 'HD'
                            }];
                        }
                        return [];
                    });
            } else if (type === 'movie') {
                const movieUrl = `https://seriesmetro.net/ver/${contentId}`;
                return fetch(movieUrl, { headers })
                    .then(res => res.text())
                    .then(movieHtml => {
                        const srcMatch = movieHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                        if (srcMatch) {
                            return [{
                                name: 'SeriesMetro - Película',
                                url: srcMatch[1],
                                quality: 'HD'
                            }];
                        }
                        return [];
                    });
            }
            return [];
        })
        .catch(error => {
            console.error('[SeriesMetro] Error:', error.message);
            return [];
        });
}

module.exports = { getStreams };