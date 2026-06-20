function getStreams(tmdbId, type, title, year, season, episode) {
    console.log('[AnimeJL] Buscando:', title);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://animejl.net/',
    };

    const searchUrl = `https://animejl.net/buscar?q=${encodeURIComponent(title)}`;

    return fetch(searchUrl, { headers })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/<a\s+href="(\/anime\/[^"]+)"/);
            if (!match) return [];
            const animeUrl = match[1];
            const animeSlug = animeUrl.split('/').pop();

            if (type === 'series') {
                const episodeUrl = `https://animejl.net/ver/${animeSlug}/${episode}`;
                return fetch(episodeUrl, { headers })
                    .then(res => res.text())
                    .then(epHtml => {
                        const srcMatch = epHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                        if (srcMatch) {
                            return [{
                                name: `AnimeJL - T${season}E${episode}`,
                                url: srcMatch[1],
                                quality: 'HD'
                            }];
                        }
                        return [];
                    });
            } else if (type === 'movie') {
                const movieUrl = `https://animejl.net/ver/${animeSlug}`;
                return fetch(movieUrl, { headers })
                    .then(res => res.text())
                    .then(movieHtml => {
                        const srcMatch = movieHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                        if (srcMatch) {
                            return [{
                                name: 'AnimeJL - Película',
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
            console.error('[AnimeJL] Error:', error.message);
            return [];
        });
}

module.exports = { getStreams };