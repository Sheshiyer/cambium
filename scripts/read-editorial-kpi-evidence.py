#!/usr/bin/env python3
"""Read existing native consumer evidence without claim/observe/publish or ledger writes."""
import datetime as dt
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

captured = {}
sys.dont_write_bytecode = True

def raw_source(path):
    p = Path(path)
    if p.is_symlink() or not p.is_file() or p.stat().st_size > 16_000_000:
        raise ValueError('Source missing, symlinked or oversized')
    raw = p.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    previous = captured.get(str(p))
    if previous and previous != digest:
        raise ValueError('Source changed during read')
    captured[str(p)] = digest
    return raw

def sha(path):
    raw_source(path)
    return captured[str(Path(path))]

def load(path):
    return json.loads(raw_source(path))

consumer = Path(sys.argv[1]).resolve()
for module in [consumer, *(consumer.parent / name for name in ['calendar_runner.py','queue.py','context_pipeline.py'])]:
    raw_source(module)
consumer_digest = hashlib.sha256(json.dumps(captured, sort_keys=True).encode()).hexdigest()
sys.path.insert(0, str(consumer.parent))
spec = importlib.util.spec_from_file_location('native_kpi_readback', consumer)
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
queue_path, approval_path = Path(sys.argv[2]), Path(sys.argv[3])

approval = load(approval_path)
if approval.get('schema') != 'editorial.direct-human-authorization.v1' or approval.get('source') != 'direct user response in this Codex chat':
    raise ValueError('Original direct author receipt required')
if sha(approval['reviewPacketPath']) != approval['reviewPacketSha256']:
    raise ValueError('Reviewed packet changed')
rows = load(queue_path)['items']
if len(rows) > 1000 or len({r['id'] for r in rows}) != len(rows):
    raise ValueError('Queue identity budget or uniqueness failed')
selected = approval['payloads']
if len(selected) != 6 or len({r['id'] for r in selected}) != len(selected):
    raise ValueError('Exact six-item launch cohort required')
by_id = {r['id']: r for r in rows}
result = []
for accepted in selected:
    row = by_id.get(accepted['id'])
    if not row or row.get('authorization_receipt') != str(approval_path):
        raise ValueError('Accepted row or original authorization binding missing')
    actual = native.q.digest(row)
    if actual != accepted['payload_sha256'] or actual != row.get('approved_payload_sha256') or actual != row.get('payload_sha256'):
        raise ValueError('Current exact payload differs from authorization')
    if row.get('scheduled_for') != accepted['scheduledFor'] or row.get('delivery_mode') != accepted['deliveryMode']:
        raise ValueError('Approved delivery commitment changed')
    item = {k: row.get(k) for k in ['id','status','platform','account','destination','scheduled_for','payload_sha256','public_url']}
    item.update({'approvalDigest': sha(approval_path), 'publication': None})
    if row.get('status') == 'published':
        receipt = load(row['readback_evidence'])
        observation = load(receipt['observation_path'])
        if sha(receipt['observation_path']) != receipt['observation_sha256'] or receipt.get('id') != row['id'] or receipt.get('payload_sha256') != actual or receipt.get('state') != 'published':
            raise ValueError('Native receipt binding changed')
        observed = native.q.instant(observation['observed_at'])
        # Validate the recorded post-claim observation at its original event time.
        # This does not pretend the publication was freshly observed now.
        for artifact in observation.get('artifacts', []):
            if sha(artifact['path']) != artifact['sha256']:
                raise ValueError('Native artifact changed')
        state, url = native.observation_problem(row, observation, observed)
        if state != 'published' or url != row.get('public_url'):
            raise ValueError('Publication identity mismatch')
        item['publication'] = {'observedAt': observation['observed_at'], 'publicUrl': url,
            'receiptDigest': sha(row['readback_evidence']), 'observationDigest': sha(receipt['observation_path']),
            'trust': receipt['trust']}
    result.append(item)
for path, expected in list(captured.items()):
    if hashlib.sha256(Path(path).read_bytes()).hexdigest() != expected:
        raise ValueError('Source changed before output')
print(json.dumps({'schema':'cambium.editorial-kpi-source-read.v1','queueDigest':sha(queue_path),
    'approvalDigest':sha(approval_path),'consumerDigest':consumer_digest,'items':result}))
