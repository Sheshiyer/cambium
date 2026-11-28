import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import type { SharedDirection, DirectionScope, DirectionStore } from './shared-directions.ts';

export function d1SharedDirectionStore(db: GoalGraphD1DatabaseLike): DirectionStore {
  const read = async (scope: DirectionScope, id: string): Promise<SharedDirection | null> => {
    const row = await db.prepare('SELECT document FROM shared_directions WHERE tenant_id = ? AND principal_id = ? AND direction_id = ?')
      .bind(scope.tenantId, scope.principal, id).first<{ document: string }>();
    return row ? JSON.parse(row.document) : null;
  };

  const receipt = async (scope: DirectionScope, operationId: string) => db.prepare(
    'SELECT request, result FROM shared_direction_operations WHERE tenant_id = ? AND principal_id = ? AND operation_id = ?'
  ).bind(scope.tenantId, scope.principal, operationId).first<{ request: string; result: string }>();
  return {
    read,
    receipt,
    async list(scope, workObjectId) {
      const rows = await db.prepare(`SELECT document FROM shared_directions WHERE tenant_id = ? AND principal_id = ?
        AND (? IS NULL OR json_extract(document, '$.workObjectId') = ?) ORDER BY created_at DESC, direction_id DESC LIMIT 100`)
        .bind(scope.tenantId, scope.principal, workObjectId, workObjectId)
        .all<{ document: string }>();
      return (rows.results ?? []).map(row => JSON.parse(row.document));
    },
    async write(scope, operationId, request, direction, expectedRevision) {
      if (direction.tenantId !== scope.tenantId || direction.principal !== scope.principal || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || direction.revision !== expectedRevision+1) throw new Error('direction_scope_or_revision_invalid');
      try {
        await db.prepare(`INSERT INTO shared_direction_operations
          (tenant_id, principal_id, operation_id, request, direction_id, expected_revision, result) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(scope.tenantId, scope.principal, operationId, request, direction.id, expectedRevision, JSON.stringify(direction)).run();
        return 'written';
      } catch (error) {
        const existing = await receipt(scope, operationId);
        if (existing) return existing.request === request ? 'replay' : 'operation_conflict';
        if (/direction_revision_conflict|UNIQUE constraint failed/i.test(String(error))) return 'revision_conflict';
        throw error;
      }
    },
  };
}
