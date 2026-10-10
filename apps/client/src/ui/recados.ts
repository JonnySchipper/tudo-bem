/**
 * The recado UI (HOWTO Phase 8 steps 2-4): the tracker on the right (the welcome chain from Júlia, then the active recados), the journal
 * panel with today's offered / active / done recados, the Mochila and the hearts, the "recado done" card (it carries the heart change),
 * and the offer / hand-over beats NPCs open their dialogue with.
 */
import { describeStep, itemById, itemWithArticle, npcName, recadoById, type NpcId } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { icon } from '../art/ui';
import { openModal } from './modal';
import { ambience } from '../ambience';
import { COMPACT_QUERY, placeHud } from './hudLayout';
import { foodIcon, npcPortrait } from './pixelArt';
import { showDialogueBox } from './dialogue';
import { MAX_CONTENT_CHIPS } from './dialogueLogic';
import { closeDialogue } from './panels';
import { clock } from '../gameClock';
import { profileMetJulia } from './juliaMet';
import { stage } from './disclosure';
import { greetingFor, greetingCap, RECADO_DAY_BONUS_RV, RECADO_MAX_ACTIVE } from '@tudobem/shared';
import {
  activeWhere,
  advancedKeys,
  dayProgress,
  dayStarsShown,
  declinedOffers,
  finishedRecados,
  giverWhere,
  giveOptions,
  heartUps,
  heartsView,
  heartsWith,
  journalSections,
  journalView,
  offerFrom,
  stepStates,
  trackerEntries,
  tutorialAdvanced,
  type DayProgress,
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

const SPEAKER_ROLE_EN: Record<string, string> = {
  carlos: 'Baker',
  graca: 'Night baker',
  nanda: 'Hat shop',
  julia: 'Plaza guide',
  prof: 'Jiu-jitsu teacher',
  tia_lu: 'Market vendor',
  ze: 'Market vendor',
  chico: 'Market vendor',
  rosa: 'Market vendor',
};

/** What the journal's buttons send (main.ts binds the socket). */
let actions: { accept: (id: string) => void; drop: (id: string) => void } = { accept: () => undefined, drop: () => undefined };
export function bindRecadoActions(a: typeof actions): void {
  actions = a;
}

/** "★★☆": the day's three recados toward the Vizinho do dia bonus; earned stars gold, the rest an empty outline. */
const starEls = (d: DayProgress): HTMLElement[] => Array.from({ length: d.goal }, (_, i) => h('i', { class: i < d.done ? 'on' : '' }, i < d.done ? '★' : '☆'));

const heartsEl = (points: number | undefined, cls = 'hearts'): HTMLElement => {
  const v = heartsView(points);
  return h('span', { class: cls, title: `${v.hearts} / 10 ♥`, 'aria-label': `${v.hearts} corações (${v.hearts} hearts)` }, icon('coracao', 16), h('b', null, String(v.hearts)));
};

// ---------------------------------------------------------------- tracker

/**
 * The tracker: a small pixel-framed card under the top bar (right on a desktop, left on a phone). The head folds it away; a tap on a row opens
 * the journal. Desktop starts open, a phone starts as a one-line pill that opens by itself for a few seconds when a step moves.
 */
export function mountTracker(openJournal: () => void): { refresh: () => void } {
  const head = h('button', { class: 'rtrack-head', type: 'button', 'aria-expanded': 'true', title: 'Favores — mostrar ou esconder / show or hide' });
  const rows = h('div', { class: 'rtrack-rows' });
  const el = h('div', { class: 'rtrack', id: 'recado-tracker', role: 'region', 'aria-label': 'Favores' }, head, rows);
  ui().append(el);
  let prevBoard: RecadoBoard | null = null;
  let prevTutorial: NonNullable<typeof game.profile>['tutorial'] | null = null;
  let prevBond: NonNullable<typeof game.profile>['bond'] | null = null;
  let flash = new Set<string>();
  let flashTimer = 0;
  let peekTimer = 0;
  let peeking = false;
  let offersPeeked = false;
  const compact = () => window.matchMedia(COMPACT_QUERY).matches;
  const stored = (): boolean | null => {
    try {
      const v = localStorage.getItem('tb_tracker');
      return v === 'open' ? true : v === 'closed' ? false : null;
    } catch {
      return null;
    }
  };
  let manual: boolean | null = stored();
  const isOpen = () => peeking || (manual ?? !compact());
  const applyOpen = () => {
    const open = isOpen();
    el.classList.toggle('collapsed', !open);
    head.setAttribute('aria-expanded', String(open));
    placeHud();
  };
  head.addEventListener('click', () => {
    manual = !isOpen();
    peeking = false;
    try {
      localStorage.setItem('tb_tracker', manual ? 'open' : 'closed');
    } catch {
      /* private mode */
    }
    applyOpen();
  });
  window.matchMedia(COMPACT_QUERY).addEventListener('change', applyOpen);
  const peek = () => {
    if (isOpen() || !compact()) return;
    peeking = true;
    applyOpen();
    window.clearTimeout(peekTimer);
    peekTimer = window.setTimeout(() => {
      peeking = false;
      applyOpen();
    }, 5200);
  };

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
      peek();
    }
    const entries = trackerEntries(board, p, clock.minutes(), profileMetJulia());
    const offers = entries.filter((e) => e.kind === 'offer').length;
    // a phone keeps the tracker folded: open it for a few seconds when an errand is taken, and once when today's offers first show up
    const taken = prevBoard && board ? board.active.some((a) => !prevBoard!.active.some((b) => b.id === a.id)) : false;
    if (taken || (!offersPeeked && offers)) {
      offersPeeked = true;
      peek();
    }
    // the third errand of the day also pays Vizinho do dia: the same card says so (the server's notice for it is not toasted)
    const bonusNow = !!(prevBoard && board?.bonus && !prevBoard.bonus);
    const finished = finishedRecados(prevBoard, board);
    for (const d of finished) {
      showRecadoDone(d.id, bonusNow);
      ambience.sting('recado');
    }
    // the done card shows the heart change; a heart earned some other way (a talk, a bate-papo) gets its sting, and the hearts in the
    // dialogue header and the panel show the count
    if (!finished.length && heartUps(prevBond, p?.bond).length) ambience.sting('heart');
    prevBoard = board;
    prevTutorial = p ? { ...p.tutorial } : null;
    prevBond = p?.bond ? { ...p.bond } : p ? {} : null;

    el.style.display = entries.length ? '' : 'none';
    const day = dayProgress(board);
    el.classList.toggle('has-offer', offers > 0);
    head.replaceChildren(
      icon('recados', 16),
      h('b', null, 'Favores'),
      // collapsed on a phone the head is all there is: a gold "!" says a neighbour is waiting
      ...(offers ? [h('span', { class: 'rtrack-bang', title: 'Novo favor · New favor', 'aria-label': `${offers} favores novos (new favors)` }, '!')] : []),
      // ★★☆ Vizinho do dia: a regular's, once a recado is done today
      ...(p && dayStarsShown(stage(p), board) ? [h('small', { class: `rtrack-stars${day.paid ? ' paid' : ''}`, title: `Vizinho do dia: ${day.done}/${day.goal} · Neighbour of the day`, 'aria-label': `Vizinho do dia ${day.done}/${day.goal}` }, starEls(day))] : []),
      h('span', { class: 'rtrack-caret', 'aria-hidden': 'true' }),
    );
    rows.replaceChildren(...entries.map((e) => entryRow(e, flash.has(e.key), openJournal)));
    applyOpen();
  };
  game.on('profile', refresh);
  game.on('recados', refresh);
  // NPCs walk their schedules: the where-lines ("Em casa · volta às 8h") follow the clock
  window.setInterval(() => {
    if (game.board?.active.length || game.board?.offered.length) refresh();
  }, 15000);
  refresh();
  return { refresh };
}

