#!/usr/bin/env python3
"""Embed MotionSites prompts into Vectorize + R2 for cortex-mcp."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "9d7cec1b5a32b2df8c6cdc1321ccd00b")
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
INDEX = "motionsites-prompts"
BUCKET = "thoughtseed-context-projections"
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/motionsites-ingest.json")
SKILLS = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/design-spokes.json")


def api(method: str, path: str, body=None, content_type="application/json"):
    url = f"https://api.cloudflare.com/client/v4{path}"
    data = None
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        elif isinstance(body, bytes):
            data = body
            headers["Content-Type"] = content_type
        else:
            data = str(body).encode()
            headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            if not raw:
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:500]
        raise SystemExit(f"{method} {path} -> {e.code} {err}")


def ensure_index():
    listed = api("GET", f"/accounts/{ACCOUNT}/vectorize/v2/indexes")
    names = [x.get("name") for x in (listed.get("result") or [])]
    if INDEX in names:
        print("index exists", INDEX)
        return
    print("creating index", INDEX)
    api(
        "POST",
        f"/accounts/{ACCOUNT}/vectorize/v2/indexes",
        {"name": INDEX, "config": {"dimensions": 768, "metric": "cosine"}},
    )


def embed_batch(texts: list[str]) -> list[list[float]]:
    res = api(
        "POST",
        f"/accounts/{ACCOUNT}/ai/run/@cf/baai/bge-base-en-v1.5",
        {"text": texts},
    )
    data = (res.get("result") or {}).get("data") or res.get("data")
    if not data:
        raise SystemExit(f"embed empty: {str(res)[:300]}")
    return data


def r2_put(key: str, payload: bytes, content_type: str):
    from urllib.parse import quote
    api(
        "PUT",
        f"/accounts/{ACCOUNT}/r2/buckets/{BUCKET}/objects/{quote(key, safe='')}",
        payload,
        content_type,
    )


def main():
    bundle = json.loads(SRC.read_text())
    records = bundle["records"]
    print("records", len(records))
    ensure_index()

    vectors = []
    for i in range(0, len(records), 20):
        chunk = records[i : i + 20]
        print(f"embed {i+1}-{i+len(chunk)}")
        vecs = embed_batch([r["embed_text"][:2000] for r in chunk])
        if len(vecs) != len(chunk):
            raise SystemExit(f"embed count mismatch {len(vecs)} != {len(chunk)}")
        for rec, vec in zip(chunk, vecs):
            vectors.append(
                {
                    "id": rec["id"][:64],
                    "values": vec,
                    "metadata": {
                        "title": (rec.get("title") or "")[:120],
                        "category": (rec.get("category") or "")[:80],
                        "page_type": (rec.get("page_type") or "")[:40],
                        "video_preview_url": (rec.get("video_preview_url") or "")[:300],
                        "image_preview_url": (rec.get("image_preview_url") or "")[:300],
                        "excerpt": (rec.get("excerpt") or "")[:900],
                    },
                }
            )
        time.sleep(0.2)

    for i in range(0, len(vectors), 50):
        chunk = vectors[i : i + 50]
        print(f"upsert {i+1}-{i+len(chunk)}")
        ndjson = "\n".join(json.dumps(v) for v in chunk) + "\n"
        # Vectorize upsert v2 expects ndjson
        url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/vectorize/v2/indexes/{INDEX}/upsert"
        req = urllib.request.Request(
            url,
            data=ndjson.encode(),
            method="POST",
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/x-ndjson",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            print(" upsert", resp.status, resp.read()[:200])
        time.sleep(0.2)

    index_lite = [
        {
            k: rec[k]
            for k in (
                "id",
                "title",
                "category",
                "page_type",
                "video_preview_url",
                "image_preview_url",
                "local_videos",
                "local_images",
                "excerpt",
            )
        }
        for rec in records
    ]
    print("r2 index")
    r2_put("taste/motionsites/index.json", json.dumps(index_lite).encode(), "application/json")
    print("r2 skills")
    r2_put("taste/skills/design-spokes.json", SKILLS.read_bytes(), "application/json")

    for i, rec in enumerate(records):
        key = f"taste/motionsites/{rec['id']}.md"
        r2_put(key, rec["prompt_text"].encode(), "text/markdown")
        if (i + 1) % 50 == 0:
            print("r2 bodies", i + 1)
    print("done", len(records))


if __name__ == "__main__":
    main()
