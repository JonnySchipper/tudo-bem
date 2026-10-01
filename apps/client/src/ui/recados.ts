/**
 * The recado UI (HOWTO Phase 8 steps 2-4): the tracker on the right (the welcome chain from Júlia, then the active recados), the journal
 * panel with today's offered / active / done recados, the Mochila and the hearts, the "recado done" card, the heart-up toast, and the
 * offer / hand-over beats NPCs open their dialogue with.
 */
import { describeStep, itemById, npcName, recadoById, type NpcId } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { icon } from '../art/ui';
import { openModal } from './modal';
import { toast } from './hud';
import { foodIcon, npcPortrait } from './pixelArt';
import { showDialogueBox } from './dialogue';
import { closeDialogue } from './panels';
import { clock } from '../gameClock';
import { greetingFor, greetingCap } from '@tudobem/shared';
import {
  advancedKeys,
  finishedRecados,
  giveOptions,
  heartUps,
  heartsView,
  heartsWith,
  journalView,
  offerFrom,
  stepStates,
  trackerEntries,
  tutorialAdvanced,
  type RecadoBoard,
  type TrackerEntry,
} from './recadoView';

const SPEAKER_ROLE: Record<string, string> = {
  carlos: 'Padeiro',
  graca: 'Padeira da noite',
  nanda: 'Loja de chapéus',
  julia: 'Guia da praça',
  prof: 'Professora de jiu-jitsu',
  tia_lu: 'Feirante',
  ze: 'Feirante',
  chico: 'Feirante',
  rosa: 'Feirante',
};

const heartsEl = (points: number | undefined, cls = 'hearts'): HTMLElement => {
  const v = heartsView(points);
  return h('span', { class: cls, title: `${v.hearts} / 10 ♥`, 'aria-label': `${v.hearts} corações` }, icon('coracao', 16), h('b', null, String(v.hearts)));
};

// ---------------------------------------------------------------- tracker

/** The tracker: a small pixel-framed card on the right under the top bar. One tap opens the journal. */
export function mountTracker(openJournal: () => void): { refresh: () => void } {
  const el = h('button', { class: 'rtrack', id: 'recado-tracker', type: 'button', 'aria-label': 'Recados: abrir o diário', title: 'Recados — abrir o diário / open the journal', onclick: openJournal });
  ui().append(el);
  let prevBoard: RecadoBoard | null = null;
  let prevTutorial: NonNullable<typeof game.profile>['tutorial'] | null = null;
  let prevBond: NonNullable<typeof game.profile>['bond'] | null = null;
  let flash = new Set<string>();
  let flashTimer = 0;

  /** The top bar wraps to one, two or three rows depending on the width: sit right under whatever it ended up being. */
  const place = () => {
    const bar = document.querySelector('.topbar')?.getBoundingClientRect();
    if (bar && bar.bottom > 0) el.style.top = `${Math.round(bar.bottom + 8)}px`;
  };
  window.addEventListener('resize', place);
  const refresh = () => {
    const p = game.profile;
    const board = game.board;
    // ✓ animation: a step (or a whole recado) just completed
    const adv = advancedKeys(prevBoard, board);
    if (tutorialAdvanced(prevTutorial, p?.tutorial)) adv.push('tutorial');
    if (adv.length) {
      flash = new Set(adv);
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => {
        flash.clear();
        refresh();
      }, 1500);
    }
    for (const d of finishedRecados(prevBoard, board)) showRecadoDone(d.id);
    for (const up of heartUps(prevBond, p?.bond)) {
      toast('reward', `♥ ${npcName(up.npc)} gosta de você! ${up.hearts} ${up.hearts === 1 ? 'coração' : 'corações'}`, `Your friendship with ${npcName(up.npc)} grew: ${up.hearts} ♥`);
    }
    prevBoard = board;
    prevTutorial = p ? { ...p.tutorial } : null;
    prevBond = p?.bond ? { ...p.bond } : p ? {} : null;

    const entries = trackerEntries(board, p);
    el.style.display = entries.length ? '' : 'none';
    place();
    el.replaceChildren(
      h('span', { class: 'rtrack-head' }, icon('recados', 16), h('b', null, 'Recados'), h('small', null, 'Errands')),
      ...entries.map((e) => entryRow(e, flash.has(e.key))),
    );
  };
  game.on('profile', refresh);
  game.on('recados', refresh);
  refresh();
  return { refresh };
}

