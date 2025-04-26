import os
import json
import openai

# Set your API key from the environment variable
openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("The OPENAI_API_KEY environment variable is not set.")

# Set the path to your GeoJSON file
GEOJSON_FILE_PATH = "geojson_output/output_test.geojson"  # <-- Update this path accordingly
OUTPUT_GEOJSON_FILE_PATH = "output_final.geojson"  # <-- Update this output path if necessary

THEMES = [
    "freedom_and_escape",
    "road_trips_and_physical_journeys",
    "nature_as_solace",
    "against_materialism",
    "search_for_meaning",
    "identity",
    "loneliness_and_isolation",
    "counterculture",
    "time_and_presence",
    "risk",
    "family"
]

def call_openai_for_topics(context_text):
    """
    Uses OpenAI function calling with a JSON schema to extract theme booleans from the provided text.
    Returns a dictionary of themes.
    """
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",  # Using the requested model
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant that analyzes text to determine whether it "
                        "describes specific themes."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        "Analyze the following text and tell me whether it describes each of the following themes: freedom and escape, road trips and physical journeys, nature as solace, against materialism, search for meaning, identity, loneliness and isolation, counterculture, time and presence, risk, family. Return the output by calling the function."
                        "\n\nText:\n" + context_text
                    )
                }
            ],
            functions=[
                {
                    "name": "parse_themes",
                    "description": (
                        "Determines if a given text describes specific themes. Returns a JSON object with boolean "
                        "values for the keys: freedom_and_escape, road_trips_and_physical_journeys, nature_as_solace, against_materialism, search_for_meaning, identity, loneliness_and_isolation, counterculture, time_and_presence, risk, family."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "freedom_and_escape": {
                                "type": "boolean",
                                "description": "True if the text describes freedom and escape, otherwise false."
                            },
                            "road_trips_and_physical_journeys": {
                                "type": "boolean",
                                "description": "True if the text describes road trips and physical journeys, otherwise false."
                            },
                            "nature_as_solace": {
                                "type": "boolean",
                                "description": "True if the text describes nature as solace, otherwise false."
                            },
                            "against_materialism": {
                                "type": "boolean",
                                "description": "True if the text describes themes against materialism, otherwise false."
                            },
                            "search_for_meaning": {
                                "type": "boolean",
                                "description": "True if the text describes a search for meaning, otherwise false."
                            },
                            "identity": {
                                "type": "boolean",
                                "description": "True if the text describes identity, otherwise false."
                            },
                            "loneliness_and_isolation": {
                                "type": "boolean",
                                "description": "True if the text describes loneliness and isolation, otherwise false."
                            },
                            "counterculture": {
                                "type": "boolean",
                                "description": "True if the text describes counterculture themes, otherwise false."
                            },
                            "time_and_presence": {
                                "type": "boolean",
                                "description": "True if the text describes time and presence, otherwise false."
                            },
                            "risk": {
                                "type": "boolean",
                                "description": "True if the text describes risk, otherwise false."
                            },
                            "family": {
                                "type": "boolean",
                                "description": "True if the text describes family, otherwise false."
                            }
                        },
                        "required": ["freedom_and_escape", "road_trips_and_physical_journeys", "nature_as_solace", "against_materialism", "search_for_meaning", "identity", "loneliness_and_isolation", "counterculture", "time_and_presence", "risk", "family"]
                    }
                }
            ],
            function_call={"name": "parse_themes"}
        )

        # Extract the returned function call result
        message = response.choices[0].message
        if "function_call" in message:
            arguments = message["function_call"].get("arguments", "{}")
            topics_obj = json.loads(arguments)
        else:
            topics_obj = {}
    except Exception as e:
        print("Error during API call:", e)
        topics_obj = {}

    return topics_obj

def process_geojson(input_path, output_path):
    # Load the GeoJSON file
    with open(input_path, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)
    
    # Ensure we have a FeatureCollection with features
    features = geojson_data.get("features", [])
    
    # Iterate over all features
    for feature in features:
        properties = feature.get("properties", {})
        context_text = properties.get("context", "")
        if context_text:
            themes_data = call_openai_for_topics(context_text)
            # Append the structured output under a new key "themes"
            properties["themes"] = themes_data
        else:
            # If no context, set all themes to False
            properties["themes"] = {theme: False for theme in THEMES}
    
    # Write out the updated GeoJSON to a new file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)
    
    print(f"Processing complete. Output written to {output_path}")

if __name__ == "__main__":
    process_geojson(GEOJSON_FILE_PATH, OUTPUT_GEOJSON_FILE_PATH)