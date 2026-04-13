#!/usr/bin/env python3
"""
Literary Geography Pipeline
============================
Input  : plain .txt file (English or Chinese)
Output : GeoJSON matching the output_final.geojson schema

Stack
-----
  Qwen2.5-14B  via mlx-lm       → location extraction + sentiment
  BGE-M3       via FlagEmbedding → topic + theme classification
  Mapbox Geocoding API           → geocoding (set MAPBOX_TOKEN env var)

Usage
-----
  export MAPBOX_TOKEN="pk.eyJ1..."
  python pipeline.py my_book.txt
  python pipeline.py my_book.txt --source "My Novel" --out result.geojson
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
import requests

# ── Local LLM (Qwen2.5 14B via MLX) ─────────────────────────────────────────
from mlx_lm import load, generate as mlx_generate

# ── Embeddings (BGE-M3 via sentence-transformers) ────────────────────────────
from sentence_transformers import SentenceTransformer

# =============================================================================
# CONFIGURATION
# =============================================================================

QWEN_MODEL_ID   = "mlx-community/Qwen2.5-14B-Instruct-4bit"
BGE_MODEL_ID    = "BAAI/bge-m3"

MAPBOX_TOKEN    = os.getenv("MAPBOX_TOKEN", "")
MAPBOX_GEOCODE  = "https://api.mapbox.com/search/geocode/v6/forward"

CHUNK_SIZE      = 1600   # characters per LLM call (fits ~400 tokens of context)
MAX_LLM_TOKENS  = 900    # max tokens Qwen may generate per chunk
TOPIC_THRESHOLD = 0.38   # cosine similarity cutoff for topic classification
THEME_THRESHOLD = 0.33   # cosine similarity cutoff for theme classification

# =============================================================================
# TOPIC & THEME SEED DESCRIPTIONS  (used for BGE-M3 similarity)
# =============================================================================

TOPIC_SEEDS = {
    "bus":        "bus coach motorcoach public transit vehicle transport passengers",
    "river":      "river stream creek waterway current flowing water tributary",
    "mountain":   "mountain hill peak summit ridge elevation climb ascent",
    "wilderness": "wilderness wild remote backcountry untamed nature solitude",
    "trail":      "trail hiking path footpath track walking route trekking",
    "lake":       "lake pond reservoir still water reflection shore",
    "forest":     "forest trees woods woodland timber grove canopy",
    "desert":     "desert arid dry sand dunes barren heat sparse vegetation",
    "road":       "road highway street route driving pavement asphalt",
    "camp":       "camp campsite tent campfire sleeping outdoors bivouac",
}

THEME_SEEDS = {
    "freedom_and_escape":               "freedom escape liberation open road leaving constraints behind breaking free",
    "road_trips_and_physical_journeys": "road trip travel journey moving across land driving adventure miles",
    "nature_as_solace":                 "nature as comfort healing solace refuge peace found in the natural world",
    "against_materialism":              "rejecting materialism anti-consumerism voluntary poverty simple life possessions",
    "search_for_meaning":               "search for meaning purpose existential quest spiritual seeking life's purpose",
    "identity":                         "identity self-discovery who am I personal growth transformation finding oneself",
    "loneliness_and_isolation":         "loneliness isolation solitude alone disconnected from society",
    "counterculture":                   "counterculture rebellion beat generation bohemian anti-establishment outsider",
    "time_and_presence":                "present moment time mindfulness living now transience impermanence",
    "risk":                             "risk danger adventure peril taking chances survival uncertainty",
    "family":                           "family parents siblings children home belonging domestic roots",
}

# =============================================================================
# MODEL LOADING  (happens once at import / startup)
# =============================================================================

print("⏳  Loading Qwen2.5-14B (MLX)…", flush=True)
_qwen_model, _qwen_tok = load(QWEN_MODEL_ID)
print("✓   Qwen2.5-14B ready", flush=True)

print("⏳  Loading BGE-M3…", flush=True)
_bge = SentenceTransformer(BGE_MODEL_ID)
print("✓   BGE-M3 ready", flush=True)

# Pre-encode seed descriptions once
print("⏳  Pre-computing seed embeddings…", flush=True)
_topic_keys   = list(TOPIC_SEEDS.keys())
_theme_keys   = list(THEME_SEEDS.keys())
_topic_vecs   = _bge.encode(list(TOPIC_SEEDS.values()), normalize_embeddings=True)
_theme_vecs   = _bge.encode(list(THEME_SEEDS.values()), normalize_embeddings=True)
print("✓   Embeddings ready\n", flush=True)

# =============================================================================
# UTILITIES
# =============================================================================

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / (denom + 1e-9))


def chunk_text(text: str, size: int = CHUNK_SIZE) -> list[str]:
    """Split on paragraph breaks; keep each chunk under `size` characters."""
    paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks, current = [], ""
    for para in paras:
        if len(current) + len(para) > size and current:
            chunks.append(current.strip())
            current = para + "\n\n"
        else:
            current += para + "\n\n"
    if current.strip():
        chunks.append(current.strip())
    return chunks


def pull_json(text: str):
    """Extract the first JSON array (or object) from a string."""
    for pattern in (r"\[[\s\S]*?\]", r"\{[\s\S]*?\}"):
        m = re.search(pattern, text)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    return []


def run_qwen(user: str, system: str, max_tokens: int = MAX_LLM_TOKENS) -> str:
    messages = [{"role": "system", "content": system},
                {"role": "user",   "content": user}]
    prompt = _qwen_tok.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    return mlx_generate(_qwen_model, _qwen_tok,
                        prompt=prompt, max_tokens=max_tokens, verbose=False)

# =============================================================================
# STEP 1 — LOCATION EXTRACTION  (Qwen2.5)
# =============================================================================

_EXTRACT_SYS = (
    "You are a literary geography expert. "
    "Extract real geographic place mentions from literary text. "
    "Reply ONLY with a valid JSON array, no prose."
)

_EXTRACT_TPL = """Extract every real geographic location from the passage below.

