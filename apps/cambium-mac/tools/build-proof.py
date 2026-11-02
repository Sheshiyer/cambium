#!/usr/bin/env python3
"""Build provenance stamp for Cambium Native (schema cambium.native.build-proof.v1).

  build-proof.py generate --config CONF --identity-kind KIND --out FILE
      Hash the app build inputs and record the source revision, dirty state and
      toolchain. Paths are repo-relative. Run before codesign so the stamp is
      covered by the bundle signature. The stamp never holds the signed binary's
      own hash (that would be cyclic); snapshot runs hash the executable instead.
  build-proof.py inputs-digest
      Print only the aggregate input digest (used to detect edits during compile).
  build-proof.py check FILE [--expect-revision REV]
      Validate a stamp's shape and aggregate digest. Prints revision, dirty flag
      and aggregate digest. Exit 1 on missing or malformed, 3 on revision mismatch.

Hashes prove which bytes were present; they carry no producer authority.
"""
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
from datetime import datetime, timezone

SCHEMA = "cambium.native.build-proof.v1"
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Everything that shapes the bundle: both targets (runtime source + resources),
# the package manifest, the plist template and the build tooling itself.
INPUT_DIRS = ["Sources/CambiumNative", "Sources/CambiumCore"]
INPUT_FILES = ["Package.swift", "Package.resolved", "Info.plist.in", "build.sh", "tools/build-proof.py"]
SKIP_NAMES = {".DS_Store"}
MAX_FILES = 4000
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_STAMP_BYTES = 2 * 1024 * 1024
MAX_DIRTY_LISTED = 200
HEX40 = re.compile(r"^[0-9a-f]{40}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def fail(msg, code=1):
    print(f"build-proof: {msg}", file=sys.stderr)
    sys.exit(code)


def git(*args):
    r = subprocess.run(["git", "-C", APP_DIR, *args], capture_output=True, text=True)
    if r.returncode != 0:
        fail(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout


def repo_root():
    return os.path.realpath(git("rev-parse", "--show-toplevel").strip())


def rel(root, path):
    return os.path.relpath(os.path.realpath(path), root).replace(os.sep, "/")


def collect(root):
    paths = []
    for d in INPUT_DIRS:
        base = os.path.join(APP_DIR, d)
        if not os.path.isdir(base):
            fail(f"missing input directory {rel(root, base)}")
        for cur, dirs, files in os.walk(base):
            dirs.sort()
            for name in sorted(files):
                if name not in SKIP_NAMES:
                    paths.append(os.path.join(cur, name))
    for f in INPUT_FILES:
        p = os.path.join(APP_DIR, f)
        if os.path.isfile(p):
            paths.append(p)
    if len(paths) > MAX_FILES:
        fail(f"too many inputs ({len(paths)} > {MAX_FILES})")
    out = []
    for p in paths:
        size = os.path.getsize(p)
        if size > MAX_FILE_BYTES:
            fail(f"input too large: {rel(root, p)}")
        with open(p, "rb") as fh:
            out.append({"path": rel(root, p), "sha256": hashlib.sha256(fh.read()).hexdigest(), "bytes": size})
    out.sort(key=lambda e: e["path"])
    return out


def aggregate(entries):
    # sha256 over "<sha256>  <path>\n" lines sorted by path (shasum-style).
    h = hashlib.sha256()
    for e in entries:
        h.update(f"{e['sha256']}  {e['path']}\n".encode())
    return h.hexdigest()


def first_line(cmd):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return (r.stdout or r.stderr).strip().splitlines()[0] if r.returncode == 0 else "unavailable"
    except (OSError, subprocess.TimeoutExpired, IndexError):
        return "unavailable"


def generate(config, identity_kind, out):
    root = repo_root()
    entries = collect(root)
    revision = git("rev-parse", "HEAD").strip()
    if not HEX40.match(revision):
        fail(f"unexpected revision {revision!r}")
    scoped = [rel(root, os.path.join(APP_DIR, p)) for p in INPUT_DIRS + INPUT_FILES]
    status = git("-C", root, "status", "--porcelain=v1", "--untracked-files=all", "--", *scoped)
    dirty_paths = sorted({line[3:].split(" -> ")[-1] for line in status.splitlines() if line})
    tree_status = git("-C", root, "status", "--porcelain=v1", "--untracked-files=normal")
    stamp = {
        "schema": SCHEMA,
        "sourceRevision": revision,
        "inputsDirty": bool(dirty_paths),
        "dirtyInputCount": len(dirty_paths),
        "dirtyInputs": dirty_paths[:MAX_DIRTY_LISTED],
        "dirtyInputsTruncated": len(dirty_paths) > MAX_DIRTY_LISTED,
        "worktreeDirtyEntries": len([l for l in tree_status.splitlines() if l]),
        "inputScope": scoped,
        "inputCount": len(entries),
        "inputsAggregateSha256": aggregate(entries),
        "aggregateRule": "sha256 of '<sha256>  <repo-relative path>\\n' lines sorted by path",
        "inputs": entries,
        "configuration": config,
        "signingIdentityKind": identity_kind,
        "toolchain": {
            "swift": first_line(["swift", "--version"]),
            "sdk": first_line(["xcrun", "--sdk", "macosx", "--show-sdk-version"]),
            "xcode": first_line(["xcodebuild", "-version"]),
            "arch": platform.machine(),
        },
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "statement": "Hashes of build inputs at stamp time. Not a signature; no producer authority. "
                     "The signed executable's hash is recorded per snapshot, outside the bundle.",
    }
    data = json.dumps(stamp, indent=2, sort_keys=True).encode() + b"\n"
    if b"/Users/" in data or b"/private/" in data or root.encode() in data:
        fail("stamp would contain an absolute path")
    with open(out, "wb") as fh:
        fh.write(data)
    print(f"build-proof: {revision} inputsDirty={stamp['inputsDirty']} aggregate={stamp['inputsAggregateSha256']}")


def check(path, expect):
    try:
        if os.path.getsize(path) > MAX_STAMP_BYTES:
            fail("stamp too large")
        with open(path, "rb") as fh:
            s = json.loads(fh.read())
    except (OSError, ValueError) as e:
        fail(f"missing or malformed stamp: {e}")
    ok = (isinstance(s, dict) and s.get("schema") == SCHEMA
          and isinstance(s.get("sourceRevision"), str) and HEX40.match(s["sourceRevision"])
          and isinstance(s.get("inputsDirty"), bool)
          and isinstance(s.get("inputsAggregateSha256"), str) and HEX64.match(s["inputsAggregateSha256"])
          and isinstance(s.get("inputs"), list) and s["inputs"]
          and all(isinstance(e, dict) and isinstance(e.get("path"), str) and not e["path"].startswith("/")
                  and ".." not in e["path"].split("/")
                  and isinstance(e.get("sha256"), str) and HEX64.match(e["sha256"]) for e in s["inputs"]))
    if not ok:
        fail("malformed stamp")
    if aggregate(sorted(s["inputs"], key=lambda e: e["path"])) != s["inputsAggregateSha256"]:
        fail("aggregate digest does not match listed inputs")
    if expect is not None and not revision_matches(expect, s["sourceRevision"]):
        fail(f"expected revision {expect} but bundle was built from {s['sourceRevision']}", 3)
    print(f"{s['sourceRevision']} inputsDirty={str(s['inputsDirty']).lower()} aggregate={s['inputsAggregateSha256']}")


def revision_matches(expect, built):
    e = expect.strip().lower()
    return len(e) >= 7 and re.fullmatch(r"[0-9a-f]+", e) is not None and built.startswith(e)


def main(argv):
    if not argv:
        fail("usage: build-proof.py generate|inputs-digest|check ...", 2)
    cmd, rest = argv[0], argv[1:]
    if cmd == "generate":
        opts = dict(zip(rest[0::2], rest[1::2]))
        if len(rest) % 2 or set(opts) != {"--config", "--identity-kind", "--out"}:
            fail("generate needs --config, --identity-kind and --out", 2)
        generate(opts["--config"], opts["--identity-kind"], opts["--out"])
    elif cmd == "inputs-digest" and not rest:
        print(aggregate(collect(repo_root())))
    elif cmd == "check" and len(rest) in (1, 3) and (len(rest) == 1 or rest[1] == "--expect-revision"):
        check(rest[0], rest[2] if len(rest) == 3 else None)
    else:
        fail("usage: build-proof.py generate|inputs-digest|check ...", 2)


if __name__ == "__main__":
    main(sys.argv[1:])
