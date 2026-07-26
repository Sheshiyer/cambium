/**
 * Command Code translating adapter.
 *
 * Command Code does not speak OpenAI chat. It wants a hoisted top-level `system`
 * string, its own message/tool part shapes, and a `params` envelope, POSTed to
 * /alpha/generate; it answers with a bespoke event stream (text-delta,
 * reasoning-delta, tool-call, finish, error) rather than OpenAI chunks.
 *
 * The broker's other providers are byte-passthrough. This one cannot be, so this
 * module translates both directions and is the only place in the Worker that
 * knows Command Code's wire format.
 *
 * PROVENANCE — read this before editing.
 * Every rule here is ported from OmniRoute's CommandCodeExecutor
 * (open-sse/executors/commandCode.ts @ 3.8.48), which is the reference
 * implementation and the one that gets upstream updates. Where the shape looked
 * arbitrary it was preserved rather than "cleaned up", because the arbitrariness
 * is usually the endpoint's:
 *
 *   - `stream: true` is ALWAYS sent, even for a non-streaming caller. The
 *     endpoint only streams; non-streaming is synthesised on our side.
 *   - max_tokens is OMITTED when absent or non-positive rather than defaulted.
 *     Upstream learned this the hard way: forcing Math.max(1, ...) truncated
 *     output to a single token, and inventing a value got DeepSeek V4 rejected
 *     with "Too big: expected number to be <=200000".
 *   - Unpaired tool calls and tool results are DROPPED. Command Code rejects a
 *     tool-call without its matching result and vice versa, so both sides are
 *     filtered against the set of ids that appear on both.
 *   - Image parts survive only for vision-capable models, and a user message
 *     stripped to nothing falls back to empty text because the endpoint rejects
 *     empty content.
 *
 * The version pin matters: Command Code validates x-command-code-version.
 */

const MAX_COMMAND_CODE_TOKENS = 200_000;

export const COMMAND_CODE_VERSION = '0.33.2';

/** Protocol headers Command Code rejects requests without. */
export function commandCodeHeaders(sessionId: string): Record<string, string> {
  return {
    'x-command-code-version': COMMAND_CODE_VERSION,
    'x-cli-environment': 'external',
    'x-project-slug': 'pi-cc',
    'x-taste-learning': 'false',
    'x-co-flag': 'false',
    'x-session-id': sessionId,
  };
}

type JsonRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is JsonRecord => typeof v === 'object' && v !== null && !Array.isArray(v);
const asRecordArray = (v: unknown): JsonRecord[] => (Array.isArray(v) ? v.filter(isRecord) : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const recordOrEmpty = (v: unknown): JsonRecord => {
  if (isRecord(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

function normalizeContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  return asRecordArray(content)
    .filter((p) => p.type === 'text')
    .map((p) => str(p.text) ?? '')
    .join('\n');
}

// CC-specific vision model ids, plus the general heuristic. Kept broad: treating
// a text-only model as vision-capable only risks a dropped image part, whereas
// the reverse silently discards the image on a model that could have read it.
const CC_VISION_PATTERNS: readonly RegExp[] = [
  /kimi-k2/i, /qwen3\.\d/i, /step-?3/i, /claude-fable/i, /gpt-5/i, /fugu/i,
  /minimax-m3/i, /claude-3/i, /claude-4/i, /gemini/i, /gpt-4o/i, /gpt-4\.1/i,
  /-vision/i, /multimodal/i,
];

export function isCommandCodeVisionModel(model?: string | null): boolean {
  if (!model) return false;
  if (/(?:^|\/)mimo-v2\.5-pro$/i.test(model)) return false; // text-only, exclude first
  if (/(?:^|\/)mimo-v2\.5$/i.test(model)) return true;
  if (/(?:^|\/)mimo-v2-omni$/i.test(model)) return true;
  return CC_VISION_PATTERNS.some((p) => p.test(model));
}

function extractImageUrl(part: JsonRecord): string | undefined {
  if (part.type === 'image') return str(part.image);
  if (part.type === 'image_url') {
    if (isRecord(part.image_url)) return str(part.image_url.url);
    return str(part.image_url);
  }
  return undefined;
}

function convertUserContentParts(content: unknown, isVision: boolean): string | unknown[] {
  if (!isVision || typeof content === 'string') return normalizeContentText(content);
  const parts: unknown[] = [];
  for (const part of asRecordArray(content)) {
    if (part.type === 'text') {
      const t = str(part.text);
      if (t) parts.push({ type: 'text', text: t });
      continue;
    }
    const img = extractImageUrl(part);
    if (img) parts.push({ type: 'image', image: img });
    // tool_use / tool_result / thinking parts are always dropped from user turns.
  }
  if (parts.length === 0) parts.push({ type: 'text', text: '' });
  return parts;
}

/** Ids that appear BOTH as an assistant tool_call and as a tool result. */
function completeToolCallIds(messages: JsonRecord[]): Set<string> {
  const calls = new Set<string>();
  const results = new Set<string>();
  for (const m of messages) {
    if (m.role === 'assistant') {
      for (const c of asRecordArray(m.tool_calls)) {
        const id = str(c.id);
        if (id) calls.add(id);
      }
    } else if (m.role === 'tool') {
      const id = str(m.tool_call_id);
      if (id) results.add(id);
    }
  }
  return new Set([...calls].filter((id) => results.has(id)));
}

export function convertTools(tools: unknown): unknown[] {
  return asRecordArray(tools).map((tool) => {
    const fn = isRecord(tool.function) ? tool.function : tool;
    return {
      type: 'function',
      name: str(fn.name) ?? '',
      description: str(fn.description) ?? '',
      input_schema: isRecord(fn.parameters) ? fn.parameters : {},
    };
  });
}

export function convertMessages(messages: unknown, model?: string | null): { system: string; messages: unknown[] } {
  const source = asRecordArray(messages);
  const paired = completeToolCallIds(source);
  const out: unknown[] = [];
  const system: string[] = [];
  const isVision = isCommandCodeVisionModel(model);

  for (const m of source) {
    const role = str(m.role);

    if (role === 'system' || role === 'developer') {
      const t = normalizeContentText(m.content);
      if (t) system.push(t);
      continue;
    }

    if (role === 'user') {
      out.push({ role: 'user', content: convertUserContentParts(m.content, isVision) });
      continue;
    }

    if (role === 'assistant') {
      const parts: unknown[] = [];
      const t = normalizeContentText(m.content);
      if (t) parts.push({ type: 'text', text: t });
      for (const call of asRecordArray(m.tool_calls)) {
        const id = str(call.id) ?? '';
        if (!id || !paired.has(id)) continue; // unpaired call would be rejected
        const fn = isRecord(call.function) ? call.function : {};
        parts.push({
          type: 'tool-call',
          toolCallId: id,
          toolName: str(fn.name) ?? '',
          input: recordOrEmpty(fn.arguments),
        });
      }
      if (parts.length > 0) out.push({ role: 'assistant', content: parts });
      continue;
    }

    if (role === 'tool') {
      const id = str(m.tool_call_id) ?? '';
      if (!id || !paired.has(id)) continue; // orphan result would be rejected
      out.push({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: id,
          toolName: str(m.name) ?? '',
          output: { type: 'text', value: normalizeContentText(m.content) },
        }],
      });
    }
  }

  return { system: system.join('\n\n'), messages: out };
}

/** Omit rather than default — see the header note on why a floor of 1 is wrong. */
export function clampMaxTokens(value: unknown): number | undefined {
  const n = num(value);
  if (n === undefined || n <= 0) return undefined;
  return Math.min(Math.floor(n), MAX_COMMAND_CODE_TOKENS);
}

const PASSTHROUGH_FIELDS = ['reasoning_effort', 'reasoning', 'thinking', 'effort', 'output_config', 'extra_body'] as const;

export function buildCommandCodeBody(model: string, body: unknown): JsonRecord {
  const input = isRecord(body) ? body : {};
  const resolvedModel = (str(input.model)?.trim() ? str(input.model)! : model);
  const converted = convertMessages(input.messages, resolvedModel);
  const explicitSystem = str(input.system) ?? '';
  const system = [converted.system, explicitSystem].filter(Boolean).join('\n\n');

  const params: JsonRecord = {
    model: resolvedModel,
    messages: converted.messages,
    tools: convertTools(input.tools),
    system,
    stream: true, // always — the endpoint has no non-streaming mode
  };

  const maxTokens = clampMaxTokens(input.max_tokens ?? input.max_completion_tokens);
  if (maxTokens !== undefined) params.max_tokens = maxTokens;

  for (const field of PASSTHROUGH_FIELDS) {
    const v = (input as JsonRecord)[field];
    if (v !== undefined && v !== null) params[field] = v;
  }

  // The generation request is an ENVELOPE with `params` nested inside, not the
  // params alone. config/memory/taste/skills/permissionMode are all required —
  // omitting them returns 400 "expected string, received undefined at \"memory\"".
  // These are the CLI's ambient context fields; the broker has no working
  // directory or git repo, so they are sent empty rather than fabricated.
  return {
    config: {
      workingDir: '/workspace',
      date: new Date().toISOString().slice(0, 10),
      environment: 'external',
      structure: [],
      isGitRepo: false,
      currentBranch: '',
      mainBranch: '',
      gitStatus: '',
      recentCommits: [],
    },
    memory: '',
    taste: '',
    skills: '',
    permissionMode: 'standard',
    params,
  };
}

// ── response translation ────────────────────────────────────────────────────

export function mapFinishReason(reason: unknown): 'stop' | 'length' | 'tool_calls' {
  if (reason === 'tool-calls' || reason === 'tool_calls' || reason === 'toolUse') return 'tool_calls';
  if (reason === 'length' || reason === 'max_tokens' || reason === 'max-tokens' || reason === 'max_output_tokens') {
    return 'length';
  }
  return 'stop';
}

export function parseStreamLine(line: string): unknown | undefined {
  let t = line.trim();
  if (!t || t.startsWith(':') || t.startsWith('event:')) return undefined;
  if (t.startsWith('data:')) t = t.slice(5).trim();
  if (!t || t === '[DONE]') return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined; // a partial/garbled line must not kill the stream
  }
}

