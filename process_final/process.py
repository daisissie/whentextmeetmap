from dotenv import load_dotenv
load_dotenv()  # Loads the environment variables from .env

import spacy
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import csv
import time
import os
import sys
import openai
import re  # Import the regular expression module
import googlemaps
from nltk.sentiment import SentimentIntensityAnalyzer

# ---------------------------
# 1. API Key Setup
# ---------------------------
openai.api_key = os.getenv("OPENAI_API_KEY") 

google_maps_api_key = os.getenv("GOOGLE_MAPS_API_KEY")

if not google_maps_api_key:
    print("Google Maps API key not found. Please set the 'GOOGLE_MAPS_API_KEY' environment variable.")
    exit(1)

# Initialize Google Maps client
gmaps = googlemaps.Client(google_maps_api_key)

# ---------------------------
# 2. Text Extraction Functions
# ---------------------------
def extract_text(file_path):
    """
    Extracts text from an EPUB file.
    """
    if file_path.lower().endswith('.epub'):
        return extract_text_from_epub(file_path)
    else:
        raise ValueError("Unsupported file format. Please provide an .epub file.")

def extract_text_from_epub(file_path):
    """
    Reads an EPUB file and extracts its text content using BeautifulSoup.
    """
    book = epub.read_epub(file_path)
    text = []
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_body_content(), 'html.parser')
            text.append(soup.get_text())
    return '\n'.join(text)

# ---------------------------
# 3. Setup NLP with spaCy
# ---------------------------
# Load the transformer-based spaCy model for English for improved NER.
nlp = spacy.load("en_core_web_trf")

def analyze_location_with_gpt(text, location_name):
    """
    Uses GPT to analyze the text and determine the accurate location.
    """
    try:
        response = openai.Completion.create(
            engine="text-davinci-003",  # Or another suitable engine
            prompt=f"Given the following text: '{text}', what is the most accurate and complete name of the location '{location_name}' being referred to? If the location is ambiguous, use context to resolve it. Respond only with the accurate location name.",
            max_tokens=100,
            n=1,
            stop=None,
            temperature=0.5,
        )
        accurate_location_name = response.choices[0].text.strip()
        return accurate_location_name

    except Exception as e:
        print(f"Error analyzing location with GPT: {e}")
        return location_name  # Return original location if GPT fails

def get_coordinates_from_google_maps(location_name):
    """
    Uses Google Maps API to get coordinates for a location, but only if it's in the United States.
    """
    try:
        geocode_result = gmaps.geocode(location_name)
        if geocode_result:
            # Check if the location's address components include United States.
            country_ok = False
            for comp in geocode_result[0]['address_components']:
                if "country" in comp['types'] and (comp['long_name'] == "United States" or comp['short_name'] == "US"):
                    country_ok = True
                    break
            if country_ok:
                latitude = geocode_result[0]['geometry']['location']['lat']
                longitude = geocode_result[0]['geometry']['location']['lng']
                return latitude, longitude
            else:
                print(f"{location_name} is not located in the United States.")
                return None, None
        else:
            print(f"Could not geocode {location_name} using Google Maps API.")
            return None, None

    except Exception as e:
        print(f"Error getting coordinates from Google Maps API: {e}")
        return None, None

def get_context(doc, start_char, end_char):
    """
    Retrieves the full sentence containing the target text from the spaCy document.
    If the sentence has fewer than 15 words, appends the next sentence (if available).
    Returns the context as a string.
    """
    sents = list(doc.sents)
    for idx, sent in enumerate(sents):
        if sent.start_char <= start_char and sent.end_char >= end_char:
            sentence_text = sent.text.strip()
            # Check if sentence is less than 15 words and if a next sentence exists.
            if len(sentence_text.split()) < 15 and idx + 1 < len(sents):
                sentence_text += " " + sents[idx + 1].text.strip()
            return sentence_text
    # Fallback: Return a longer fixed window if no sentence boundary is found.
    context_start = max(0, start_char - 100)
    context_end = min(len(doc.text), end_char + 100)
    return doc.text[context_start:context_end].strip()