function entryRow(e: TrackerEntry, justDone: boolean): HTMLElement {
  return h(
    'span',
    { class: `rtrack-row ${e.kind}${justDone ? ' just-done' : ''}`, 'data-recado': e.key },
    h('span', { class: 'rt-giver' }, npcPortrait(e.giver, 'neutro', 'rt-face')),
    h(
      'span',
      { class: 'rt-text' },
      h('span', { class: 'rt-title' }, e.title.pt, h('em', null, e.progress)),
      h('span', { class: 'rt-step', lang: 'pt-BR' }, e.step.pt),
    ),
    h('span', { class: 'rt-tick', 'aria-hidden': 'true' }, '✓'),
  );
}

// ---------------------------------------------------------------- done card

/** The giver says thanks: a card with their portrait, the line, and the RV + friendship reward. Not modal: the world keeps moving. */
export function showRecadoDone(id: string): void {
  const d = recadoById(id);
  if (!d) return;
  document.querySelector('.recado-done')?.remove();
  const card = h(
    'div',
    { class: 'recado-done', role: 'status', id: 'recado-done' },
    npcPortrait(d.giver, 'feliz', 'rd-face'),
    h(
      'div',
      { class: 'rd-body' },
      h('div', { class: 'rd-title' }, h('span', { class: 'rd-check' }, '✓'), d.title.pt),
      h('div', { class: 'rd-say' }, h('b', null, `${npcName(d.giver)}: `), `“${d.thanks.pt}”`, en(`“${d.thanks.en}”`, true)),
      h(
        'div',
        { class: 'rd-reward' },
        h('span', { class: 'rd-rv' }, `+${d.reward.rv} RV`),
        h('span', { class: 'rd-heart' }, icon('coracao', 16), `+${d.reward.bond}`),
        d.reward.itemId ? h('span', { class: 'rd-item' }, foodIcon(d.reward.itemId, 2), itemById(d.reward.itemId)?.name.pt ?? '') : null,
      ),
    ),
  );
  ui().append(card);
  window.setTimeout(() => card.remove(), 6500);
}

// ---------------------------------------------------------------- journal

