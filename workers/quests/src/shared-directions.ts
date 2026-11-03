export interface DirectionScope { tenantId: string; principal: string }
export interface SharedDirection {
  id: string; tenantId: string; principal: string;
  title: string; body: string;
  workObjectId: string; workNodeId: string;
  graphHeadDigest: string; signalPins: { id: string; revision: number }[];
  revision: number; createdAt: string; updatedAt: string;
}

export interface DirectionStore {
  read(scope: DirectionScope, id: string): Promise<SharedDirection | null>;
  receipt(scope: DirectionScope, operationId: string): Promise<{ request: string; result: string } | null>;
  list(scope: DirectionScope, workObjectId: string | null): Promise<SharedDirection[]>;
  write(scope: DirectionScope, operationId: string, request: string, direction: SharedDirection, expectedRevision: number): Promise<'written' | 'replay' | 'operation_conflict' | 'revision_conflict'>;
}

export type DirectionDraft = Pick<SharedDirection, 'title' | 'body' | 'workObjectId' | 'workNodeId' | 'graphHeadDigest' | 'signalPins'>;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const directionIdentifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v,key));
export function validateDirectionDraft(value: unknown): value is DirectionDraft {
  if(!object(value) || !exact(value,['title','body','workObjectId','workNodeId','graphHeadDigest','signalPins']))return false;
  if(typeof value.title !== 'string' || !value.title.trim() || value.title.length>200 || /[\u0000-\u001f\u007f]/.test(value.title))return false;
  if(typeof value.body !== 'string' || value.body.length>16000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.body))return false;
  if(value.workObjectId!=='sapling:cambium' || !directionIdentifier(value.workNodeId) || typeof value.graphHeadDigest!=='string' || !/^(?:sha256:)?[a-f0-9]{64}$/.test(value.graphHeadDigest))return false;
  if(!Array.isArray(value.signalPins) || value.signalPins.length<1 || value.signalPins.length>16)return false;
  const ids=new Set<string>();
  for(const pin of value.signalPins) {
    if(!object(pin)||!exact(pin,['id','revision'])||!directionIdentifier(pin.id)||!Number.isSafeInteger(pin.revision)||(pin.revision as number)<1||ids.has(pin.id))return false;
    ids.add(pin.id);
  }
  return true;
}
