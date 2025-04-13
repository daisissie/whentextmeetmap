mapboxgl.accessToken = 'pk.eyJ1IjoiZGFpc2lzc2llIiwiYSI6ImNtN2Nyb2F3bzB2N3gyam9zenUyamV4eXIifQ.zfJE3IoB71zY8FesqhERag';

document.addEventListener('DOMContentLoaded', function() {
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/daisissie/cm97645k0000101rx31tf8ykg',
  });

  map.on('load', () => {
    map.addSource('dem', {
      'type': 'raster-dem',
      'url': 'mapbox://mapbox.mapbox-terrain-dem-v1'
    });
    map.addLayer(
      {
        'id': 'hillshading',
        'source': 'dem',
        'type': 'hillshade'
      },
      'land-structure-polygon'
    );
  });
});