function getStreams(tmdbId, type, title, year, season, episode) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://animeav1.com/',
    };

    const searchUrl = `https://animeav1.com/catalogo?search=${encodeURIComponent(title)}`;

    return fetch(searchUrl, { headers })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/<article[^>]*>.*?<a\s+href="([^"]+)"/s);
            if (!match) return [];
            const animeUrl = match[1];

            return fetch(`https://animeav1.com${animeUrl}`, { headers })
                .then(res => res.text())
                .then(animeHtml => {
                    const slugMatch = animeHtml.match(/slug:"([^"]+)"/);
                    const episodesMatch = animeHtml.match(/episodesCount:(\d+)/);
                    if (!slugMatch || !episodesMatch) return [];
                    const slug = slugMatch[1];
                    const totalEpisodes = parseInt(episodesMatch[1]);

                    if (type === 'series') {
                        if (episode > totalEpisodes) return [];
                        const episodeUrl = `https://animeav1.com/media/${slug}/${episode}`;
                        return fetch(episodeUrl, { headers })
                            .then(res => res.text())
                            .then(epHtml => {
                                let videoSrc = null;
                                const srcMatch = epHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                                if (srcMatch) {
                                    videoSrc = srcMatch[1];
                                } else {
                                    const fileMatch = epHtml.match(/file:"([^"]+\.m3u8)"/);
                                    if (fileMatch) videoSrc = fileMatch[1];
                                }
                                if (videoSrc) {
                                    return [{
                                        name: `AnimeAV1 - T${season}E${episode}`,
                                        url: videoSrc,
                                        quality: 'HD'
                                    }];
                                }
                                return [];
                            });
                    } else if (type === 'movie') {
                        const movieUrl = `https://animeav1.com/media/${slug}`;
                        return fetch(movieUrl, { headers })
                            .then(res => res.text())
                            .then(movieHtml => {
                                const srcMatch = movieHtml.match(/<video[^>]*>.*?<source\s+src="([^"]+)"/s);
                                if (srcMatch) {
                                    return [{
                                        name: 'AnimeAV1 - Película',
                                        url: srcMatch[1],
                                        quality: 'HD'
                                    }];
                                }
                                return [];
                            });
                    }
                    return [];
                });
        })
        .catch(error => {
            console.error('[AnimeAV1] Error:', error.message);
            return [];
        });
}

module.exports = { getStreams };
