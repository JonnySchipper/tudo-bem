import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONVERSA_SUBJECTS, MEMORY_MAX_CHARS } from '@tudobem/shared';
import { ConversaMemory, type SummaryInput } from './conversaMemory.js';
import { endBody, listen, startBody, turnBody, worldWithPlayer, type Api } from './conversaTestKit.js';

// No XAI key in this file: the HTTP flow runs the authored path and memory uses the template.
const PLAYER_LINE = 'Me vê um pão na chapa e uma coxinha, por favor. Meu segredo é abacaxi roxo.';

function setup(aiSummary?: ConstructorParameters<typeof ConversaMemory>[0]['aiSummary'], timeoutMs = 50) {
  return worldWithPlayer().then(({ store, id }) => {
    const memory = new ConversaMemory({ store, aiSummary, timeoutMs });
    return { store, id, memory, p: store.get(id)! };
  });
}

const say = (m: ConversaMemory, id: string, ...lines: [who: 'npc' | 'player', pt: string][]) => {
  for (const [who, pt] of lines) m.record(id, 'carlos', 'cafe_da_manha', who, pt);
};

describe('ConversaMemory (unit)', () => {
  it('stores the template line when there is no AI, and only card names, never the raw chat', async () => {
    const { memory, id, p } = await setup();
    say(memory, id, ['npc', 'Bom dia! O que vai ser hoje?'], ['player', PLAYER_LINE], ['npc', 'Pois não!']);
    await memory.end(id, 'carlos');
    expect(p.npcMemory?.carlos).toBe('Pediu um pão na chapa e uma coxinha.');
    expect(JSON.stringify(p)).not.toMatch(/segredo|abacaxi/i);
    expect(memory.get(id, 'carlos')).toBe('Pediu um pão na chapa e uma coxinha.');
    expect(p.npcMemory!.carlos!.length).toBeLessThanOrEqual(MEMORY_MAX_CHARS);
  });

  it('falls back to the subject name when nothing edible was named', async () => {
    const { memory, id, p } = await setup();
    say(memory, id, ['npc', 'Oi, beleza?'], ['player', 'Bom dia, tudo bem?']);
    await memory.end(id, 'carlos');
    expect(p.npcMemory?.carlos).toBe('Conversou sobre café da manhã.');
  });

  it('uses the subject of the Conversa that was played', async () => {
    const { memory, id, p } = await setup();
    memory.record(id, 'carlos', 'cumprimentos', 'player', 'Bom dia!');
    await memory.end(id, 'carlos');
    expect(p.npcMemory?.carlos).toBe('Conversou sobre cumprimentos.');
  });

  it('stores nothing when the player never spoke, when the log is gone, or for an unknown player', async () => {
    const { memory, id, p } = await setup();
    say(memory, id, ['npc', 'Bom dia!']);
    await memory.end(id, 'carlos');
    await memory.end(id, 'carlos'); // log already consumed
    await memory.end('nobody', 'carlos');
    expect(p.npcMemory).toEqual({});
  });

  it('a good AI summary replaces the template', async () => {
    let seen: SummaryInput | undefined;
    const { memory, id, p } = await setup(async (input) => ((seen = input), 'Pediu um pão na chapa e um suco de laranja pra viagem.'));
    say(memory, id, ['npc', 'Bom dia!'], ['player', PLAYER_LINE]);
    await memory.end(id, 'carlos');
    expect(p.npcMemory?.carlos).toBe('Pediu um pão na chapa e um suco de laranja pra viagem.');
    expect(seen).toMatchObject({ npc: 'carlos', npcName: 'Seu Carlos', subjectTitle: CONVERSA_SUBJECTS.cafe_da_manha.title.pt });
    expect(seen!.lines.map((l) => l.who)).toEqual(['npc', 'player']);
  });

  it('an unsafe AI summary is rejected and the template stays', async () => {
    for (const bad of ['Pediu uma cerveja gelada.', 'Ligar para 11 98765-4321 depois.', 'a'.repeat(400), '', 'Ela disse que o segredo dela é abacaxi roxo mesmo.']) {
      const { memory, id, p } = await setup(async () => bad);
      say(memory, id, ['player', PLAYER_LINE.replace('Meu segredo é abacaxi roxo.', 'O segredo dela é abacaxi roxo mesmo, sabe?')]);
      await memory.end(id, 'carlos');
      expect(p.npcMemory?.carlos, bad.slice(0, 20)).toBe('Pediu um pão na chapa e uma coxinha.');
    }
  });

  it('never blocks on the model: a hang times out, a throw is swallowed, and the template stays', async () => {
    const hang = await setup(() => new Promise<string | null>(() => {}), 30);
    say(hang.memory, hang.id, ['player', 'Um café com leite, por favor.']);
    const t0 = Date.now();
    await hang.memory.end(hang.id, 'carlos');
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(hang.p.npcMemory?.carlos).toBe('Pediu um café com leite.');

    const boom = await setup(async () => {
      throw new Error('xai down');
    });
    say(boom.memory, boom.id, ['player', 'Um café com leite, por favor.']);
    await expect(boom.memory.end(boom.id, 'carlos')).resolves.toBeUndefined();
    expect(boom.p.npcMemory?.carlos).toBe('Pediu um café com leite.');
  });

  it('the template is in place before the model answers (end() does not wait for it)', async () => {
    let release: (v: string) => void = () => {};
    const { memory, id, p } = await setup(() => new Promise<string>((r) => (release = r)), 5000);
    say(memory, id, ['player', 'Uma coxinha, por favor.']);
    const done = memory.end(id, 'carlos');
    expect(p.npcMemory?.carlos).toBe('Pediu uma coxinha.'); // synchronously
    release('Pediu uma coxinha e uma água.');
    await done;
    expect(p.npcMemory?.carlos).toBe('Pediu uma coxinha e uma água.');
  });

  it('a slow AI answer from an older Conversa cannot overwrite a newer one', async () => {
    let releaseOld: (v: string) => void = () => {};
    let call = 0;
    const { memory, id, p } = await setup(() => (++call === 1 ? new Promise<string>((r) => (releaseOld = r)) : Promise.resolve(null)), 5000);
    say(memory, id, ['player', 'Uma coxinha, por favor.']);
    const first = memory.end(id, 'carlos');
    say(memory, id, ['player', 'Um pastel, por favor.']);
    await memory.end(id, 'carlos');
    expect(p.npcMemory?.carlos).toBe('Pediu um pastel.');
    releaseOld('Pediu uma coxinha e uma água.');
    await first;
    expect(p.npcMemory?.carlos).toBe('Pediu um pastel.');
  });

  it('keeps its logs bounded', async () => {
    const { memory } = await setup();
    for (let i = 0; i < 500; i++) memory.record(`p${i}`, 'carlos', 'cafe_da_manha', 'player', 'oi');
    expect((memory as unknown as { logs: Map<string, unknown> }).logs.size).toBeLessThanOrEqual(200);
    for (let i = 0; i < 50; i++) memory.record('p0', 'carlos', 'cafe_da_manha', 'player', `linha ${i}`);
    expect([...(memory as unknown as { logs: Map<string, { lines: unknown[] }> }).logs.values()].every((l) => l.lines.length <= 14)).toBe(true);
  });
});

