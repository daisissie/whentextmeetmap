import os
import json
import openai

# Set your API key from the environment variable
openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("The OPENAI_API_KEY environment variable is not set.")

# Set the path to your GeoJSON file
GEOJSON_FILE_PATH = "geojson_output/combined.geojson"  # <-- Update this path accordingly
OUTPUT_GEOJSON_FILE_PATH = "output_test.geojson"  # <-- Update this output path if necessary

# Define the list of topics to check; this is used as a fallback.
TOPICS = ["bus", "river", "mountain", "wilderness", "trail", "lake", "forest", "desert", "road", "camp"]

def call_openai_for_topics(context_text):
    """
    Uses OpenAI function calling with a JSON schema to extract topic booleans from the provided text.
    Returns a dictionary of topics.
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
                        "describes specific topics."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        "Analyze the following text and tell me whether it describes each of the following topics: "
                        "bus, river, mountain, wilderness, trail, lake, forest, desert, road, camp. "
                        "Return the output by calling the function."
                        "\n\nText:\n" + context_text
                    )
                }
            ],
            functions=[
                {
                    "name": "parse_topics",
                    "description": (
                        "Determines if a given text describes specific topics. Returns a JSON object with boolean "
                        "values for the keys: bus, river, mountain, wilderness, trail, lake, forest, desert, road, camp."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "bus": {
                                "type": "boolean",
                                "description": "True if the text describes a bus, otherwise false."
                            },
                            "river": {
                                "type": "boolean",
                                "description": "True if the text describes a river, otherwise false."
                            },
                            "mountain": {
                                "type": "boolean",
                                "description": "True if the text describes a mountain, otherwise false."
                            },
                            "wilderness": {
                                "type": "boolean",
                                "description": "True if the text describes wilderness, otherwise false."
                            },
                            "trail": {
                                "type": "boolean",
                                "description": "True if the text describes a trail, otherwise false."
                            },
                            "lake": {
                                "type": "boolean",
                                "description": "True if the text describes a lake, otherwise false."
                            },
                            "forest": {
                                "type": "boolean",
                                "description": "True if the text describes a forest, otherwise false."
                            },
                            "desert": {
                                "type": "boolean",
                                "description": "True if the text describes a desert, otherwise false."
                            },
                            "road": {
                                "type": "boolean",
                                "description": "True if the text describes a road, otherwise false."
                            },
                            "camp": {
                                "type": "boolean",
                                "description": "True if the text describes a camp, otherwise false."
                            }
                        },
                        "required": ["bus", "river", "mountain", "wilderness", "trail", "lake", "forest", "desert", "road", "camp"]
                    }
                }
            ],
            function_call={"name": "parse_topics"}
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
            topics_data = call_openai_for_topics(context_text)
            # Append the structured output under a new key "topics"
            properties["topics"] = topics_data
        else:
            # If no context, set all topics to False
            properties["topics"] = {topic: False for topic in TOPICS}
    
    # Write out the updated GeoJSON to a new file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2)
    
    print(f"Processing complete. Output written to {output_path}")

if __name__ == "__main__":
    process_geojson(GEOJSON_FILE_PATH, OUTPUT_GEOJSON_FILE_PATH)