TEXT:
{chunk}

Return a JSON array. Each element must have exactly these keys:
  "name"      : full proper place name (e.g. "Mississippi River", not just "the river")
  "context"   : the complete sentence(s) from the text where this place appears — copy verbatim
  "sentiment" : "positive" | "negative" | "neutral"

Rules:
- Only include real, mappable places (cities, rivers, mountains, regions, roads, parks …)
- If the same place appears in multiple distinct sentences, include one entry per sentence
- Return [] if no real geographic places are present

JSON:"""


def extract_from_chunk(chunk: str) -> list[dict]:
    raw     = run_qwen(_EXTRACT_TPL.format(chunk=chunk), _EXTRACT_SYS)
    results = pull_json(raw)
    if not isinstance(results, list):
        return []
    clean = []
    for item in results:
        if not isinstance(item, dict):
            continue
        name    = str(item.get("name", "")).strip()
        context = str(item.get("context", "")).strip()
        sent    = str(item.get("sentiment", "neutral")).lower()
        if name and context:
            clean.append({"name": name, "context": context,
                          "sentiment": sent if sent in ("positive","negative","neutral") else "neutral"})
    return clean

# =============================================================================
# STEP 2 — TOPIC + THEME CLASSIFICATION  (BGE-M3 cosine similarity)
# =============================================================================

def classify(context: str) -> tuple[dict, dict]:
    """Return topics dict and themes dict for a single context sentence."""
    vec = _bge.encode([context], normalize_embeddings=True)[0]

    topics = {k: bool(cosine(vec, _topic_vecs[i]) >= TOPIC_THRESHOLD)
              for i, k in enumerate(_topic_keys)}
    themes = {k: bool(cosine(vec, _theme_vecs[i]) >= THEME_THRESHOLD)
              for i, k in enumerate(_theme_keys)}
    return topics, themes

# =============================================================================
# STEP 3 — GEOCODING  (Mapbox Geocoding API v6)
# =============================================================================

def geocode(name: str) -> tuple[float, float] | None:
    if not MAPBOX_TOKEN:
        print("    ⚠  MAPBOX_TOKEN not set — skipping geocode")
        return None
    try:
        r = requests.get(
            MAPBOX_GEOCODE,
            params={"q": name, "limit": 1, "access_token": MAPBOX_TOKEN},
            timeout=10,
        )
        r.raise_for_status()
        features = r.json().get("features", [])
        if features:
            coords = features[0]["geometry"]["coordinates"]  # [lon, lat]
            return float(coords[0]), float(coords[1])
    except Exception as e:
        print(f"    ⚠  Geocoding error for '{name}': {e}")
    return None

# =============================================================================
# MAIN PIPELINE
# =============================================================================

def process(text: str, source_name: str = "Uploaded Text") -> dict:
    chunks = chunk_text(text)
    print(f"  {len(chunks)} chunk(s) to process", flush=True)

    # ── 1. Extract locations via Qwen ────────────────────────────────────────
    raw_locations: list[dict] = []
    for i, chunk in enumerate(chunks, 1):
        print(f"  [LLM] Chunk {i}/{len(chunks)} — extracting locations…", flush=True)
        found = extract_from_chunk(chunk)
        raw_locations.extend(found)
        print(f"         → {len(found)} found", flush=True)

    # ── 2. Deduplicate by (name_lower, first-80-chars-of-context) ────────────
    seen, unique = set(), []
    for loc in raw_locations:
        key = (loc["name"].lower(), loc["context"][:80])
        if key not in seen:
            seen.add(key)
            unique.append(loc)
    print(f"\n  {len(unique)} unique location entries after dedup", flush=True)

    # ── 3. Classify + geocode ────────────────────────────────────────────────
    features: list[dict] = []
    for i, loc in enumerate(unique, 1):
        name = loc["name"]
        print(f"  [{i}/{len(unique)}] {name}", end="  ", flush=True)

        coords = geocode(name)

        if not coords:
            print("✗ not geocoded — skipped")
            continue

        topics, themes = classify(loc["context"])

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": list(coords)   # [lon, lat]
            },
            "properties": {
                "LocationName": name,
                "context":      loc["context"],
                "Sentiment":    loc["sentiment"],
                "Confidence":   "",
                "Literature":   source_name,
                "topics":       topics,
                "themes":       themes,
            }
        })
        print(f"✓  {coords[1]:.4f}, {coords[0]:.4f}")

    return {"type": "FeatureCollection", "features": features}

# =============================================================================
# CLI
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Literary geography pipeline — .txt → GeoJSON"
    )
    parser.add_argument("input",           help="Input .txt file")
    parser.add_argument("--out",  "-o",    help="Output .geojson (default: same stem)")
    parser.add_argument("--source", "-s",  help="Source / book name tag", default="")
    args = parser.parse_args()

    input_path  = Path(args.input)
    output_path = Path(args.out) if args.out else input_path.with_suffix(".geojson")
    source_name = args.source or input_path.stem

    if not input_path.exists():
        print(f"Error: {input_path} not found")
        sys.exit(1)

    print(f"\n{'='*50}")
    print(f"  Literary Geography Pipeline")
    print(f"{'='*50}")
    print(f"  Input  : {input_path}")
    print(f"  Output : {output_path}")
    print(f"  Source : {source_name}")
    print(f"{'='*50}\n")

    text = input_path.read_text(encoding="utf-8")
    print(f"  Text: {len(text):,} characters\n")

    geojson = process(text, source_name)

    output_path.write_text(
        json.dumps(geojson, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"\n{'='*50}")
    print(f"  Done. {len(geojson['features'])} features → {output_path}")
    print(f"{'='*50}\n")
