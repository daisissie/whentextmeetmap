// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZGFpc2lzc2llIiwiYSI6ImNtN2Nyb2F3bzB2N3gyam9zenUyamV4eXIifQ.zfJE3IoB71zY8FesqhERag';

// Initialize map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/daisissie/cm9giyxae00em01qpbxgwbngl',
    minZoom: 3,
    maxBounds: [
        [-171, 15],
        [-47, 72]
    ]
});

// Add hillshading configuration
map.on('style.load', () => {
    // Add DEM source for hillshading
    map.addSource('dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1'
    });

    // Add hillshade layer
    map.addLayer({
        id: 'hillshading',
        source: 'dem',
        type: 'hillshade',
        paint: {
            'hillshade-shadow-color': '#000000',
            'hillshade-highlight-color': '#777777',
            'hillshade-accent-color': '#555555',
            'hillshade-exaggeration': 0.5
        }
    }, 'land-structure-polygon'); // Insert hillshading below the land structure layer
});

// Create popup instance
const popup = new mapboxgl.Popup({
    className: 'my-custom-popup',
    closeOnClick: true,
    maxWidth: '400px'
});

// Category icons configuration
const categoryIcons = [
    { name: 'bus', url: 'assets/icon-1-01.png' },
    { name: 'river', url: 'assets/icon-1-02.png' },
    { name: 'mountain', url: 'assets/icon-1-03.png' },
    { name: 'wilderness', url: 'assets/icon-1-04.png' },
    { name: 'trail', url: 'assets/icon-1-05.png' },
    { name: 'lake', url: 'assets/icon-1-06.png' },
    { name: 'forest', url: 'assets/icon-1-07.png' },
    { name: 'desert', url: 'assets/icon-1-08.png' },
    { name: 'road', url: 'assets/icon-1-09.png' },
    { name: 'camp', url: 'assets/icon-1-10.png' },
    { name: 'none', url: 'assets/marker_logo-01.png' }
];

// Categories for filtering
const categories = ['bus', 'river', 'mountain', 'wilderness', 'trail', 'lake', 'forest', 'desert', 'road', 'camp', 'none'];

map.on('load', () => {
    // Add GeoJSON source
    map.addSource('combined', {
        type: 'geojson',
        data: 'geojson_output/output_test.geojson'
    });

    // Load category icons
    categoryIcons.forEach(icon => {
        map.loadImage(icon.url, (error, image) => {
            if (error) throw error;
            map.addImage(`${icon.name}-icon`, image);
        });
    });

    // Add symbol layer for markers
    map.addLayer({
        id: 'combined-layer',
        type: 'symbol',
        source: 'combined',
        layout: {
            'icon-image': [
                'case',
                ['==', ['get', 'bus', ['get', 'topics']], true], 'bus-icon',
                ['==', ['get', 'river', ['get', 'topics']], true], 'river-icon',
                ['==', ['get', 'mountain', ['get', 'topics']], true], 'mountain-icon',
                ['==', ['get', 'wilderness', ['get', 'topics']], true], 'wilderness-icon',
                ['==', ['get', 'trail', ['get', 'topics']], true], 'trail-icon',
                ['==', ['get', 'lake', ['get', 'topics']], true], 'lake-icon',
                ['==', ['get', 'forest', ['get', 'topics']], true], 'forest-icon',
                ['==', ['get', 'desert', ['get', 'topics']], true], 'desert-icon',
                ['==', ['get', 'road', ['get', 'topics']], true], 'road-icon',
                ['==', ['get', 'camp', ['get', 'topics']], true], 'camp-icon',
                ['==', ['get', 'none', ['get', 'topics']], true], 'none-icon',
                'none-icon' // fallback icon
            ],
            'icon-size': 0.4,
            'icon-allow-overlap': true
        }
    });

    // Add click event for popups
    map.on('click', 'combined-layer', (e) => {
        const clickedLocation = e.features[0].properties.LocationName || "Unknown Location";
        const featuresAtLocation = map.querySourceFeatures('combined', {
            filter: ['==', ['get', 'LocationName'], clickedLocation]
        });

        // Build popup content
        let entriesHTML = featuresAtLocation.map(f => {
            const ctx = f.properties.context || "No context provided.";
            const highlightedCtx = ctx.replace(new RegExp(clickedLocation, 'g'), `<mark>${clickedLocation}</mark>`);
            const lit = f.properties.Literature || "No literature info.";
            const topics = JSON.parse(f.properties.topics || "{}");
            const firstTopic = Object.keys(topics).find(key => topics[key] === true) || 'None';
            
            return `
                <div class="entry" style="margin-bottom:10px;">
                    <hr style="border: 0; height: 1px; background: #ccc; margin: 10px 0;">
                    <p><strong>Context:</strong> ${highlightedCtx}</p>
                    <p><strong>Literature:</strong> ${lit}</p>
                    <p><strong>Object:</strong> ${firstTopic}</p>
                    <p><strong>Theme:</strong> ${firstTopic}</p>
                </div>`;
        }).join('');

        const popupHTML = `
            <div class="popup-content">
                <h2 style="margin: 0 0 8px 0;">${clickedLocation}</h2>
                ${entriesHTML}
            </div>`;

        popup
            .setLngLat(e.lngLat)
            .setHTML(popupHTML)
            .addTo(map);
    });

    // Cursor styling
    map.on('mouseenter', 'combined-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'combined-layer', () => {
        map.getCanvas().style.cursor = '';
    });

    // Set up category filters
    categories.forEach(cat => {
        const checkbox = document.getElementById(`filter-${cat}`);
        if (checkbox) {
            checkbox.addEventListener('change', updateFilters);
        }
    });
});

// Filter update function
function updateFilters() {
    const activeCats = categories.filter(cat => 
        document.getElementById(`filter-${cat}`)?.checked
    );

    if (activeCats.length === 0) {
        map.setFilter('combined-layer', ['in', 'id', '']);
    } else {
        const filterExpr = ['any'];
        activeCats.forEach(cat => {
            if (cat === 'none') {
                filterExpr.push(['!', ['any',
                    ...categories
                        .filter(c => c !== 'none')
                        .map(c => ['==', ['get', c, ['get', 'topics']], true])
                ]]);
            } else {
                filterExpr.push(['==', ['get', cat, ['get', 'topics']], true]);
            }
        });
        map.setFilter('combined-layer', filterExpr);
    }
} 