import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import type { Signal, SignalScope, SignalStore } from './shared-signals.ts';

export function d1SharedSignalStore(db: GoalGraphD1DatabaseLike): SignalStore {
  const read = async (scope: SignalScope, id: string): Promise<Signal | null> => {
    const row = await db.prepare('SELECT document FROM shared_signals WHERE tenant_id = ? AND principal_id = ? AND signal_id = ?')
      .bind(scope.tenantId, scope.principal, id).first<{ document: string }>();
    return row ? JSON.parse(row.document) : null;
  };
  const receipt = async (scope: SignalScope, operationId: string) => db.prepare(
    'SELECT request, result FROM shared_signal_operations WHERE tenant_id = ? AND principal_id = ? AND operation_id = ?'
  ).bind(scope.tenantId, scope.principal, operationId).first<{ request: string; result: string }>();
  return {
    read,
    receipt,
    async list(scope, projectId, cursor) {
      const rows = await db.prepare(`SELECT document FROM shared_signals WHERE tenant_id = ? AND principal_id = ?
        AND (? IS NULL OR EXISTS (SELECT 1 FROM json_each(shared_signals.document, '$.projectIds') WHERE value = ?))
        AND (? IS NULL OR created_at < ? OR (created_at = ? AND signal_id < ?))
        ORDER BY created_at DESC, signal_id DESC LIMIT 101`)
        .bind(scope.tenantId, scope.principal, projectId, projectId, cursor?.createdAt ?? null,
          cursor?.createdAt ?? null, cursor?.createdAt ?? null, cursor?.id ?? null).all<{ document: string }>();
      return (rows.results ?? []).map(row => JSON.parse(row.document));
    },
    async write(scope, operationId, request, signal, expectedRevision) {
      try {
        await db.prepare(`INSERT INTO shared_signal_operations
          (tenant_id, principal_id, operation_id, request, signal_id, expected_revision, result) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(scope.tenantId, scope.principal, operationId, request, signal.id, expectedRevision, JSON.stringify(signal)).run();
        return 'written';
      } catch (error) {
        const existing = await receipt(scope, operationId);
        if (existing) return existing.request === request ? 'replay' : 'operation_conflict';
        if (/signal_revision_conflict|UNIQUE constraint failed/i.test(String(error))) return 'revision_conflict';
        throw error;
      }
    },
  };
}
