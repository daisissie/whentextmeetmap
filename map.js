// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZGFpc2lzc2llIiwiYSI6ImNtN2Nyb2F3bzB2N3gyam9zenUyamV4eXIifQ.zfJE3IoB71zY8FesqhERag';

// Initialize map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/daisissie/cm9giyxae00em01qpbxgwbngl',
    minZoom: 0,
    maxZoom: 12,
    zoom: 2.5, // Initial zoom level to show both Alaska and continental US
    center: [-140, 45], // Centered between Alaska and continental US
    maxBounds: [
        [-180, 20], // Southwest coordinates [lng, lat] - includes Alaska
        [-65, 72]  // Northeast coordinates [lng, lat] - covers northern Alaska
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

// Add themes for filtering
const themes = [
    'freedom_and_escape',
    'road_trips_and_physical_journeys',
    'nature_as_solace',
    'against_materialism',
    'search_for_meaning',
    'identity',
    'loneliness_and_isolation',
    'counterculture',
    'time_and_presence',
    'risk',
    'family'
];

map.on('load', () => {
    // Add GeoJSON source
    map.addSource('combined', {
        type: 'geojson',
        data: 'output_final.geojson'
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
            const themes = JSON.parse(f.properties.themes || "{}");
            
            // Get all true topics
            const activeTopics = Object.entries(topics)
                .filter(([_, value]) => value === true)
                .map(([key]) => key.replace(/_/g, ' '))
                .join(', ') || 'None';

            // Get all true themes
            const activeThemes = Object.entries(themes)
                .filter(([_, value]) => value === true)
                .map(([key]) => key.replace(/_/g, ' '))
                .join(', ') || 'None';
            
            return `
                <div class="entry" style="margin-bottom:10px;">
                    <hr style="border: 0; height: 1px; background: #ccc; margin: 10px 0;">
                    <p><strong>Context:</strong> ${highlightedCtx}</p>
                    <p><strong>Literature:</strong> ${lit}</p>
                    <p><strong>Objects:</strong> ${activeTopics}</p>
                    <p><strong>Themes:</strong> ${activeThemes}</p>
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

    // Set up theme filters
    themes.forEach(theme => {
        const checkbox = document.getElementById(`filter-${theme}`);
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

    const activeThemes = themes.filter(theme =>
        document.getElementById(`filter-${theme}`)?.checked
    );

    if (activeCats.length === 0 && activeThemes.length === 0) {
        map.setFilter('combined-layer', ['in', 'id', '']);
        return;
    }

    const filterExpr = ['all'];
    
    // Add topic filters if any are selected
    if (activeCats.length > 0) {
        const topicFilter = ['any'];
        activeCats.forEach(cat => {
            if (cat === 'none') {
                topicFilter.push(['!', ['any',
                    ...categories
                        .filter(c => c !== 'none')
                        .map(c => ['==', ['get', c, ['get', 'topics']], true])
                ]]);
            } else {
                topicFilter.push(['==', ['get', cat, ['get', 'topics']], true]);
            }
        });
        filterExpr.push(topicFilter);
    }

    // Add theme filters if any are selected
    if (activeThemes.length > 0) {
        const themeFilter = ['any'];
        activeThemes.forEach(theme => {
            themeFilter.push(['==', ['get', theme, ['get', 'themes']], true]);
        });
        filterExpr.push(themeFilter);
    }

    map.setFilter('combined-layer', filterExpr);
} 