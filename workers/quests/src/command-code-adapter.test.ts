import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommandCodeBody,
  clampMaxTokens,
  convertMessages,
  convertTools,
  isCommandCodeVisionModel,
  mapFinishReason,
  parseStreamLine,
  translateStream,
  translateToCompletion,
  usageFromCommandCode,
} from './command-code-adapter.ts';

const ids = { completionId: 'chatcmpl-test', newToolId: () => 'tool-generated' };

function ccStream(events: unknown[], { trailingNoNewline = false } = {}): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      events.forEach((e, i) => {
        const last = i === events.length - 1;
        c.enqueue(enc.encode(`data: ${JSON.stringify(e)}${last && trailingNoNewline ? '' : '\n'}`));
      });
      c.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const r = stream.getReader();
  const dec = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out;
}

const chunks = (sse: string) =>
  sse.split('\n\n').filter((l) => l.startsWith('data: ') && !l.includes('[DONE]')).map((l) => JSON.parse(l.slice(6)));

// ── request translation ─────────────────────────────────────────────────────

test('command-code · request is an ENVELOPE with params nested, not bare params', () => {
  // Omitting the envelope returns 400 "expected string, received undefined at
  // \"memory\"" — the failure that the unit tests alone did not catch.
  const env = buildCommandCodeBody('m', { messages: [{ role: 'user', content: 'hi' }] }) as any;
  assert.deepEqual(Object.keys(env).sort(), ['config', 'memory', 'params', 'permissionMode', 'skills', 'taste']);
  assert.equal(env.memory, '');
  assert.equal(env.taste, '');
  assert.equal(env.skills, '');
  assert.equal(env.permissionMode, 'standard');
  assert.equal(env.config.environment, 'external');
  assert.equal(env.config.isGitRepo, false);
  assert.match(env.config.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(env.params, 'the generation params belong under params');
});

test('command-code · hoists system messages out of the message list', () => {
  const body = (buildCommandCodeBody('m', {
    messages: [
      { role: 'system', content: 'be terse' },
      { role: 'developer', content: 'and precise' },
      { role: 'user', content: 'hi' },
    ],
  }) as any).params;
  assert.equal(body.system, 'be terse\n\nand precise');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'hi' }]);
});

test('command-code · always forces stream:true even when the caller did not ask', () => {
  // The endpoint has no non-streaming mode; a non-streaming caller is served by
  // draining the stream on our side, not by asking Command Code not to stream.
  assert.equal((buildCommandCodeBody('m', { messages: [], stream: false }) as any).params.stream, true);
});

test('command-code · omits max_tokens rather than defaulting it', () => {
  // Upstream regression #5166: a floor of 1 truncated output to a single token.
  assert.equal(clampMaxTokens(undefined), undefined);
  assert.equal(clampMaxTokens(-1), undefined);
  assert.equal(clampMaxTokens(0), undefined);
  assert.equal(clampMaxTokens(10.7), 10);
  assert.equal(clampMaxTokens(999_999), 200_000);
  assert.equal('max_tokens' in (buildCommandCodeBody('m', { messages: [], max_tokens: -1 }) as any).params, false);
  assert.equal((buildCommandCodeBody('m', { messages: [], max_completion_tokens: 64 }) as any).params.max_tokens, 64);
});

test('command-code · drops tool calls and results that are not paired', () => {
  // Command Code rejects a call without its result, and vice versa.
  const { messages } = convertMessages([
    { role: 'assistant', content: '', tool_calls: [
      { id: 'paired', function: { name: 'f', arguments: '{"a":1}' } },
      { id: 'orphan', function: { name: 'g', arguments: '{}' } },
    ] },
    { role: 'tool', tool_call_id: 'paired', name: 'f', content: 'ok' },
    { role: 'tool', tool_call_id: 'never-called', content: 'stray' },
  ]);
  const assistant = messages[0] as { content: Array<{ type: string; toolCallId?: string }> };
  assert.deepEqual(assistant.content.map((p) => p.toolCallId), ['paired']);
  assert.equal(messages.length, 2);
  const toolMsg = messages[1] as { content: Array<{ toolCallId: string }> };
  assert.equal(toolMsg.content[0].toolCallId, 'paired');
});

test('command-code · parses stringified tool arguments into an object', () => {
  const { messages } = convertMessages([
    { role: 'assistant', tool_calls: [{ id: 'x', function: { name: 'f', arguments: '{"k":"v"}' } }] },
    { role: 'tool', tool_call_id: 'x', content: 'done' },
  ]);
  const a = messages[0] as { content: Array<{ input: Record<string, unknown> }> };
  assert.deepEqual(a.content[0].input, { k: 'v' });
});

