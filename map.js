// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZGFpc2lzc2llIiwiYSI6ImNtN2Nyb2F3bzB2N3gyam9zenUyamV4eXIifQ.zfJE3IoB71zY8FesqhERag';

// Initialize map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/daisissie/cm9giyxae00em01qpbxgwbngl',
    minZoom: 0,
    maxZoom: 7.5,
    zoom: 3.2, // Adjusted zoom level if necessary
    center: [-110, 50], // Adjusted center for continental USA
    maxBounds: [
        [-150, 22], // Southwest coordinates
        [-62, 70]   // Northeast coordinates
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
            'hillshade-exaggeration': 0.8
        }
    }, 'land-structure-polygon'); // Insert hillshading below the land structure layer
});

// Create popup instance
const popup = new mapboxgl.Popup({
    className: 'my-custom-popup',
    closeOnClick: true,
    maxWidth: '350px' // Updated to make the popup box shorter
});

// Category icons configuration
const categoryIcons = [
    { name: 'bus', url: 'assets/icon-01.png' },
    { name: 'river', url: 'assets/icon-02.png' },
    { name: 'mountain', url: 'assets/icon-03.png' },
    { name: 'wilderness', url: 'assets/icon-04.png' },
    { name: 'trail', url: 'assets/icon-05.png' },
    { name: 'lake', url: 'assets/icon-06.png' },
    { name: 'forest', url: 'assets/icon-07.png' },
    { name: 'desert', url: 'assets/icon-08.png' },
    { name: 'road', url: 'assets/icon-09.png' },
    { name: 'camp', url: 'assets/icon-10.png' },
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
    'search_for_meaning',  // This must match exactly with the HTML id (without 'filter-' prefix)
    'identity',
    'loneliness_and_isolation',
    'counterculture',
    'time_and_presence',
    'risk',
    'family'
];

// Add simple hash function before map.on('load')
function getRandomSeed() {
    return Math.floor(Math.random() * 1000000);
}

const randomSeed = getRandomSeed();

