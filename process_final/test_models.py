#!/usr/bin/env python3
"""
Quick smoke-test for Qwen2.5-14B (MLX) and BGE-M3 (sentence-transformers).
Models download automatically on first run:
  BGE-M3             ~2.3 GB  (BAAI/bge-m3 from Hugging Face)
  Qwen2.5-14B 4-bit  ~8 GB   (mlx-community/Qwen2.5-14B-Instruct-4bit)
Run: python test_models.py
"""

print("\n" + "="*50)
print("  Model Setup Test")
print("="*50 + "\n")

# ── 1. BGE-M3 via sentence-transformers ───────────────────────────────────────
print("① Loading BGE-M3…  (downloads ~2.3 GB on first run)")
from sentence_transformers import SentenceTransformer
import numpy as np

bge = SentenceTransformer("BAAI/bge-m3")

sentences = [
    "They camped beside the Mississippi River under open sky.",
    "She felt a deep longing for freedom and escape from the city.",
]
vecs = bge.encode(sentences, normalize_embeddings=True)
print(f"   ✓  BGE-M3 working — embedding shape: {vecs.shape}\n")

# ── 2. Qwen2.5-14B via mlx-lm ────────────────────────────────────────────────
print("② Loading Qwen2.5-14B (MLX 4-bit)…  (downloads ~8 GB on first run)")
from mlx_lm import load, generate

model, tokenizer = load("mlx-community/Qwen2.5-14B-Instruct-4bit")

messages = [
    {"role": "system", "content": "You are a helpful assistant. Reply briefly."},
    {"role": "user",   "content": "Name one real river in American literature. One sentence only."},
]
prompt   = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
response = generate(model, tokenizer, prompt=prompt, max_tokens=60, verbose=False)

print(f"   ✓  Qwen2.5-14B working")
print(f"   Response: {response.strip()}\n")

print("="*50)
print("  All models ready — you can run pipeline.py")
print("="*50 + "\n")