function entryRow(e: TrackerEntry, justDone: boolean, open: () => void): HTMLElement {
  return h(
    'div',
    {
      class: `rtrack-row ${e.kind}${justDone ? ' just-done' : ''}`,
      'data-recado': e.key,
      role: 'button',
      tabindex: '0',
      title: 'Abrir os favores / open the favors',
      onclick: open,
      onkeydown: (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      },
    },
    h('span', { class: 'rt-giver' }, npcPortrait(e.giver, 'neutro', 'rt-face'), e.kind === 'offer' ? h('i', { class: 'rt-bang', 'aria-hidden': 'true' }, '!') : null),
    h(
      'span',
      { class: 'rt-text' },
      h('span', { class: 'rt-title' }, e.title.pt, e.kind === 'offer' ? h('em', { class: 'rt-new' }, 'Novo') : h('em', null, e.progress)),
      h('span', { class: 'rt-step', lang: 'pt-BR', title: e.step.en }, e.step.pt),
      e.where ? h('span', { class: 'rt-where', title: e.where.en }, '📍 ', e.where.pt) : null,
    ),
    h('span', { class: 'rt-tick', 'aria-hidden': 'true' }, '✓'),
  );
}

// ---------------------------------------------------------------- done card

/** The giver says thanks: a card with their portrait, the line, and the RV + friendship reward. Not modal: the world keeps moving. */
export function showRecadoDone(id: string, dayBonus = false): void {
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
      // needs_br: true
      dayBonus ? h('div', { class: 'rd-bonus' }, h('span', { class: 'rd-stars', 'aria-hidden': 'true' }, '★★★'), h('b', null, `Vizinho do dia! +${RECADO_DAY_BONUS_RV} RV`), en('Neighbour of the day!', true)) : null,
    ),
  );
  ui().append(card);
  window.setTimeout(() => card.remove(), 6500);
}

