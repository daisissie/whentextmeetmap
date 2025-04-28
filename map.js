// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZGFpc2lzc2llIiwiYSI6ImNtN2Nyb2F3bzB2N3gyam9zenUyamV4eXIifQ.zfJE3IoB71zY8FesqhERag';

// Global flag for toggling point visibility
let showAllPoints = false;

// Initialize map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/daisissie/cm9giyxae00em01qpbxgwbngl',
    minZoom: 0,
    maxZoom: 12,
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

// Theme categories (match the checkboxes in index.html)
const themeCategories = [
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
                    12, 55    // At zoom level 12, radius is 10px
                ],
                'circle-stroke-width': 0.3,
                'circle-stroke-color': '#ffffff'
            }
        });

        // Create a layer for each category
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
                        12, 1.5
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

        // Create a symbol layer for each theme and tie it to its checkbox
        themeCategories.forEach(theme => {
            // Add a layer for this theme
            map.addLayer({
                id: `${theme}-theme-layer`,
                type: 'symbol',
                source: 'combined',
                layout: {
                    // Dynamically select topic icon based on the feature's topics object
                    'icon-image': [
                        'case',
                        ['==', ['get', 'bus', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'bus-icon',
                        ['==', ['get', 'river', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'river-icon',
                        ['==', ['get', 'mountain', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'mountain-icon',
                        ['==', ['get', 'wilderness', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'wilderness-icon',
                        ['==', ['get', 'trail', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'trail-icon',
                        ['==', ['get', 'lake', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'lake-icon',
                        ['==', ['get', 'forest', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'forest-icon',
                        ['==', ['get', 'desert', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'desert-icon',
                        ['==', ['get', 'road', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'road-icon',
                        ['==', ['get', 'camp', ['coalesce', ['object', ['get', 'topics']], ['literal', {}]]], true], 'camp-icon',
                        // Fallback if no topic matched
                        'none-icon'
                    ],
                    'icon-size': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 0.4,
                        4, 0.5,
                        8, 1.2,
                        12, 1.5
                    ],
                    'icon-allow-overlap': true
                },
                filter: [
                    '==',
                    ['get', theme, ['coalesce', ['object', ['get', 'themes']], ['literal', {}]]],
                    true
                ]
            });

            // Initialize layer hidden
            map.setLayoutProperty(`${theme}-theme-layer`, 'visibility', 'none');

            // Tie checkbox to layer visibility
            const checkbox = document.getElementById(`filter-${theme}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    map.setLayoutProperty(
                        `${theme}-theme-layer`,
                        'visibility',
                        checkbox.checked ? 'visible' : 'none'
                    );
                });
            }

            // Add click event for theme layer to show popup
            map.on('click', `${theme}-theme-layer`, (e) => {
                const clickedLocation = e.features[0].properties.LocationName || "Unknown Location";
                handlePopup(e, clickedLocation);
            });
            // Change cursor on hover for theme layer
            map.on('mouseenter', `${theme}-theme-layer`, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', `${theme}-theme-layer`, () => {
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

                // Ensure layer is visible when showing all points
                map.setLayoutProperty(layerId, 'visibility', 'visible');

                map.setFilter(layerId, [
                    'all',
                    ['has', 'topics'],
                    ['in', ['get', 'LocationName'], ['literal', visibleLocations]]
                ]);
            });
        }

        // Update hideAllPoints to also clear filters
        function hideAllPoints() {
            categories.forEach(cat => {
                const layerId = `${cat}-layer`;
                map.setLayoutProperty(layerId, 'visibility', 'none');
                map.setFilter(layerId, ['in', 'id', '']);
            });
        }

        // Apply theme-only filtering when points are hidden
        function applyThemeFilter() {
            const selectedThemes = themes.filter(theme =>
                document.getElementById(`filter-${theme}`)?.checked
            );
            const noneSelected = document.getElementById('filter-none-theme')?.checked;
            // If no themes selected and none-theme not selected, hide all
            if (selectedThemes.length === 0 && !noneSelected) {
                categories.forEach(cat => {
                    map.setLayoutProperty(`${cat}-layer`, 'visibility', 'none');
                });
                return;
            }
            categories.forEach(cat => {
                const layerId = `${cat}-layer`;
                // Topic filter for this category
                const topicFilter = cat === 'none'
                    ? ['all',
                        ['has','topics'],
                        ['all',
                            ...categories
                                .filter(c => c !== 'none')
                                .map(c => ['!=',['get', c, ['coalesce',['object',['get','topics']],['literal',{}]]], true])
                        ]
                      ]
                    : ['to-boolean',['get', cat, ['coalesce',['object',['get','topics']],['literal',{}]]]];
                // Build theme filter parts
                let filterParts = [];
                selectedThemes.forEach(theme => {
                    filterParts.push(['==',['get', theme, ['coalesce',['object',['get','themes']],['literal',{}]]], true]);
                });
                if (noneSelected) {
                    // all themes false
                    filterParts = themes.map(theme =>
                        ['!=',['get', theme, ['coalesce',['object',['get','themes']],['literal',{}]]], true]
                    );
                }
                const themeFilter = ['any', ...filterParts];
                // Combine filters
                const combinedFilter = ['all', ['has','topics'], topicFilter, themeFilter];
                map.setLayoutProperty(layerId, 'visibility', 'visible');
                map.setFilter(layerId, combinedFilter);
            });
        }

        // Call updateLayerVisibility initially
        updateLayerVisibility();
        // Only re-display points when showAllPoints is true, otherwise re-hide
        map.on('sourcedata', (e) => {
            if (e.sourceId === 'combined' && e.isSourceLoaded) {
                if (showAllPoints) {
                    updateLayerVisibility();
                } else {
                    hideAllPoints();
                }
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

        // Modify the toggle button functionality
        const toggleButton = document.getElementById('toggle-all-themes');

        // hideAllPoints is now defined above with filter clearing

        function showPoints() {
            // Show points based on current theme filters
            const activeThemes = themes.filter(theme => 
                document.getElementById(`filter-${theme}`)?.checked
            );
            
            if (activeThemes.length === 0) {
                updateLayerVisibility(); // Show all points if no themes selected
            } else {
                updateFilters(); // Show filtered points
            }
        }

        toggleButton.addEventListener('click', () => {
            showAllPoints = !showAllPoints;
            toggleButton.textContent = showAllPoints ? 'Hide All Points' : 'Show All Points';
            if (showAllPoints) {
                updateLayerVisibility();
            } else {
                hideAllPoints();
            }
        });

        // Initialize with all themes unchecked and points hidden
        themes.forEach(theme => {
            const checkbox = document.getElementById(`filter-${theme}`);
            if (checkbox) {
                checkbox.checked = false;
            }
        });

        // Initially hide all points
        categories.forEach(cat => {
            const layer = `${cat}-layer`;
            map.setFilter(layer, ['in', 'id', '']);
        });

        // Modify theme checkbox event listeners so toggling any theme
        // forces the map into the hidden-all state and applies the theme filter persistently
        themes.forEach(theme => {
            const checkbox = document.getElementById(`filter-${theme}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    // Enter hidden state and apply theme filter
                    showAllPoints = false;
                    toggleButton.textContent = 'Show All Points';
                    applyThemeFilter();
                });
            }
        });
        const noneThemeCheckbox = document.getElementById('filter-none-theme');
        if (noneThemeCheckbox) {
            noneThemeCheckbox.addEventListener('change', () => {
                showAllPoints = false;
                toggleButton.textContent = 'Show All Points';
                applyThemeFilter();
            });
        }

        // Initialize state: show all points and set button label accordingly
        showAllPoints = true;
        toggleButton.textContent = 'Hide All Points';
        // Initially display all points
        updateLayerVisibility();

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

});