export function usageFromCommandCode(usage: JsonRecord | null) {
  if (!usage) return undefined;
  const details = isRecord(usage.inputTokenDetails) ? usage.inputTokenDetails : {};
  // Cache reads are billed input, so they belong in prompt_tokens.
  const prompt = (num(usage.inputTokens) ?? 0) + (num(details.cacheReadTokens) ?? 0);
  const completion = num(usage.outputTokens) ?? 0;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

function chunk(id: string, model: string, delta: JsonRecord, finishReason: unknown = null) {
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

export interface AggregateState {
  content: string;
  reasoning: string;
  toolCalls: JsonRecord[];
  finishReason: 'stop' | 'length' | 'tool_calls';
  usage: JsonRecord | null;
}

export const newAggregate = (): AggregateState => ({
  content: '', reasoning: '', toolCalls: [], finishReason: 'stop', usage: null,
});

/** Fold one Command Code event into the aggregate. Throws on an error event. */
export function applyEvent(event: JsonRecord, state: AggregateState, newId: () => string): void {
  switch (event.type) {
    case 'text-delta':
      state.content += str(event.text) ?? '';
      break;
    case 'reasoning-delta':
      state.reasoning += str(event.text) ?? '';
      break;
    case 'tool-call':
      state.toolCalls.push({
        id: str(event.toolCallId) ?? str(event.id) ?? newId(),
        type: 'function',
        function: {
          name: str(event.toolName) ?? str(event.name) ?? '',
          arguments: JSON.stringify(recordOrEmpty(event.input ?? event.args ?? event.arguments)),
        },
      });
      break;
    case 'finish':
      state.finishReason = mapFinishReason(event.finishReason);
      state.usage = isRecord(event.totalUsage) ? event.totalUsage : null;
      break;
    case 'error': {
      const err = isRecord(event.error) ? event.error : {};
      throw new Error(str(err.message) ?? str(event.error) ?? 'Command Code stream error');
    }
  }
}

/** Command Code's event stream -> OpenAI chat.completion.chunk SSE. */
export function translateStream(
  upstream: ReadableStream<Uint8Array>,
  model: string,
  ids: { completionId: string; newToolId: () => string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const sse = (d: unknown) => encoder.encode(`data: ${JSON.stringify(d)}\n\n`);
  const reader = upstream.getReader();
  const state = newAggregate();
  const id = ids.completionId;
  let buffer = '';
  let sentRole = false;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (raw: unknown) => {
        if (!isRecord(raw) || closed) return;
        if (!sentRole) {
          sentRole = true;
          controller.enqueue(sse(chunk(id, model, { role: 'assistant' })));
        }
        switch (raw.type) {
          case 'text-delta': {
            const t = str(raw.text) ?? '';
            if (t) controller.enqueue(sse(chunk(id, model, { content: t })));
            state.content += t;
            break;
          }
          case 'reasoning-delta': {
            const t = str(raw.text) ?? '';
            if (t) {
              controller.enqueue(sse(chunk(id, model, { reasoning_content: t })));
              state.reasoning += t;
            }
            break;
          }
          case 'tool-call': {
            const index = state.toolCalls.length;
            const call = {
              id: str(raw.toolCallId) ?? str(raw.id) ?? ids.newToolId(),
              type: 'function',
              function: {
                name: str(raw.toolName) ?? str(raw.name) ?? '',
                arguments: JSON.stringify(recordOrEmpty(raw.input ?? raw.args ?? raw.arguments)),
              },
            };
            state.toolCalls.push(call);
            controller.enqueue(sse(chunk(id, model, { tool_calls: [{ index, ...call }] })));
            break;
          }
          case 'reasoning-end':
            break;
          case 'finish': {
            state.finishReason = mapFinishReason(raw.finishReason);
            controller.enqueue(sse(chunk(id, model, {}, state.finishReason)));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            closed = true;
            controller.close();
            reader.cancel().catch(() => undefined);
            break;
          }
          case 'error': {
            const err = isRecord(raw.error) ? raw.error : {};
            throw new Error(str(err.message) ?? str(raw.error) ?? 'Command Code stream error');
          }
        }
      };

      try {
        for (;;) {
          if (closed) return;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) emit(parseStreamLine(line));
        }
        if (buffer.trim()) emit(parseStreamLine(buffer));
        // A stream that ends without an explicit `finish` still has to be closed
        // as a well-formed OpenAI stream, or the caller hangs waiting for [DONE].
        if (!closed) {
          if (!sentRole) controller.enqueue(sse(chunk(id, model, { role: 'assistant' })));
          controller.enqueue(sse(chunk(id, model, {}, state.finishReason)));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* already released */
        }
      }
    },
  });
}

/** Drain Command Code's stream into a single OpenAI chat.completion. */
export async function translateToCompletion(
  upstream: ReadableStream<Uint8Array>,
  model: string,
  ids: { completionId: string; newToolId: () => string },
): Promise<JsonRecord> {
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  const state = newAggregate();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const ev = parseStreamLine(line);
        if (isRecord(ev)) applyEvent(ev, state, ids.newToolId);
      }
    }
    if (buffer.trim()) {
      const ev = parseStreamLine(buffer);
      if (isRecord(ev)) applyEvent(ev, state, ids.newToolId);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }

  const message: JsonRecord = { role: 'assistant', content: state.content };
  if (state.reasoning) message.reasoning_content = state.reasoning;
  if (state.toolCalls.length) message.tool_calls = state.toolCalls;

  const out: JsonRecord = {
    id: ids.completionId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: state.finishReason }],
  };
  const usage = usageFromCommandCode(state.usage);
  if (usage) out.usage = usage;
  return out;
}
