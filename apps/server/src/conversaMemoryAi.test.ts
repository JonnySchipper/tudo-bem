import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConversaMemory } from './conversaMemory.js';
import { MEMORY_SUMMARY_SYSTEM_PROMPT } from './services/xai.js';
import { endBody, listen, startBody, turnBody, worldWithPlayer, type Api } from './conversaTestKit.js';

// This file runs with an xAI key so the AI path is on; every network call is mocked. (The key is cached on first
// use, which is why the offline tests live in conversaMemory.test.ts.)
beforeAll(() => {
  process.env.XAI_API_KEY = 'test-key';
});

interface XaiCall {
  system: string;
  messages: { role: string; content: string }[];
}

/** Mock the xAI endpoint: turns get a fixed Carlos reply, the summary call gets `summary`. */
function mockXai(summary: string | (() => Promise<string>)) {
  const calls: XaiCall[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(String((init as RequestInit).body)) as { messages: { role: string; content: string }[] };
    calls.push({ system: body.messages[0]!.content, messages: body.messages });
    const isSummary = body.messages[0]!.content === MEMORY_SUMMARY_SYSTEM_PROMPT;
    const content = isSummary
      ? typeof summary === 'string'
        ? summary
        : await summary()
      : JSON.stringify({ response: 'Pois não! Mais alguma coisa?', chips: ['Só isso, obrigado.', 'Uma água, por favor.'], scores: { portuguese: 3, grammar: 3, conversation: 3 }, tip: null, end: false });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { calls, spy, summaryCalls: () => calls.filter((c) => c.system === MEMORY_SUMMARY_SYSTEM_PROMPT) };
}

describe('NPC memory with AI on (mocked xAI)', () => {
  let api: Api | null = null;
  afterEach(async () => {
    vi.restoreAllMocks();
    await api?.close();
    api = null;
  });

  async function play(store: Awaited<ReturnType<typeof worldWithPlayer>>['store'], id: string, memory: ConversaMemory, line: string) {
    api = await listen({ store, memory });
    await api.post(startBody(id));
    await api.post(turnBody(id, line, 1));
    await api.post(endBody(id));
  }

  it('the AI summary is asked for once, with the summary prompt, and lands after the template', async () => {
    const xai = mockXai('Pediu um café com leite e uma coxinha pra viagem.');
    const { store, id } = await worldWithPlayer();
    const memory = new ConversaMemory({ store });
    await play(store, id, memory, 'Me vê um café com leite e uma coxinha, por favor. Meu apelido é Zeca Trovão.');
    // end() answered without waiting; give the mocked call a tick to land
    await vi.waitFor(() => expect(store.get(id)!.npcMemory?.carlos).toBe('Pediu um café com leite e uma coxinha pra viagem.'));
    expect(xai.summaryCalls()).toHaveLength(1);
    const call = xai.summaryCalls()[0]!;
    expect(call.messages[0]).toEqual({ role: 'system', content: MEMORY_SUMMARY_SYSTEM_PROMPT });
    expect(call.messages[1]!.content).toContain('Assunto: Café da manhã');
    expect(call.messages[1]!.content).toContain('Cliente: Me vê um café com leite');
    expect(JSON.stringify(store.get(id))).not.toMatch(/Zeca|Trov/);
  });

  it('an unsafe AI summary is not stored; the template stays', async () => {
    mockXai('Pediu uma cerveja e um pastel.');
    const { store, id } = await worldWithPlayer();
    const memory = new ConversaMemory({ store });
    await play(store, id, memory, 'Um pastel, por favor.');
    await new Promise((r) => setTimeout(r, 30));
    expect(store.get(id)!.npcMemory?.carlos).toBe('Pediu um pastel.');
  });

  it('a summary call that hangs past the timeout never blocks the end and keeps the template', async () => {
    mockXai(() => new Promise<string>(() => {}));
    const { store, id } = await worldWithPlayer();
    const memory = new ConversaMemory({ store, timeoutMs: 40 });
    api = await listen({ store, memory });
    await api.post(startBody(id));
    await api.post(turnBody(id, 'Uma água, por favor.', 1));
    const t0 = Date.now();
    const end = await api.post(endBody(id));
    expect(end.body.phase).toBe('end');
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(store.get(id)!.npcMemory?.carlos).toBe('Pediu uma água.');
  });

  it('the stored memory reaches the next Conversa’s system prompt, and only that NPC/player’s', async () => {
    const xai = mockXai('Pediu um café com leite.');
    const a = await worldWithPlayer();
    const memory = new ConversaMemory({ store: a.store });
    await play(a.store, a.id, memory, 'Um café com leite, por favor.');
    await vi.waitFor(() => expect(a.store.get(a.id)!.npcMemory?.carlos).toBe('Pediu um café com leite.'));

    // First turn of the FIRST Conversa had no memory yet.
    const turnPrompts = () => xai.calls.filter((c) => c.system !== MEMORY_SUMMARY_SYSTEM_PROMPT).map((c) => c.system);
    expect(turnPrompts()).toHaveLength(1);
    expect(turnPrompts()[0]).not.toContain('Você lembra');

    // The next Conversa's turn carries it.
    await api!.post(startBody(a.id));
    await api!.post(turnBody(a.id, 'Bom dia!', 1));
    const prompts = turnPrompts();
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('Você lembra: Pediu um café com leite.');
    expect(prompts[1]!.indexOf('Você lembra')).toBeLessThan(prompts[1]!.indexOf('SUBJECT:'));

    // Another player has none.
    const b = await worldWithPlayer(a.store);
    expect(b.id).not.toBe(a.id);
    await api!.post(turnBody(b.id, 'Bom dia!', 1));
    expect(turnPrompts()[2]).not.toContain('Você lembra');
  });
});
