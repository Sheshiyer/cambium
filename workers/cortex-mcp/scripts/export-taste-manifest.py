# Cortex Memory & Taste Vectorize Migrator
# Ingests Taste Cortex markdown blobs into Cloudflare Vectorize (taste-cortex, 768-dim)

import os
import json
import hashlib
from pathlib import Path

TASTE_DIR = Path.home() / ".hermes/skills/design-agent/references/taste"

def extract_metadata(filepath: Path) -> dict:
    content = filepath.read_text(encoding="utf-8")
    meta = {"author": "", "title": "", "category": filepath.parent.name}
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            fm = content[3:end]
            for line in fm.split("\n"):
                if ":" in line:
                    key, val = line.split(":", 1)
                    key = key.strip()
                    val = val.strip().strip('"')
                    if key in meta:
                        meta[key] = val
    for line in content.split("\n"):
        if line.startswith("# "):
            meta["title"] = line[2:].strip()
            break
    return meta

def prepare_ndjson():
    lines = []
    for cat in ["prompts", "techniques", "media-refs"]:
        cat_dir = TASTE_DIR / cat
        if not cat_dir.exists():
            continue
        for md_file in cat_dir.glob("*.md"):
            meta = extract_metadata(md_file)
            content = md_file.read_text(encoding="utf-8")
            file_id = f"{cat}-{md_file.stem}"
            record = {
                "id": file_id,
                "text": content[:2000],
                "metadata": {
                    "category": cat,
                    "author": meta["author"] or "unknown",
                    "title": meta["title"] or md_file.stem,
                    "slug": md_file.stem,
                    "content_hash": hashlib.md5(content.encode()).hexdigest(),
                }
            }
            lines.append(record)
    
    out_file = Path("taste-blobs-manifest.json")
    out_file.write_text(json.dumps(lines, indent=2))
    print(f"Prepared {len(lines)} blobs in taste-blobs-manifest.json")

if __name__ == "__main__":
    prepare_ndjson()
