function getStreams(tmdbId, type, title, year, season, episode) {
    console.log('[LatAnime] Buscando:', title);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://latanime.org/',
    };

    const searchUrl = `https://latanime.org/buscar?q=${encodeURIComponent(title)}`;

    return fetch(searchUrl, { headers })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/<a\s+href="(\/anime\/[^"]+)"/);
            if (!match) return [];
            const animeUrl = match[1];
            const animeSlug = animeUrl.split('/').pop();

            if (type === 'series') {
                const episodeUrl = `https://latanime.org/ver/${animeSlug}/capitulo-${episode}`;
                return fetch(episodeUrl, { headers })
                    .then(res => res.text())
                    .then(epHtml => {
                        const srcMatch = epHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                        if (srcMatch) {
                            return [{
                                name: `LatAnime - T${season}E${episode}`,
                                url: srcMatch[1],
                                quality: 'HD'
                            }];
                        }
                        return [];
                    });
            } else if (type === 'movie') {
                const movieUrl = `https://latanime.org/ver/${animeSlug}`;
                return fetch(movieUrl, { headers })
                    .then(res => res.text())
                    .then(movieHtml => {
                        const srcMatch = movieHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                        if (srcMatch) {
                            return [{
                                name: 'LatAnime - Película',
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
            console.error('[LatAnime] Error:', error.message);
            return [];
        });
}

module.exports = { getStreams };