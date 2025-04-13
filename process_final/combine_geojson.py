import json

# Define the file paths for the three GeoJSON files
filenames = [
    "geojson_output/locations_HenryDavidThoreau_Walden.geojson",
    "geojson_output/locations_JackKerouac_OntheRoad(1976).geojson",
    "geojson_output/locations_JonKrakauer_IntotheWild(2007).geojson"
]

combined_features = []

# Iterate over each file, read its content, and extract features
for file in filenames:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        features = data.get("features", [])
        combined_features.extend(features)
        print(f"Loaded {len(features)} features from {file}")
    except Exception as e:
        print(f"Error reading {file}: {e}")

# Create the combined GeoJSON structure
combined_geojson = {
    "type": "FeatureCollection",
    "features": combined_features
}

# Write the combined GeoJSON to a new file
output_file = "geojson_output/combined.geojson"
try:
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(combined_geojson, f, ensure_ascii=False, indent=2)
    print(f"Combined GeoJSON file created at {output_file}")
except Exception as e:
    print(f"Error writing the combined GeoJSON file: {e}")