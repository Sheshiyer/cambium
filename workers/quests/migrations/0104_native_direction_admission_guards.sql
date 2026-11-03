-- One finite IVerif task. Edits revoke existing admission; reservation checks
-- source pins in the same SQLite operation as the durable request insert.
CREATE TRIGGER IF NOT EXISTS native_iverif_direction_edit_revokes
AFTER UPDATE ON shared_directions
BEGIN
  UPDATE native_launch_admissions SET status = 'revoked'
  WHERE status = 'active' AND tenant_id = NEW.tenant_id AND principal_id = NEW.principal_id
    AND work_id = 'sapling:iverif' AND admission_ref IN (
      SELECT 'claim-admission:' || node_id FROM goal_graph_nodes
      WHERE tenant_id = NEW.tenant_id AND namespace = 'founder-direction-execution'
        AND json_extract(metadata_json, '$.directionId') = NEW.direction_id
        AND json_extract(metadata_json, '$.directionRevision') <> NEW.revision
    );
END;

CREATE TRIGGER IF NOT EXISTS native_iverif_signal_edit_revokes
AFTER UPDATE ON shared_signals
BEGIN
  UPDATE native_launch_admissions SET status = 'revoked'
  WHERE status = 'active' AND tenant_id = NEW.tenant_id AND principal_id = NEW.principal_id
    AND work_id = 'sapling:iverif' AND admission_ref IN (
      SELECT 'claim-admission:' || n.node_id FROM goal_graph_nodes n
      JOIN shared_directions d ON d.tenant_id = n.tenant_id
        AND d.principal_id = NEW.principal_id AND d.direction_id = json_extract(n.metadata_json, '$.directionId')
      JOIN json_each(d.document, '$.signalPins') pin
      WHERE n.tenant_id = NEW.tenant_id AND n.namespace = 'founder-direction-execution'
        AND json_extract(pin.value, '$.id') = NEW.signal_id
        AND json_extract(pin.value, '$.revision') <> NEW.revision
    );
END;

CREATE TRIGGER IF NOT EXISTS native_iverif_reservation_source_guard
BEFORE INSERT ON native_launch_requests WHEN NEW.work_id = 'sapling:iverif'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM goal_graph_nodes n
    JOIN shared_directions d ON d.tenant_id = n.tenant_id AND d.principal_id = NEW.principal_id
      AND d.direction_id = json_extract(n.metadata_json, '$.directionId')
    WHERE n.tenant_id = NEW.tenant_id AND 'claim-admission:' || n.node_id = NEW.admission_ref
      AND n.namespace = 'founder-direction-execution' AND n.status = 'active'
      AND json_extract(n.metadata_json, '$.executionAdmissionDispatchDigest') = NEW.input_digest
      AND json_extract(n.metadata_json, '$.directionRevision') = d.revision
      AND NOT EXISTS (
        SELECT 1 FROM json_each(d.document, '$.signalPins') pin
        LEFT JOIN shared_signals s ON s.tenant_id = d.tenant_id AND s.principal_id = d.principal_id
          AND s.signal_id = json_extract(pin.value, '$.id')
        WHERE s.signal_id IS NULL OR s.revision <> json_extract(pin.value, '$.revision')
      )
  ) THEN RAISE(ABORT, 'native_direction_pins_changed') END;
END;

-- A success recorded after revocation, expiry or a graph/source edit cannot
-- become terminal evidence for this command. Failure evidence remains writable.
CREATE TRIGGER IF NOT EXISTS native_iverif_terminal_source_guard
BEFORE UPDATE OF terminal, outcome_status ON bridge_executions
WHEN NEW.terminal = 1 AND NEW.outcome_status = 'executed'
  AND json_extract(NEW.attestation_json, '$.command') = 'iverif.claim-proof.review'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM native_launch_admissions a
    JOIN native_launch_requests r ON r.tenant_id=a.tenant_id AND r.admission_ref=a.admission_ref
    JOIN goal_graph_heads h ON h.tenant_id=a.tenant_id AND h.graph_version=a.graph_version
    JOIN goal_graph_nodes n ON n.tenant_id=a.tenant_id AND a.admission_ref='claim-admission:' || n.node_id
    JOIN shared_directions d ON d.tenant_id=a.tenant_id AND d.principal_id=a.principal_id
      AND d.direction_id=json_extract(n.metadata_json, '$.directionId')
    WHERE a.work_id='sapling:iverif' AND a.status='active'
      AND a.input_digest=NEW.input_digest AND a.expires_at>NEW.outcome_recorded_at
      AND n.status='active' AND json_extract(n.metadata_json, '$.executionAdmissionMemberId')=NEW.member_id
      AND json_extract(n.metadata_json, '$.executionAdmissionDirectiveId')=NEW.directive_id
      AND json_extract(n.metadata_json, '$.directionRevision')=d.revision
      AND NOT EXISTS (
        SELECT 1 FROM json_each(d.document, '$.signalPins') pin
        LEFT JOIN shared_signals s ON s.tenant_id=d.tenant_id AND s.principal_id=d.principal_id
          AND s.signal_id=json_extract(pin.value, '$.id')
        WHERE s.signal_id IS NULL OR s.revision<>json_extract(pin.value, '$.revision')
      )
  ) THEN RAISE(ABORT, 'native_direction_terminal_pins_changed') END;
END;
