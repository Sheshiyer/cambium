#!/usr/bin/env python3
"""Post compiled GTM TG handoff board via Hermes EC2 (SSM). Never prints bot token."""
from __future__ import annotations

import base64
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[3]
BOARD = ROOT / ".state/sapling-iverif/tg-handoff/board.json"
RECEIPT = pathlib.Path(__file__).resolve().parent / "tg-handoff-post-receipt.json"
INSTANCE = "i-056c5f1d3a9f74190"
PROFILE = "safvr"

REMOTE_SCRIPT = r'''#!/bin/bash
set -euo pipefail
mkdir -p /tmp/gtm-tg-handoff
python3 - <<'PY'
import json, urllib.parse, urllib.request, pathlib, base64, os
from datetime import datetime, timezone
board_b64 = os.environ["BOARD_B64"]
pathlib.Path("/tmp/gtm-tg-handoff/board.json").write_bytes(base64.b64decode(board_b64))
env = {}
for line in pathlib.Path("/etc/hermes/.env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
bot = env.get("TELEGRAM_BOT_TOKEN", "")
chat = env.get("TELEGRAM_HOME_CHANNEL", "")
if not bot or not chat:
    raise SystemExit("MISSING_BOT_OR_CHAT")
board = json.loads(pathlib.Path("/tmp/gtm-tg-handoff/board.json").read_text())
results = []
for card in board["cards"]:
    text = card["text"][:3900]
    thread = int(card["threadId"])
    data = urllib.parse.urlencode({
        "chat_id": chat,
        "text": text,
        "message_thread_id": str(thread),
        "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{bot}/sendMessage",
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode())
            mid = (body.get("result") or {}).get("message_id")
            results.append({
                "cardId": card["cardId"],
                "topic": card["topicKey"],
                "thread": thread,
                "ok": body.get("ok"),
                "message_id": mid,
            })
    except Exception as e:
        results.append({
            "cardId": card["cardId"],
            "topic": card["topicKey"],
            "thread": thread,
            "ok": False,
            "error": str(e)[:200],
        })
out = {
    "postedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "results": results,
}
print(json.dumps(out))
pathlib.Path("/tmp/gtm-tg-handoff/post-receipt.json").write_text(json.dumps(out, indent=2))
PY
'''


def main() -> int:
    board_b64 = base64.b64encode(BOARD.read_bytes()).decode()
    script_b64 = base64.b64encode(REMOTE_SCRIPT.encode()).decode()
    params = {
        "commands": [
            f"echo {script_b64} | base64 -d > /tmp/gtm-post.sh",
            "chmod +x /tmp/gtm-post.sh",
            f"export BOARD_B64={board_b64}",
            "bash /tmp/gtm-post.sh",
        ]
    }
    params_path = pathlib.Path("/tmp/gtm-ssm-params.json")
    params_path.write_text(json.dumps(params))

    cmd_id = subprocess.check_output(
        [
            "aws",
            "--profile",
            PROFILE,
            "ssm",
            "send-command",
            "--instance-ids",
            INSTANCE,
            "--document-name",
            "AWS-RunShellScript",
            "--comment",
            "GTM TG handoff board light-up",
            "--parameters",
            f"file://{params_path}",
            "--query",
            "Command.CommandId",
            "--output",
            "text",
        ],
        text=True,
    ).strip()
    print(f"CMD_ID={cmd_id}")

    for _ in range(25):
        inv = json.loads(
            subprocess.check_output(
                [
                    "aws",
                    "--profile",
                    PROFILE,
                    "ssm",
                    "get-command-invocation",
                    "--command-id",
                    cmd_id,
                    "--instance-id",
                    INSTANCE,
                    "--output",
                    "json",
                ],
                text=True,
            )
        )
        status = inv.get("Status")
        print(f"status={status}")
        if status in {"Success", "Failed", "Cancelled", "TimedOut"}:
            stdout = inv.get("StandardOutputContent") or ""
            stderr = inv.get("StandardErrorContent") or ""
            print("STDOUT", stdout[:5000])
            if stderr:
                print("STDERR", stderr[:2000])
            for line in stdout.splitlines():
                line = line.strip()
                if line.startswith("{") and "results" in line:
                    receipt = json.loads(line)
                    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")
                    print(f"WROTE {RECEIPT}")
                    oks = [r for r in receipt.get("results", []) if r.get("ok")]
                    return 0 if len(oks) == len(receipt.get("results", [])) else 1
            return 1 if status != "Success" else 0
        time.sleep(3)
    print("timeout waiting for SSM")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
