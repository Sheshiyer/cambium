-- Additive integrity fence on the existing immutable decision ledger.
-- No old receipt bytes are changed and renewal itself writes no D1 record.
-- Abort migration before installing the index if existing family metadata is
-- malformed. The guard table is migration-local and removed on success.
CREATE TABLE IF NOT EXISTS goal_graph_family_migration_guard (
  invalid_count INTEGER NOT NULL CHECK (invalid_count = 0)
);
INSERT INTO goal_graph_family_migration_guard (invalid_count)
WITH roots AS (
  SELECT tenant_id, json_type(canonical_json, '$.renewalRoot') AS root_type,
    json_extract(canonical_json, '$.renewalRoot') AS root,
    'approval:' || tenant_id || ':' AS prefix
  FROM goal_graph_approvals
  WHERE json_type(canonical_json, '$.renewalRoot') IS NOT NULL
), parts AS (
  SELECT *, substr(root, length(prefix) + 1) AS tail FROM roots
), digests AS (
  SELECT *, CASE WHEN substr(tail, 1, 7) = 'sha256:' THEN substr(tail, 8) ELSE tail END AS digest_nonce FROM parts
)
SELECT count(*) FROM digests
WHERE root_type <> 'text' OR substr(root, 1, length(prefix)) <> prefix
  OR length(digest_nonce) < 66 OR substr(digest_nonce, 65, 1) <> ':'
  OR substr(digest_nonce, 1, 64) GLOB '*[^0-9a-f]*'
  OR length(substr(digest_nonce, 66)) > 256;
DROP TABLE goal_graph_family_migration_guard;

-- CREATE UNIQUE INDEX also aborts on any pre-existing duplicate family.
-- Original writers have no renewalRoot and use their existing approval_id;
-- every descendant uses exactly that root's same approval_id. SQLite enforces
-- exclusion in the approval/graph transaction, including legacy late writers.
CREATE UNIQUE INDEX IF NOT EXISTS goal_graph_approval_family_unique
ON goal_graph_approvals (
  tenant_id,
  COALESCE(json_extract(canonical_json, '$.renewalRoot'), approval_id)
);