export function openJournal(): void {
  const body = h('div', { class: 'rj-body' });
  const render = () => {
    const j = journalView(game.board, game.profile);
    const sections: (HTMLElement | null)[] = [];

    if (j.tutorial) {
      const t = j.tutorial;
      sections.push(
        h(
          'section',
          { class: 'rj-sec welcome' },
          h('h3', null, npcPortrait('julia', 'feliz', 'rj-face'), h('span', null, h('b', null, 'Bem-vindo à Vila Ipê'), h('small', null, 'Welcome to Vila Ipê · de Júlia')), h('em', null, t.entry.progress)),
          h('ol', { class: 'rj-steps' }, ...t.steps.map((s) => h('li', { class: s.done ? 'done' : '' }, h('span', { class: 'box' }, s.done ? '✓' : ''), h('span', null, s.pt, en(s.en, true))))),
        ),
      );
    }

    sections.push(
      h(
        'section',
        { class: 'rj-sec' },
        h('h3', null, 'Em andamento', h('small', null, 'In progress')),
        j.active.length
          ? h(
              'div',
              { class: 'rj-list' },
              ...j.active.map((a) => {
                const def = recadoById(a.id);
                return h(
                  'article',
                  { class: 'rj-card active', 'data-recado': a.id },
                  npcPortrait(a.giver, 'neutro', 'rj-face'),
                  h(
                    'div',
                    { class: 'rj-main' },
                    h('div', { class: 'rj-title' }, a.title.pt, h('small', null, `de ${npcName(a.giver)}`), h('em', null, `+${a.reward.rv} RV · ♥${a.reward.bond}`)),
                    en(a.title.en, true),
                    h('ul', { class: 'rj-stepl' }, ...stepStates(a, def, describeStep).map((s) => h('li', { class: s.state }, h('span', { class: 'mk' }, s.state === 'done' ? '✓' : s.state === 'now' ? '▸' : '·'), h('span', null, s.text.pt, en(s.text.en, true))))),
                  ),
                );
              }),
            )
          : h('p', { class: 'rj-empty' }, 'Nenhum recado agora. Fale com os vizinhos!', en('No errands right now. Talk to the neighbors!', true)),
      ),
    );

    sections.push(
      h(
        'section',
        { class: 'rj-sec mochila', id: 'rj-mochila' },
        h('h3', null, 'Mochila', h('small', null, 'Bag')),
        j.bag.length
          ? h('div', { class: 'rj-bag' }, ...j.bag.map((b) => h('div', { class: 'rj-item', 'data-item': b.itemId, title: `${b.name.pt} · ${b.name.en}` }, foodIcon(b.itemId, 3, b.name.pt), h('span', { class: 'qty' }, `×${b.qty}`), h('span', { class: 'nm' }, b.name.pt))))
          : h('p', { class: 'rj-empty' }, 'Vazia. Peça algo na padaria!', en('Empty. Order something at the bakery!', true)),
      ),
    );

    sections.push(
      h(
        'section',
        { class: 'rj-sec' },
        h('h3', null, 'Hoje na vila', h('small', null, 'Offered today')),
        j.offered.length
          ? h(
              'div',
              { class: 'rj-list' },
              ...j.offered.map((o) =>
                h(
                  'article',
                  { class: 'rj-card offered', 'data-recado': o.id },
                  npcPortrait(o.giver, 'neutro', 'rj-face'),
                  h('div', { class: 'rj-main' }, h('div', { class: 'rj-title' }, o.title.pt, h('small', null, `${npcName(o.giver)} · fale com ele(a) pra aceitar`), h('em', null, `+${o.reward.rv} RV · ♥${o.reward.bond}`)), en(`${o.title.en} · talk to ${npcName(o.giver)} to accept`, true)),
                ),
              ),
            )
          : h('p', { class: 'rj-empty' }, 'Sem novidades por hoje.', en('Nothing new today.', true)),
        j.done.length ? h('div', { class: 'rj-done' }, h('b', null, `✓ Feitos hoje: ${j.done.length}`), ...j.done.map((d) => h('span', { class: 'rj-chip' }, d.title.pt))) : null,
      ),
    );

    sections.push(
      h(
        'section',
        { class: 'rj-sec' },
        h('h3', null, 'Amizades', h('small', null, 'Friendships')),
        h(
          'div',
          { class: 'rj-friends' },
          ...j.friends.map((f) =>
            h(
              'div',
              { class: 'rj-friend', 'data-npc': f.npc },
              npcPortrait(f.npc, 'neutro', 'rj-face small'),
              h('div', { class: 'rj-fname' }, f.name, h('small', null, SPEAKER_ROLE[f.npc] ?? '')),
              h('div', { class: 'rj-hearts', 'aria-label': `${f.hearts.hearts} de 10 corações` }, ...Array.from({ length: 10 }, (_, i) => h('i', { class: i < f.hearts.hearts ? 'on' : i === f.hearts.hearts && f.hearts.next > 0 ? 'part' : '' }))),
            ),
          ),
        ),
        h('p', { class: 'rj-legend' }, '2 ♥ sabe seu nome · 4 ♥ assunto novo · 6 ♥ presente', en('2 ♥ knows your name · 4 ♥ a new chat topic · 6 ♥ a gift', true)),
      ),
    );

    const scroll = body.scrollTop;
    body.replaceChildren(...sections.filter((x): x is HTMLElement => !!x));
    body.scrollTop = scroll;
  };
  render();
  const offs = [game.on('profile', render), game.on('recados', render)];
  const close = openModal(
    'recados',
    h(
      'div',
      { class: 'panel recados' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, 'Recados'),
      en('Errands for the neighbors · your bag · your friends'),
      body,
      h('div', { class: 'rj-foot' }, h('button', { class: 'ghost', onclick: () => close() }, bi('Fechar', 'Close'))),
    ),
    { onClose: () => offs.forEach((f) => f()) },
  );
}