function hashString(str) {
    let hash = randomSeed; // Start with random seed
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

map.on('load', async () => {
    // Add GeoJSON source
    map.addSource('combined', {
        type: 'geojson',
        data: 'output_final.geojson'
    });

    // Wait for all icons to load before adding layers
    try {
        await Promise.all(categoryIcons.map(icon => {
            return new Promise((resolve, reject) => {
                map.loadImage(icon.url, (error, image) => {
                    if (error) {
                        console.error(`Error loading ${icon.name}-icon:`, error);
                        reject(error);
                    } else {
                        try {
                            if (!map.hasImage(`${icon.name}-icon`)) {
                                map.addImage(`${icon.name}-icon`, image);
                            }
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    }
                });
            });
        }));

        // Add handler for missing images
        map.on('styleimagemissing', (e) => {
            if (!map.hasImage(e.id)) {
                map.loadImage('assets/marker_logo-01.png', (error, image) => {
                    if (!error && !map.hasImage(e.id)) {
                        map.addImage(e.id, image);
                    }
                });
            }
        });

        // Only add layers after images are loaded
        map.addLayer({
            id: 'circle-background',
            type: 'circle',
            source: 'combined',
            paint: {
                'circle-color': '#ffffff',
                'circle-opacity': 0.4,
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 20,     // At zoom level 0, radius is 4px
                    4, 12,     // At zoom level 4, radius is 6px
                    8, 40,     // At zoom level 8, radius is 8px
                    12, 100    // At zoom level 12, radius is 10px
                ],
                'circle-stroke-width': 0.3,
                'circle-stroke-color': '#ffffff'
            }
        });

        // Create a layer for each category instead of a combined layer
        categories.forEach(cat => {
            map.addLayer({
                id: `${cat}-layer`,
                type: 'symbol',
                source: 'combined',
                layout: {
                    'icon-image': `${cat}-icon`,
                    'icon-size': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 0.4,
                        4, 0.5,
                        8, 1.2,
                        12, 2
                    ],
                    'icon-allow-overlap': true
                },
                filter: cat === 'none' ? 
                    [
                        'all',
                        ['has', 'topics'],
                        [
                            'all',
                            ...categories
                                .filter(c => c !== 'none')
                                .map(c => [
                                    '!=',
                                    ['get', c, ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]],
                                    true
                                ])
                        ]
                    ] : 
                    [
                        'all',
                        ['has', 'topics'],
                        [
                            'to-boolean',
                            ['get', cat, ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]]
                        ]
                    ]
            });

            // Add click event for each layer
            map.on('click', `${cat}-layer`, (e) => {
                const clickedLocation = e.features[0].properties.LocationName || "Unknown Location";
                handlePopup(e, clickedLocation);
            });

            // Add hover effects for each layer
            map.on('mouseenter', `${cat}-layer`, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', `${cat}-layer`, () => {
                map.getCanvas().style.cursor = '';
            });
        });

        // Add this function after layer creation to update visibility
        function updateLayerVisibility() {
            const features = map.querySourceFeatures('combined');
            const locationMap = new Map();
            let noneCount = 0;
            const maxNoneIcons = 20; // Adjust this number to control max "none" icons

            // First pass: assign non-none categories with randomization
            features.forEach(feature => {
                const location = feature.properties.LocationName;
                if (!locationMap.has(location)) {
                    const topics = JSON.parse(feature.properties.topics || "{}");
                    const activeCategories = categories
                        .filter(cat => cat !== 'none' && topics[cat] === true);

                    if (activeCategories.length > 0) {
                        // Use random seed for consistent but random selection within this page load
                        const hash = hashString(location);
                        const selectedCategory = activeCategories[hash % activeCategories.length];
                        locationMap.set(location, selectedCategory);
                    }
                }
            });

            // Second pass: assign 'none' category only if needed and within limit
            features.forEach(feature => {
                const location = feature.properties.LocationName;
                if (!locationMap.has(location) && noneCount < maxNoneIcons) {
                    const topics = JSON.parse(feature.properties.topics || "{}");
                    const hasAnyCategory = categories
                        .filter(cat => cat !== 'none')
                        .some(cat => topics[cat] === true);

                    if (!hasAnyCategory) {
                        locationMap.set(location, 'none');
                        noneCount++;
                    }
                }
            });

            // Update visibility for each layer
            categories.forEach(cat => {
                const layerId = `${cat}-layer`;
                const visibleLocations = Array.from(locationMap.entries())
                    .filter(([_, category]) => category === cat)
                    .map(([location, _]) => location);

                map.setFilter(layerId, [
                    'all',
                    ['has', 'topics'],
                    ['in', ['get', 'LocationName'], ['literal', visibleLocations]]
                ]);
            });
        }

        // Call updateLayerVisibility initially and when the source data changes
        updateLayerVisibility();
        map.on('sourcedata', (e) => {
            if (e.sourceId === 'combined' && e.isSourceLoaded) {
                updateLayerVisibility();
            }
        });

        // Helper function for handling popups
        function handlePopup(e, clickedLocation) {
            const featuresAtLocation = map.querySourceFeatures('combined', {
                filter: ['==', ['get', 'LocationName'], clickedLocation]
            });

            // Track unique contexts to avoid duplicates
            const seenContexts = new Set();
            
            // Build popup content
            let entriesHTML = featuresAtLocation
                .filter(f => {
                    const ctx = f.properties.context || "No context provided.";
                    // Only keep entries with contexts we haven't seen before
                    if (seenContexts.has(ctx)) {
                        return false;
                    }
                    seenContexts.add(ctx);
                    return true;
                })
                .map(f => {
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
        }

    } catch (error) {
        console.error('Failed to load one or more images:', error);
    }

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
    const activeThemes = themes.filter(theme =>
        document.getElementById(`filter-${theme}`)?.checked
    );

    categories.forEach(cat => {
        const isActive = document.getElementById(`filter-${cat}`)?.checked;
        const layer = `${cat}-layer`;
        
        if (!isActive) {
            map.setFilter(layer, ['in', 'id', '']);
            return;
        }

        const filterExpr = [
            'all',
            ['has', 'topics'],
            [
                'to-boolean',
                ['get', cat, ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]]
            ]
        ];

        // Add theme filters if any are selected
        if (activeThemes.length > 0) {
            const themeFilter = ['any'];
            activeThemes.forEach(theme => {
                themeFilter.push([
                    'to-boolean',
                    ['get', theme, ['coalesce', ['object', ['get', 'themes']], ['literal', {}]]]
                ]);
            });
            filterExpr.push(themeFilter);
        }

        map.setFilter(layer, filterExpr);
    });
}