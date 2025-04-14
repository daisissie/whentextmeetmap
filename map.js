mapboxgl.accessToken = 'pk.eyJ1IjoiZGFpc2lzc2llIiwiYSI6ImNtN2Nyb2F3bzB2N3gyam9zenUyamV4eXIifQ.zfJE3IoB71zY8FesqhERag';

document.addEventListener('DOMContentLoaded', function () {
  // Initialize the map
  const map = new mapboxgl.Map({
    container: 'map', // Container ID from your HTML
    style: 'mapbox://styles/daisissie/cm9giyxae00em01qpbxgwbngl', 
  });

  map.on('load', function () {
    // Add the DEM source to the map which provides terrain data

    map.setTerrain({ source: 'dem', exaggeration: 1.5 });

    // Add the hillshade layer using the DEM source
    map.addLayer({
      id: 'hillshading',
      type: 'hillshade',
      source: 'dem',
      paint: {
        'hillshade-exaggeration': 5, // Adjust exaggeration for hillshading
      }
    });

    map.addSource('dem', {
      type: 'raster-dem',
      url: 'mapbox://styles/daisissie/cm9ghrif400i901qk45i9dwmu' // Mapbox Terrain DEM source URL
    });
    
    // Load manifest JSON from geojson_output/manifest.json
    fetch('geojson_output/manifest.json')
        .then(response => response.json())
        .then(manifest => {
            console.log(manifest);
            // ...optionally process manifest...
        })
        .catch(error => console.error('Error loading manifest:', error));

    // Add new GeoJSON sources for the three files
    map.addSource('hdthoreau_geojson', {
      type: 'geojson',
      data: '/Users/daiyu/Documents/github_mac/whentextmeetmap/geojson_output/locations_HenryDavidThoreau_Walden.geojson'
    });
    map.addSource('jackerouac_geojson', {
      type: 'geojson',
      data: '/Users/daiyu/Documents/github_mac/whentextmeetmap/geojson_output/locations_JackKerouac_OntheRoad(1976).geojson'
    });
    map.addSource('jonkrakauer_geojson', {
      type: 'geojson',
      data: '/Users/daiyu/Documents/github_mac/whentextmeetmap/geojson_output/locations_JonKrakauer_IntotheWild(2007).geojson'
    });

    // Load the PNG marker from the assets folder and add it as an image
    map.loadImage('assets/marker_logo-01.png', function (error, image) {
      if (error) throw error;
      map.addImage('custom-marker', image);
      
      // Add a symbol layer for Henry David Thoreau
      map.addLayer({
        id: 'hdthoreau-layer',
        type: 'symbol',
        source: 'hdthoreau_geojson',
        layout: {
          'icon-image': 'custom-marker',
          'icon-size': 0.4, // Adjust icon size as needed
          'icon-allow-overlap': true
        }
      });
      
      // Add a symbol layer for Jack Kerouac
      map.addLayer({
        id: 'jackerouac-layer',
        type: 'symbol',
        source: 'jackerouac_geojson',
        layout: {
          'icon-image': 'custom-marker',
          'icon-size': 0.4,
          'icon-allow-overlap': true
        }
      });
      
      // Add a symbol layer for Jon Krakauer
      map.addLayer({
        id: 'jonkrakauer-layer',
        type: 'symbol',
        source: 'jonkrakauer_geojson',
        layout: {
          'icon-image': 'custom-marker',
          'icon-size': 0.4,
          'icon-allow-overlap': true
        }
      });
    });
  });
});