# ---------------------------
# 4. Sentiment Analysis Setup
# ---------------------------
# Initialize sentiment analyzer
sia = SentimentIntensityAnalyzer()

def analyze_emotion(text):
    """
    Analyzes the sentiment of the text using VADER and returns the dominant sentiment (positive, negative, or neutral)
    along with its confidence percentage.
    """
    scores = sia.polarity_scores(text)
    pos = scores['pos']
    neu = scores['neu']
    neg = scores['neg']
    if pos >= neu and pos >= neg:
        label = "positive"
        confidence = round(pos * 100, 2)
    elif neg >= pos and neg >= neu:
        label = "negative"
        confidence = round(neg * 100, 2)
    else:
        label = "neutral"
        confidence = round(neu * 100, 2)
    return label, confidence

# ---------------------------
# 5. Main Workflow
# ---------------------------
def process_file(file_path):
    extracted_text = extract_text(file_path)
    doc = nlp(extracted_text)
    
    # Extract locations using NER from spaCy, preserving the order as they appear in the book.
    locations_info = []
    for ent in doc.ents:
        if ent.label_ in ["GPE", "LOC"]:
            locations_info.append((ent.text, ent.start_char, ent.end_char))
    
    # Prepare output CSV file.
    output_dir = "/Users/daiyu/Documents/github_mac/colloquium3/csv_output"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    output_csv_file = os.path.join(output_dir, f"locations_{base_name}.csv")
    
    with open(output_csv_file, mode='w', newline='', encoding='utf-8') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(["LocationName", "Latitude", "Longitude", "Context", "Sentiment", "Confidence"])

        # Initialize a set to track processed (LocationName, Context) pairs.
        processed_locations = set()

        # Iterate through the locations in the order they appear
        for loc_text, start_char, end_char in locations_info:
            context = get_context(doc, start_char, end_char)
            
            if any(keyword in context.lower() for keyword in ["chapter", "isbn", "ltd"]):
                print(f"Skipping location extraction for {loc_text} due to ignored keywords in context.")
                continue

            # Skip duplicate LocationName and Context
            if (loc_text, context) in processed_locations:
                print(f"Skipping duplicate location: {loc_text} in context: {context}")
                continue
            processed_locations.add((loc_text, context))
            
            if isinstance(context, str):
                accurate_location = analyze_location_with_gpt(context, loc_text)
                latitude, longitude = get_coordinates_from_google_maps(accurate_location)
                sentiment_label, confidence = analyze_emotion(context)
                
                if latitude and longitude:
                    csvwriter.writerow([loc_text, latitude, longitude, context, sentiment_label, f"{confidence}%"])
                    print(f"Geocoded {loc_text}: ({latitude}, {longitude}), Sentiment: {sentiment_label} (confidence: {confidence}%)")
                else:
                    csvwriter.writerow([loc_text, None, None, context, sentiment_label, f"{confidence}%"])
                    print(f"Could not geocode or did not meet criteria: {loc_text}, Sentiment: {sentiment_label} (confidence: {confidence}%)")
            else:
                csvwriter.writerow([loc_text, None, None, context, "Unclear", ""])
                print(f"Could not determine context for: {loc_text}")
                
    return f"CSV file '{output_csv_file}' has been created."

def main():
    input_dir = "/Users/daiyu/Documents/github_mac/colloquium3/use_data"
    if not os.path.exists(input_dir):
        print(f"Input folder {input_dir} does not exist.")
        sys.exit(1)
    for filename in os.listdir(input_dir):
        file_path = os.path.join(input_dir, filename)
        if os.path.isfile(file_path) and file_path.lower().endswith('.epub'):
            print(f"Processing file: {file_path}")
            result = process_file(file_path)
            print(result)

if __name__ == "__main__":
    main()