function getStreams(tmdbId, type, title, year, season, episode) {
    console.log('[Cinecalidad] Buscando:', title);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://cinecalidad.fun/',
    };

    // Cinecalidad solo funciona bien con películas
    if (type !== 'movie') {
        console.log('[Cinecalidad] No soporta series.');
        return Promise.resolve([]);
    }

    const searchUrl = `https://cinecalidad.fun/?s=${encodeURIComponent(title)}`;

    return fetch(searchUrl, { headers })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/<a\s+href="(\/pelicula\/[^"]+)"/);
            if (!match) return [];
            const movieUrl = match[1];

            return fetch(`https://cinecalidad.fun${movieUrl}`, { headers })
                .then(res => res.text())
                .then(movieHtml => {
                    const iframeMatch = movieHtml.match(/<iframe[^>]*src="([^"]*player[^"]*)"[^>]*>/);
                    if (iframeMatch) {
                        return [{
                            name: 'Cinecalidad - Película',
                            url: iframeMatch[1],
                            quality: 'HD'
                        }];
                    }
                    return [];
                });
        })
        .catch(error => {
            console.error('[Cinecalidad] Error:', error.message);
            return [];
        });
}

module.exports = { getStreams };