// ---------------------------------------------------------------- journal

/** "📍 Praça" / "📍 Em casa · volta às 8h" under a card: where to go now. */
function whereEl(w: { pt: string; en: string } | null, who?: string): HTMLElement | null {
  if (!w) return null;
  return h('p', { class: 'rj-where' }, '📍 ', who ? `${who}: ${w.pt}` : w.pt, en(who ? `${who}: ${w.en}` : w.en, true));
}

export function openJournal(): void {
  const body = h('div', { class: 'rj-body' });
  const render = () => {
    const j = journalView(game.board, game.profile);
    // each part waits until it has something in it: a newcomer sees today's favors and the welcome chain, nothing else
    const show = journalSections(j, game.profile ? stage(game.profile) : 'S0');
    const sections: (HTMLElement | null)[] = [];
    const minute = clock.minutes();
    const day = dayProgress(game.board);
    // needs_br: true
    if (show.day) sections.push(
      h(
        'div',
        { class: `rj-day${day.paid ? ' paid' : ''}`, id: 'rj-day' },
        h('span', { class: 'rj-stars', 'aria-hidden': 'true' }, ...starEls(day)),
        h(
          'span',
          null,
          h('b', null, day.paid ? 'Vizinho do dia! ✓' : `Vizinho do dia: ${day.done}/${day.goal}`),
          en(day.paid ? `Neighbour of the day! +${day.rv} RV paid. New favors tomorrow.` : `Finish ${day.goal} favors today for a +${day.rv} RV bonus.`, true),
        ),
      ),
    );

    if (show.active) sections.push(
      h(
        'section',
        { class: 'rj-sec' },
        h('h3', null, 'Em andamento', h('small', null, 'In progress')),
        h(
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
                h(
                  'div',
                  { class: 'rj-actions' },
                  whereEl(activeWhere(a, minute)),
                  h('button', { class: 'ghost rj-drop', type: 'button', title: 'Put aside: it goes back on today’s list', onclick: () => actions.drop(a.id) }, 'Deixar pra depois'),
                ),
              ),
            );
          }),
        ),
      ),
    );

    if (show.today) sections.push(
      h(
        'section',
        { class: 'rj-sec' },
        h('h3', null, 'Hoje na vila', h('small', null, 'Offered today')),
        j.offered.length
          ? h(
              'div',
              { class: 'rj-list' },
              ...j.offered.map((o) => {
                const def = recadoById(o.id);
                const full = j.active.length >= RECADO_MAX_ACTIVE;
                return h(
                  'article',
                  { class: 'rj-card offered', 'data-recado': o.id },
                  h('span', { class: 'rj-face-wrap' }, npcPortrait(o.giver, 'neutro', 'rj-face'), h('i', { class: 'rt-bang', 'aria-hidden': 'true' }, '!')),
                  h(
                    'div',
                    { class: 'rj-main' },
                    h('div', { class: 'rj-title' }, o.title.pt, h('small', null, `de ${npcName(o.giver)}`), h('em', null, `+${o.reward.rv} RV · ♥${o.reward.bond}`)),
                    en(o.title.en, true),
                    h('p', { class: 'rj-ask', lang: 'pt-BR' }, `“${o.ask.pt}”`, en(`“${o.ask.en}”`, true)),
                    // the steps as one compact numbered row (the English on hover): what you sign up for, at a glance
                    def ? h('ol', { class: 'rj-route' }, ...def.steps.map((st) => describeStep(st)).map((t, i) => h('li', { title: t.en }, h('b', null, String(i + 1)), t.pt))) : null,
                    h(
                      'div',
                      { class: 'rj-actions' },
                      whereEl(giverWhere(o.giver, minute), npcName(o.giver)),
                      full
                        ? h('small', { class: 'rj-full' }, `Máximo de ${RECADO_MAX_ACTIVE} de uma vez`, en(`${RECADO_MAX_ACTIVE} at a time`, true))
                        : h('button', { class: 'primary rj-accept', type: 'button', onclick: () => actions.accept(o.id) }, bi('Aceitar', 'Accept')),
                    ),
                  ),
                );
              }),
            )
          : null,
        // held back until the friendship grows (minBond): greyed, with who to talk to. needs_br: true
        show.withheld
          ? h(
              'div',
              { class: 'rj-list rj-withheld' },
              ...j.withheld.map((w) =>
                h(
                  'article',
                  { class: 'rj-card withheld', 'data-recado': w.id, 'aria-disabled': 'true' },
                  npcPortrait(w.giver, 'neutro', 'rj-face'),
                  h('div', { class: 'rj-main' }, h('div', { class: 'rj-title' }, w.title.pt), h('p', { class: 'rj-locked' }, `Fale mais com ${w.name}`, en(`Talk more with ${w.name}`, true))),
                ),
              ),
            )
          : null,
        j.done.length ? h('div', { class: 'rj-done' }, h('b', null, `✓ Feitos hoje: ${j.done.length}`), ...j.done.map((d) => h('span', { class: 'rj-chip' }, d.title.pt))) : null,
      ),
    );

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

    if (show.bag) sections.push(
      h(
        'section',
        { class: 'rj-sec mochila', id: 'rj-mochila' },
        h('h3', null, 'Mochila', h('small', null, 'Bag')),
        h('div', { class: 'rj-bag' }, ...j.bag.map((b) => h('div', { class: 'rj-item', 'data-item': b.itemId, title: `${b.name.pt} · ${b.name.en}` }, foodIcon(b.itemId, 3, b.name.pt), h('span', { class: 'qty' }, `×${b.qty}`), h('span', { class: 'nm' }, b.name.pt)))),
      ),
    );

    // the milestones (2 ♥ your name, 4 ♥ a story, 6 ♥ a gift) announce themselves when they happen
    if (show.friends) sections.push(
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
              h('div', { class: 'rj-fname' }, f.name, h('small', SPEAKER_ROLE_EN[f.npc] ? { title: SPEAKER_ROLE_EN[f.npc] } : null, SPEAKER_ROLE[f.npc] ?? '')),
              h('div', { class: 'rj-hearts', 'aria-label': `${f.hearts.hearts} de 10 corações (${f.hearts.hearts} of 10 hearts)` }, ...Array.from({ length: 10 }, (_, i) => h('i', { class: i < f.hearts.hearts ? 'on' : i === f.hearts.hearts && f.hearts.next > 0 ? 'part' : '' }))),
            ),
          ),
        ),
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
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', null, 'Favores'),
      en('Favors for the neighbors'),
      body,
      h('div', { class: 'rj-foot' }, h('button', { class: 'ghost', onclick: () => close() }, bi('Fechar', 'Close'))),
    ),
    { onClose: () => offs.forEach((f) => f()) },
  );
}

