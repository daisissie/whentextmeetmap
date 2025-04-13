import json
import os
import sys
import openai
# Load the API key from an environment variable.
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("OpenAI API key not found in environment variable 'OPENAI_API_KEY'.")

# (Rest of your code remains the same)

# Provide the file path to your GeoJSON file.
geojson_path = "geojson_output/combined.geojson"

# Load the GeoJSON file.
with open(geojson_path, "r", encoding="utf-8") as f:
    geo_data = json.load(f)

# Extract the "context" field from each feature.
contexts = []
for feature in geo_data.get("features", []):
    properties = feature.get("properties", {})
    context_text = properties.get("context")
    if context_text:
        contexts.append(context_text)

if not contexts:
    print("No 'context' fields found in the GeoJSON file.")
else:
    # Combine all context texts into one string.
    combined_context = "\n\n".join(contexts)

    # Prepare a prompt for the OpenAI API.
    prompt = (
        "Below is a compilation of text from various contexts:\n\n"
        f"{combined_context}\n\n"
        "Based on the text above, identify and list 10 main topic categories that are discussed. "
        "Provide the output as a numbered list."
    )

    # Call the ChatCompletion API to extract the topics.
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",  # or use another model if preferred.
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,      # Adjust as needed.
            temperature=0.5      # Lower temperature for more deterministic results.
        )
        
        # Retrieve the generated topics from the response.
        topics = response.choices[0].message.content.strip()
        print("Extracted Topic Categories:")
        print(topics)
        
    except Exception as e:
        print("An error occurred while communicating with the OpenAI API:", e)