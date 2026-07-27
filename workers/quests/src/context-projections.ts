export const CONTEXT_PROJECTION_SCHEMA = 'thoughtseed.context-projection.v1';
export const CONTEXT_PROJECTION_RECEIPT_SCHEMA = 'thoughtseed.context-projection-receipt.v1';
export const CONTEXT_PROJECTION_KEY = 'context/v1/daily-standup-digest/standups/latest.json';
export const MAX_CONTEXT_PROJECTION_MARKDOWN_BYTES = 32 * 1024;
export const MAX_CONTEXT_PROJECTION_SOURCE_REVISION_LENGTH = 160;

const CONTEXT_PROJECTION_TENANT = 'cambium';
const CONTEXT_PROJECTION_ROUTINE = 'daily-standup-digest';
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;
const ENVELOPE_FIELDS = new Set([
  'schema',
  'key',
  'tenantId',
  'routine',
  'generation',
  'producedAt',
  'expiresAt',
  'sourceRevision',
  'contentDigest',
  'markdown',
]);

export interface ContextProjectionEnvelope {
  schema: typeof CONTEXT_PROJECTION_SCHEMA;
  key: typeof CONTEXT_PROJECTION_KEY;
  tenantId: typeof CONTEXT_PROJECTION_TENANT;
  routine: typeof CONTEXT_PROJECTION_ROUTINE;
  generation: number;
  producedAt: string;
  expiresAt: string;
  sourceRevision: string;
  contentDigest: string;
  markdown: string;
}

export interface ContextProjectionReceipt {
  schema: typeof CONTEXT_PROJECTION_RECEIPT_SCHEMA;
  key: typeof CONTEXT_PROJECTION_KEY;
  generation: number;
  contentDigest: string;
  producedAt: string;
  expiresAt: string;
}

export interface ContextProjectionStoreLike {
  put(value: unknown): Promise<ContextProjectionReceipt>;
}

interface ProjectionObjectLike {
  key?: string;
  etag?: string;
  text(): Promise<string>;
}

interface ProjectionPutOptions {
  onlyIf?: {
    etagMatches?: string;
    etagDoesNotMatch?: string;
  };
  httpMetadata?: { contentType?: string };
}

interface ProjectionBucketLike {
  get(key: string): Promise<ProjectionObjectLike | null>;
  put?(
    key: string,
    value: Uint8Array,
    options?: ProjectionPutOptions,
  ): Promise<ProjectionObjectLike | null>;
}

export class ContextProjectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextProjectionValidationError';
  }
}

export class ContextProjectionGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextProjectionGenerationError';
  }
}

export class ContextProjectionStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextProjectionStorageError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

interface ParsedRfc3339 {
  epochSeconds: bigint;
  nanoseconds: number;
}

function parseRfc3339(value: unknown): ParsedRfc3339 | null {
  if (typeof value !== 'string') return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    year < 1
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth(year, month)
    || hour > 23
    || minute > 59
    || second > 59
  ) return null;

  let offsetSeconds = 0;
  if (match[8] !== 'Z') {
    const offsetHours = Number(match[10]);
    const offsetMinutes = Number(match[11]);
    if (offsetHours > 23 || offsetMinutes > 59) return null;
    const direction = match[9] === '+' ? 1 : -1;
    offsetSeconds = direction * ((offsetHours * 60 + offsetMinutes) * 60);
  }

  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  utc.setUTCHours(hour, minute, second, 0);
  const utcSeconds = Math.trunc(utc.getTime() / 1000);
  const nanoseconds = Number((match[7] ?? '').padEnd(9, '0') || 0);
  return {
    epochSeconds: BigInt(utcSeconds - offsetSeconds),
    nanoseconds,
  };
}

function isLater(left: ParsedRfc3339, right: ParsedRfc3339): boolean {
  return left.epochSeconds > right.epochSeconds
    || (left.epochSeconds === right.epochSeconds && left.nanoseconds > right.nanoseconds);
}

function exactString(
  record: Record<string, unknown>,
  field: string,
  expected: string,
): string {
  const value = record[field];
  if (value !== expected) {
    throw new ContextProjectionValidationError(`${field} must equal ${expected}`);
  }
  return value;
}