// ---------------------------------------------------------------- NPC dialogue beats


export interface PreludeHooks {
  accept: (recadoId: string) => void;
  give: (npc: NpcId, itemId: string) => void;
  /** Nothing (more) to offer or hand over: go on with the NPC's usual conversation. */
  proceed: () => void;
}

/**
 * What an NPC opens with in place of the usual talk's first line: "Trouxe … pra você!" when an active recado asks for something in your
 * bag, else the NPC's `ask` with "Pode deixar!" / "Agora não". One of them at most per click. Accepting or handing over closes the box (the
 * tracker and toasts take over); declining, "Só conversar" (or having nothing to say) goes on with the normal dialogue in the same box.
 */
export function runPrelude(npc: NpcId, hooks: PreludeHooks): void {
  const give = giveOptions(game.board, game.profile?.bag, npc);
  if (give.length) return giveBeat(npc, give, hooks);
  const offer = offerFrom(game.board, npc, declinedOffers);
  if (offer) return offerBeat(npc, offer, hooks);
  hooks.proceed();
}

const common = (npc: NpcId, key: string) => ({ key, npcId: npc, speaker: npcName(npc), role: SPEAKER_ROLE[npc] ? `${SPEAKER_ROLE[npc]} · ${SPEAKER_ROLE_EN[npc]}` : null, onClose: closeDialogue });