test('command-code · tools become input_schema entries', () => {
  assert.deepEqual(
    convertTools([{ type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object' } } }]),
    [{ type: 'function', name: 'f', description: 'd', input_schema: { type: 'object' } }],
  );
});

test('command-code · images survive only for vision models, never empty content', () => {
  assert.equal(isCommandCodeVisionModel('moonshotai/Kimi-K2.6'), true);
  assert.equal(isCommandCodeVisionModel('mimo-v2.5-pro'), false); // text-only, excluded first
  const withImage = [{ type: 'image_url', image_url: { url: 'https://x/y.png' } }];

  const vision = convertMessages([{ role: 'user', content: withImage }], 'moonshotai/Kimi-K2.6');
  assert.deepEqual((vision.messages[0] as { content: unknown }).content, [{ type: 'image', image: 'https://x/y.png' }]);

  // Non-vision: image dropped, and the result must not be empty — CC rejects that.
  const text = convertMessages([{ role: 'user', content: withImage }], 'mimo-v2.5-pro');
  assert.equal((text.messages[0] as { content: unknown }).content, '');
});

test('command-code · strips a command-code/ model prefix a router may add', () => {
  // The broker strips it before calling this, but the body must carry the bare id.
  assert.equal((buildCommandCodeBody('deepseek/deepseek-v4-flash', { messages: [] }) as any).params.model, 'deepseek/deepseek-v4-flash');
});

// ── response translation ────────────────────────────────────────────────────

test('command-code · finish reasons map to OpenAI vocabulary', () => {
  assert.equal(mapFinishReason('tool-calls'), 'tool_calls');
  assert.equal(mapFinishReason('max_output_tokens'), 'length');
  assert.equal(mapFinishReason('anything-else'), 'stop');
});

test('command-code · stream lines ignore comments, events and garbage', () => {
  assert.equal(parseStreamLine(': keepalive'), undefined);
  assert.equal(parseStreamLine('event: ping'), undefined);
  assert.equal(parseStreamLine('data: [DONE]'), undefined);
  assert.equal(parseStreamLine('data: {not json'), undefined); // must not kill the stream
  assert.deepEqual(parseStreamLine('data: {"type":"x"}'), { type: 'x' });
});

test('command-code · event stream becomes OpenAI chunks ending in [DONE]', async () => {
  const sse = await collect(translateStream(ccStream([
    { type: 'text-delta', text: 'Hel' },
    { type: 'text-delta', text: 'lo' },
    { type: 'finish', finishReason: 'stop' },
  ]), 'm', ids));

  const cs = chunks(sse);
  assert.deepEqual(cs[0].choices[0].delta, { role: 'assistant' }); // role first
  assert.deepEqual(cs.slice(1, 3).map((c) => c.choices[0].delta.content), ['Hel', 'lo']);
  assert.equal(cs.at(-1).choices[0].finish_reason, 'stop');
  assert.ok(sse.trimEnd().endsWith('data: [DONE]'));
});

test('command-code · reasoning deltas surface as reasoning_content', async () => {
  const sse = await collect(translateStream(ccStream([
    { type: 'reasoning-delta', text: 'thinking' },
    { type: 'reasoning-end' },
    { type: 'text-delta', text: 'answer' },
    { type: 'finish', finishReason: 'stop' },
  ]), 'm', ids));
  const cs = chunks(sse);
  assert.equal(cs.find((c) => c.choices[0].delta.reasoning_content)?.choices[0].delta.reasoning_content, 'thinking');
  assert.equal(cs.find((c) => c.choices[0].delta.content)?.choices[0].delta.content, 'answer');
});

test('command-code · tool calls are emitted with an index', async () => {
  const sse = await collect(translateStream(ccStream([
    { type: 'tool-call', toolCallId: 't1', toolName: 'f', input: { a: 1 } },
    { type: 'tool-call', toolCallId: 't2', toolName: 'g', input: {} },
    { type: 'finish', finishReason: 'tool-calls' },
  ]), 'm', ids));
  const calls = chunks(sse).flatMap((c) => c.choices[0].delta.tool_calls ?? []);
  assert.deepEqual(calls.map((t: { index: number; id: string }) => [t.index, t.id]), [[0, 't1'], [1, 't2']]);
  assert.equal(JSON.parse(calls[0].function.arguments).a, 1);
  assert.equal(chunks(sse).at(-1).choices[0].finish_reason, 'tool_calls');
});

test('command-code · a stream that ends without finish is still closed properly', async () => {
  // Otherwise the caller hangs forever waiting for [DONE].
  const sse = await collect(translateStream(ccStream([{ type: 'text-delta', text: 'partial' }]), 'm', ids));
  assert.ok(sse.includes('data: [DONE]'));
  assert.equal(chunks(sse).at(-1).choices[0].finish_reason, 'stop');
});

test('command-code · a final line with no trailing newline is not lost', async () => {
  const sse = await collect(translateStream(
    ccStream([{ type: 'text-delta', text: 'tail' }, { type: 'finish', finishReason: 'stop' }], { trailingNoNewline: true }),
    'm', ids,
  ));
  assert.ok(sse.includes('"content":"tail"'));
});

test('command-code · non-streaming callers get one folded completion', async () => {
  const out = await translateToCompletion(ccStream([
    { type: 'reasoning-delta', text: 'because' },
    { type: 'text-delta', text: 'Hello ' },
    { type: 'text-delta', text: 'world' },
    { type: 'tool-call', toolCallId: 't1', toolName: 'f', input: { x: 2 } },
    { type: 'finish', finishReason: 'stop', totalUsage: { inputTokens: 10, outputTokens: 5, inputTokenDetails: { cacheReadTokens: 3 } } },
  ]), 'm', ids) as any;

  assert.equal(out.object, 'chat.completion');
  assert.equal(out.choices[0].message.content, 'Hello world');
  assert.equal(out.choices[0].message.reasoning_content, 'because');
  assert.equal(out.choices[0].message.tool_calls[0].id, 't1');
  assert.equal(out.choices[0].finish_reason, 'stop');
  // Cache reads are billed input, so they belong in prompt_tokens.
  assert.deepEqual(out.usage, { prompt_tokens: 13, completion_tokens: 5, total_tokens: 18 });
});

test('command-code · an error event rejects rather than returning a silent empty answer', async () => {
  await assert.rejects(
    () => translateToCompletion(ccStream([
      { type: 'text-delta', text: 'partial' },
      { type: 'error', error: { message: 'upstream exploded' } },
    ]), 'm', ids),
    /upstream exploded/,
  );
});

test('command-code · usage mapping tolerates a missing usage block', () => {
  assert.equal(usageFromCommandCode(null), undefined);
});