export async function contentDigestForMarkdown(markdown: string): Promise<string> {
  const bytes = new TextEncoder().encode(markdown);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

export async function validateContextProjection(value: unknown): Promise<ContextProjectionEnvelope> {
  if (!isRecord(value)) {
    throw new ContextProjectionValidationError('envelope must be a JSON object');
  }
  const unknownFields = Object.keys(value).filter((field) => !ENVELOPE_FIELDS.has(field));
  if (unknownFields.length || Object.keys(value).length !== ENVELOPE_FIELDS.size) {
    throw new ContextProjectionValidationError('fields must match the frozen v1 envelope');
  }

  const schema = exactString(value, 'schema', CONTEXT_PROJECTION_SCHEMA);
  const key = exactString(value, 'key', CONTEXT_PROJECTION_KEY);
  const tenantId = exactString(value, 'tenantId', CONTEXT_PROJECTION_TENANT);
  const routine = exactString(value, 'routine', CONTEXT_PROJECTION_ROUTINE);

  const generation = value.generation;
  if (
    typeof generation !== 'number'
    || !Number.isSafeInteger(generation)
    || generation <= 0
  ) {
    throw new ContextProjectionValidationError('generation must be a positive safe integer');
  }

  const producedAt = value.producedAt;
  const parsedProducedAt = parseRfc3339(producedAt);
  if (!parsedProducedAt) {
    throw new ContextProjectionValidationError('producedAt must be a valid RFC3339 timestamp');
  }
  const expiresAt = value.expiresAt;
  const parsedExpiresAt = parseRfc3339(expiresAt);
  if (!parsedExpiresAt) {
    throw new ContextProjectionValidationError('expiresAt must be a valid RFC3339 timestamp');
  }
  if (!isLater(parsedExpiresAt, parsedProducedAt)) {
    throw new ContextProjectionValidationError('expiresAt must be later than producedAt');
  }

  const sourceRevision = value.sourceRevision;
  if (
    typeof sourceRevision !== 'string'
    || !sourceRevision
    || sourceRevision.trim() !== sourceRevision
    || /[\u0000-\u001f\u007f]/.test(sourceRevision)
    || utf8Length(sourceRevision) > MAX_CONTEXT_PROJECTION_SOURCE_REVISION_LENGTH
  ) {
    throw new ContextProjectionValidationError(
      `sourceRevision must be 1-${MAX_CONTEXT_PROJECTION_SOURCE_REVISION_LENGTH} safe UTF-8 bytes`,
    );
  }

  const markdown = value.markdown;
  if (typeof markdown !== 'string') {
    throw new ContextProjectionValidationError('markdown must be a string');
  }
  if (utf8Length(markdown) > MAX_CONTEXT_PROJECTION_MARKDOWN_BYTES) {
    throw new ContextProjectionValidationError(
      `markdown must not exceed ${MAX_CONTEXT_PROJECTION_MARKDOWN_BYTES} UTF-8 bytes`,
    );
  }

  const contentDigest = value.contentDigest;
  if (typeof contentDigest !== 'string' || !SHA256_DIGEST.test(contentDigest)) {
    throw new ContextProjectionValidationError(
      'contentDigest must be sha256 followed by 64 lowercase hexadecimal characters',
    );
  }
  if (contentDigest !== await contentDigestForMarkdown(markdown)) {
    throw new ContextProjectionValidationError('contentDigest does not match the exact markdown UTF-8 bytes');
  }

  return {
    schema: schema as typeof CONTEXT_PROJECTION_SCHEMA,
    key: key as typeof CONTEXT_PROJECTION_KEY,
    tenantId: tenantId as typeof CONTEXT_PROJECTION_TENANT,
    routine: routine as typeof CONTEXT_PROJECTION_ROUTINE,
    generation,
    producedAt: producedAt as string,
    expiresAt: expiresAt as string,
    sourceRevision,
    contentDigest,
    markdown,
  };
}

function receiptFor(envelope: ContextProjectionEnvelope): ContextProjectionReceipt {
  return {
    schema: CONTEXT_PROJECTION_RECEIPT_SCHEMA,
    key: envelope.key,
    generation: envelope.generation,
    contentDigest: envelope.contentDigest,
    producedAt: envelope.producedAt,
    expiresAt: envelope.expiresAt,
  };
}

export function createContextProjectionStore({
  bucket,
}: {
  bucket: ProjectionBucketLike;
}): ContextProjectionStoreLike {
  return {
    async put(value) {
      if (!bucket?.put) {
        throw new ContextProjectionStorageError('context projection bucket is not writable');
      }
      const envelope = await validateContextProjection(value);
      const canonicalJson = JSON.stringify(envelope);
      const encodedEnvelope = new TextEncoder().encode(canonicalJson);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const existingObject = await bucket.get(envelope.key);
        if (existingObject) {
          let existingValue: unknown;
          try {
            existingValue = JSON.parse(await existingObject.text());
          } catch {
            throw new ContextProjectionStorageError('existing context projection is invalid');
          }
          let existing: ContextProjectionEnvelope;
          try {
            existing = await validateContextProjection(existingValue);
          } catch {
            throw new ContextProjectionStorageError('existing context projection is invalid');
          }
          if (envelope.generation <= existing.generation) {
            throw new ContextProjectionGenerationError(
              `generation must be greater than existing generation ${existing.generation}`,
            );
          }
        }

        const onlyIf = existingObject
          ? existingObject.etag ? { etagMatches: existingObject.etag } : undefined
          : { etagDoesNotMatch: '*' };
        const written = await bucket.put(
          envelope.key,
          encodedEnvelope,
          {
            ...(onlyIf ? { onlyIf } : {}),
            httpMetadata: { contentType: 'application/json' },
          },
        );
        if (written) {
          return receiptFor(envelope);
        }
      }

      throw new ContextProjectionStorageError(
        'context projection changed concurrently; retry with a higher generation',
      );
    },
  };
}
