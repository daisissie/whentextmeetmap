import os
import sys
import time
import json
import openai

# --- Setup ---

# Load the API key from an environment variable.
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("OpenAI API key not found in environment variable 'OPENAI_API_KEY'.")

# Provide the file path to your GeoJSON file.
geojson_path = "/Users/daiyu/Documents/github_mac/whentextmeetmap/geojson_output/combined.geojson"

# --- Load and Process GeoJSON ---

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
    sys.exit(0)

# Combine all context texts into one string.
combined_context = "\n\n".join(contexts)

# --- Step 1: Chunking the Combined Text ---

def chunk_text(text, max_chunk_size):
    """
    Split text into chunks based on a maximum character size.
    Uses double newline as a delimiter.
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    for p in paragraphs:
        # +2 accounts for the two newline characters we add back.
        if len(current_chunk) + len(p) + 2 < max_chunk_size:
            current_chunk += p + "\n\n"
        else:
            chunks.append(current_chunk.strip())
            current_chunk = p + "\n\n"
    if current_chunk:
        chunks.append(current_chunk.strip())
    return chunks

# Define a maximum chunk size in characters.
max_chunk_size = 3000
chunks = chunk_text(combined_context, max_chunk_size)
print(f"Total chunks created: {len(chunks)}")

# --- Step 2: Summarize Each Chunk ---

summaries = []
for idx, chunk in enumerate(chunks):
    prompt_summary = (
        "Please summarize the following text in a concise manner:\n\n" + chunk
    )
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt_summary}
            ],
            max_tokens=150,
            temperature=0.5
        )
        summary = response.choices[0].message.content.strip()
        summaries.append(summary)
        print(f"Summary for chunk {idx+1}:\n{summary}\n")
    except Exception as e:
        print(f"An error occurred while summarizing chunk {idx+1}:", e)
        sys.exit(1)
    # Optional delay to avoid rate limits.
    time.sleep(1)

# Combine all summaries into one aggregated summary.
combined_summary = "\n\n".join(summaries)
print("Combined Summary Length (in characters):", len(combined_summary))

# --- Step 3: Extract 10 Related Object/Noun Topics ---

# Updated prompt: Ask to extract 10 tangible objects/concrete nouns (e.g. tree, pond, road, desert, sea) based on the summarized text.
prompt_objects = (
    "Below is a summary of multiple texts:\n\n"
    + combined_summary
    + "\n\nBased on the summary above, identify and list 10 tangible objects or concrete nouns that are described or alluded to in the texts. "
      "These should be things like 'tree', 'pond', 'road', 'desert', 'sea', etc. "
      "Please provide the output as a numbered list."
)

try:
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt_objects}
        ],
        max_tokens=300,
        temperature=0.5
    )
    objects = response.choices[0].message.content.strip()
    print("Extracted Topic Objects:")
    print(objects)
except Exception as e:
    print("An error occurred while extracting topic objects:", e)