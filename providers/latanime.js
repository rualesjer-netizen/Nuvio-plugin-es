const BASE_URL = "https://latanime.org";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": UA,
    "Referer": BASE_URL + "/"
};

async function fetchText(url, headers = HEADERS) {
    try {
        const resp = await fetch(url, { headers });
        return resp.ok ? await resp.text() : null;
    } catch (e) { return null; }
}

// ── BÚSQUEDA EN LATANIME ──────────────────────────────────────

async function searchOnSite(query) {
    const html = await fetchText(`${BASE_URL}/buscar?q=${encodeURIComponent(query)}`);
    if (!html) return [];

    // Selector basado en la estructura de Latanime[span_3](start_span)[span_3](end_span)
    const results = [];
    const doc = new DOMParser().parseFromString(html, "text/html");
    const elements = doc.querySelectorAll(".col-6.my-3");
    
    elements.forEach(el => {
        const a = el.querySelector("a");
        const title = el.querySelector("h3.my-1")?.textContent;
        if (a && title) {
            results.push({
                slug: a.getAttribute("href").split("/").pop(),
                title: title.trim(),
                url: BASE_URL + a.getAttribute("href")
            });
        }
    });
    return results;
}

// ── OBTENER SERVIDORES Y RESOLVER ──────────────────────────

async function getEpisodeServers(episodeUrl) {
    const html = await fetchText(episodeUrl);
    if (!html) return [];

    // Latanime usa Base64 para ocultar los enlaces de los reproductores[span_4](start_span)[span_4](end_span)[span_5](start_span)[span_5](end_span)
    const doc = new DOMParser().parseFromString(html, "text/html");
    const servers = [];
    doc.querySelectorAll("li#play-video").forEach(el => {
        const encoded = el.querySelector("a")?.getAttribute("data-player");
        if (encoded) {
            const decoded = atob(encoded)
                .replace("https://monoschinos2.com/reproductor?url=", "")
                .replace("https://mojon.latanime.org/aqua/fn?url=", "");
            
            servers.push({
                title: el.textContent.trim(),
                url: decoded
            });
        }
    });
    return servers;
}

// ── getStreams PRINCIPAL ───────────────────────────────────────

async function getStreams(query, epNumber) {
    // 1. Buscar anime
    const searchResults = await searchOnSite(query);
    if (searchResults.length === 0) return [];

    // 2. Obtener página del episodio (ajustar lógica según slug/número)
    const anime = searchResults[0];
    const epUrl = `${BASE_URL}/ver/${anime.slug}-${epNumber}`;
    
    // 3. Obtener servidores
    const servers = await getEpisodeServers(epUrl);
    
    const streams = [];
    for (const server of servers) {
        // Aquí se integraría la lógica de los extractores como en el código fuente[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span)
        streams.push({
            name: "Latanime",
            title: server.title,
            url: server.url,
            quality: "HD"
        });
    }
    return streams;
}

module.exports = { getStreams };
