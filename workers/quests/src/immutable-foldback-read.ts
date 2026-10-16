export interface BucketObject {
  text(): Promise<string>;
}

export interface BucketReader {
  get(key: string): Promise<BucketObject | null>;
}

export interface GoalGraphBinding {
  nodeId: string;
  taskId: string;
  workObjectId: string;
  workObjectKind: string;
  pinnedLoadoutId: string;
}

export interface FoldbackBinding {
  tenantId: string;
  graphVersion: number;
  goalGraph: GoalGraphBinding;
}

export interface FoldbackReceipt {
  receiptId: string;
  contentDigest: string;
  r2Key: string;
  status: string;
  tenantId: string;
  graphVersion: number;
  goalGraph: GoalGraphBinding;
  [field: string]: any;
}

export type FoldbackInput = Omit<
  FoldbackReceipt,
  "receiptId" | "contentDigest" | "r2Key" | "status"
>;

export type ValidateFn = (parsed: unknown) => Promise<FoldbackReceipt>;
export type AdaptFn<T> = (input: FoldbackInput) => T | Promise<T>;
export type CanonicalFn = (receipt: FoldbackReceipt) => string;

const SAFE_SEGMENT = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXEC_FILE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,159}\.json$/;
const PREFIX_ROOT = "portfolio/thoughtseed/workobjects/";

function assertKey(key: string, binding: FoldbackBinding): void {
  const workObjectId = binding?.goalGraph?.workObjectId;
  if (typeof key !== "string" || typeof workObjectId !== "string") {
    throw new Error("Invalid foldback key");
  }
  if (!SAFE_SEGMENT.test(workObjectId)) {
    throw new Error("Invalid foldback key");
  }
  if (key.includes("..") || key.includes("\\") || key.includes("//") || key.includes("\0")) {
    throw new Error("Invalid foldback key");
  }
  const prefix = `${PREFIX_ROOT}${workObjectId}/foldback/`;
  if (!key.startsWith(prefix)) {
    throw new Error("Invalid foldback key");
  }
  if (!EXEC_FILE.test(key.slice(prefix.length))) {
    throw new Error("Invalid foldback key");
  }
}

function assertBinding(receipt: FoldbackReceipt, binding: FoldbackBinding): void {
  const g = receipt?.goalGraph;
  const b = binding.goalGraph;
  if (
    !g ||
    receipt.tenantId !== binding.tenantId ||
    receipt.graphVersion !== binding.graphVersion ||
    g.nodeId !== b.nodeId ||
    g.taskId !== b.taskId ||
    g.workObjectId !== b.workObjectId ||
    g.workObjectKind !== b.workObjectKind ||
    g.pinnedLoadoutId !== b.pinnedLoadoutId
  ) {
    throw new Error("Foldback binding mismatch");
  }
}

export async function readValidatedFoldback<T = any>(
  bucket: BucketReader,
  key: string,
  binding: FoldbackBinding,
  validate: ValidateFn,
  adapt: AdaptFn<T>,
  canonical: CanonicalFn,
): Promise<T | null> {
  assertKey(key, binding);

  const object = await bucket.get(key);
  if (object === null) return null;

  const raw = await object.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Foldback is not valid JSON");
  }

  let receipt: FoldbackReceipt;
  try {
    receipt = await validate(parsed);
  } catch {
    throw new Error("Foldback validation failed");
  }
  if (!receipt || typeof receipt !== "object") {
    throw new Error("Foldback validation failed");
  }

  if (canonical(receipt) !== raw) {
    throw new Error("Foldback is not canonical");
  }
  if (receipt.r2Key !== key) {
    throw new Error("Foldback key mismatch");
  }
  assertBinding(receipt, binding);

  const { receiptId, contentDigest, r2Key, status, ...input } = receipt;
  void receiptId;
  void contentDigest;
  void r2Key;
  void status;

  return await adapt(input as FoldbackInput);
}

export async function confirmImmutableReadback(
  bucket: BucketReader,
  key: string,
  expected: string,
): Promise<void> {
  const object = await bucket.get(key);
  if (object === null) throw new Error("Readback object missing");
  if ((await object.text()) !== expected) {
    throw new Error("Readback content mismatch");
  }
}