describe('Conversa HTTP flow with memory and Caderno (offline, no key)', () => {
  let api: Api | null = null;
  afterEach(async () => {
    await api?.close();
    api = null;
  });

  it('start, turns and end store the memory through the template and feed the Caderno', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in unit test'));
    try {
      const { world, store, id } = await worldWithPlayer();
      const memory = new ConversaMemory({ store });
      api = await listen({
        store,
        memory,
        onProfileChanged: (pid) => world.pushProfileById(pid),
        onConversaEnd: (pid, npc, grade, order) => world.conversaEnded(pid, npc, grade, order),
        onConversaLine: (pid, who, pt) => world.conversaLine(pid, who, pt),
      });
      const p = store.get(id)!;
      expect(p.npcMemory).toEqual({});

      const start = await api.post(startBody(id));
      expect(start.body.phase).toBe('open');
      const opener = (start.body.line as { pt: string }).pt;
      expect(Object.values(p.caderno!).some((e) => e.seen > 0)).toBe(opener.length > 0 && Object.keys(p.caderno!).length > 0);

      const turn1 = await api.post(turnBody(id, 'Bom dia, Seu Carlos! Um pão na chapa, por favor.', 1));
      expect(turn1.body.phase).toBe('turn');
      // the player's line counts as used (gate passed), including 'pão na chapa' and 'por favor'
      expect(p.caderno!['lex.social.bom_dia']!.used).toBe(1);
      expect(p.caderno!['lex.padaria.pao_na_chapa']!.used).toBe(1);
      expect(p.caderno!['lex.padaria.por_favor']!.used).toBe(1);
      // a blocked line (Gate A) counts for nothing and is not remembered
      const usedBefore = JSON.stringify(p.caderno);
      const blocked = await api.post(turnBody(id, 'bora tomar uma cerveja obrigado', 2));
      expect(blocked.body.phase).toBe('blocked');
      expect(JSON.stringify(p.caderno)).toBe(usedBefore);
      await api.post(turnBody(id, 'E uma água, por favor. Meu apelido secreto é Zeca Trovão.', 3));

      // Nothing yet: the Conversa is still running.
      expect(p.npcMemory).toEqual({});
      const end = await api.post(endBody(id));
      expect(end.body.phase).toBe('end');
      expect(p.npcMemory?.carlos).toBe('Pediu um pão na chapa e uma água.');
      expect(store.get(id)!.npcMemory?.carlos).toBe('Pediu um pão na chapa e uma água.');
      expect(JSON.stringify(p)).not.toMatch(/Zeca|Trov|apelido|cerveja/i);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('a second end without new lines does not invent or clear a memory', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in unit test'));
    try {
      const { store, id } = await worldWithPlayer();
      api = await listen({ store, memory: new ConversaMemory({ store }) });
      await api.post(startBody(id));
      await api.post(turnBody(id, 'Uma coxinha, por favor.', 1));
      await api.post(endBody(id));
      expect(store.get(id)!.npcMemory?.carlos).toBe('Pediu uma coxinha.');
      await api.post(endBody(id));
      expect(store.get(id)!.npcMemory?.carlos).toBe('Pediu uma coxinha.');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('works unchanged when no memory or Caderno hooks are wired (existing callers)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in unit test'));
    try {
      const { store, id } = await worldWithPlayer();
      api = await listen({ store });
      expect((await api.post(startBody(id))).body.phase).toBe('open');
      expect((await api.post(turnBody(id, 'Oi', 1))).body.phase).toBe('turn');
      expect((await api.post(endBody(id))).body.phase).toBe('end');
      expect(store.get(id)!.npcMemory).toEqual({});
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