// ---------------------------------------------------------------- NPC dialogue beats

/** Recados offered in this session and turned down with "Agora não": the same NPC does not nag again until the page reloads. */
const declined = new Set<string>();

export interface PreludeHooks {
  accept: (recadoId: string) => void;
  give: (npc: NpcId, itemId: string) => void;
  /** Nothing (more) to offer or hand over: go on with the NPC's usual conversation. */
  proceed: () => void;
}

/**
 * The beats an NPC opens with before the usual talk: first "Entregar {item}" when an active recado asks for something in your bag, then
 * the NPC's `ask` with "Pode deixar!" / "Agora não". Accepting or handing over closes the box (the tracker and toasts take over); declining
 * (or having nothing to say) goes on with the normal dialogue.
 */
export function runPrelude(npc: NpcId, hooks: PreludeHooks): void {
  const give = giveOptions(game.board, game.profile?.bag, npc);
  if (give.length) return giveBeat(npc, give, hooks);
  const offer = offerFrom(game.board, npc, declined);
  if (offer) return offerBeat(npc, offer, hooks);
  hooks.proceed();
}

const common = (npc: NpcId, key: string) => ({ key, npcId: npc, speaker: npcName(npc), role: SPEAKER_ROLE[npc] ?? null, onClose: closeDialogue });

function giveBeat(npc: NpcId, options: ReturnType<typeof giveOptions>, hooks: PreludeHooks): void {
  const g = greetingCap(greetingFor(clock.minutes()));
  const chips = [
    ...options.map((o) => ({ pt: `Entregar ${o.name.pt}`, en: `Hand over ${o.name.en}` })),
    { pt: 'Só conversar', en: 'Just chat' },
  ];
  showDialogueBox({
    ...common(npc, `give-${npc}`),
    expression: 'neutro',
    line: { pt: `${g}! Trouxe algo pra mim?`, en: `${greetingEn(g)}! Did you bring me something?` },
    extras: h('div', { class: 'prelude-items' }, ...options.map((o) => h('span', { class: 'prelude-item' }, foodIcon(o.itemId, 3, o.name.pt), `×${o.qty}`))),
    chips,
    onChip: (i) => {
      const o = options[i];
      if (!o) return hooks.proceed();
      closeDialogue();
      hooks.give(npc, o.itemId);
    },
  });
}

const greetingEn = (g: string) => (g === 'Bom dia' ? 'Good morning' : g === 'Boa tarde' ? 'Good afternoon' : 'Good evening');

function offerBeat(npc: NpcId, offer: NonNullable<ReturnType<typeof offerFrom>>, hooks: PreludeHooks): void {
  showDialogueBox({
    ...common(npc, `offer-${npc}`),
    expression: 'neutro',
    line: { pt: offer.ask.pt, en: offer.ask.en },
    notes: [h('small', { class: 'dbx-meta offer-title' }, `Recado: ${offer.title.pt}`)],
    extras: h('div', { class: 'offer-reward' }, h('span', { class: 'rd-rv' }, `+${offer.reward.rv} RV`), h('span', { class: 'rd-heart' }, icon('coracao', 16), `+${offer.reward.bond}`), offer.reward.itemId ? h('span', { class: 'rd-item' }, foodIcon(offer.reward.itemId, 2), itemById(offer.reward.itemId)?.name.pt ?? '') : null),
    chips: [
      { pt: 'Pode deixar!', en: 'You got it!' },
      { pt: 'Agora não', en: 'Not now' },
    ],
    onChip: (i) => {
      if (i === 0) {
        closeDialogue();
        hooks.accept(offer.id);
      } else {
        declined.add(offer.id);
        // another offer from the same NPC, or on with the usual talk
        runPrelude(npc, hooks);
      }
    },
  });
}

export { heartsEl, heartsWith };