function giveBeat(npc: NpcId, options: ReturnType<typeof giveOptions>, hooks: PreludeHooks): void {
  const g = greetingCap(greetingFor(clock.minutes()));
  // 3 hand-overs at most, then "Só conversar": 4 chips, all on keys 1-4
  const shown = options.slice(0, MAX_CONTENT_CHIPS);
  const chips = [
    // the player says it: the hand-over is a line of Portuguese, not a menu verb. needs_br: true
    ...shown.map((o) => ({ pt: `Trouxe ${itemWithArticle(o.itemId)} pra você!`, en: `Here’s your ${o.name.en}! (hand it over)` })),
    { pt: 'Só conversar', en: 'Just chat' },
  ];
  showDialogueBox({
    ...common(npc, `give-${npc}`),
    expression: 'neutro',
    line: { pt: `${g}! Trouxe algo pra mim?`, en: `${greetingEn(g)}! Did you bring me something?` },
    extras: h('div', { class: 'prelude-items' }, ...shown.map((o) => h('span', { class: 'prelude-item' }, foodIcon(o.itemId, 3, o.name.pt), `×${o.qty}`))),
    chips,
    onChip: (i) => {
      const o = shown[i];
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
    notes: [h('small', { class: 'dbx-meta offer-title' }, `Favor: ${offer.title.pt}`)],
    // the RV only: the hearts and any item are found out on the done card
    extras: h('div', { class: 'offer-reward' }, h('span', { class: 'rd-rv' }, `+${offer.reward.rv} RV`)),
    chips: [
      { pt: 'Pode deixar!', en: 'You got it! (leave it to me)' },
      { pt: 'Agora não', en: 'Not now' },
    ],
    onChip: (i) => {
      if (i === 0) {
        closeDialogue();
        hooks.accept(offer.id);
      } else {
        declinedOffers.add(offer.id);
        // on with the usual talk: one offer per click, a second one waits for the next
        hooks.proceed();
      }
    },
  });
}

export { heartsEl, heartsWith };
