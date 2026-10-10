/**
 * Admin dashboard (playtudobem.com/admin). Plain DOM, no game code. Every number and action comes from `/api/admin/*`,
 * which checks the admin cookie on each request; this page holds no secret and hides nothing the server allows.
 */
import { h, clear } from '../ui/dom';
import './admin.css';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const root = document.getElementById('admin-root')!;

// ---------------------------------------------------------------- api

class Unauthorized extends Error {}

async function api(path: string, body?: unknown): Promise<Json> {
  const res = await fetch(`/api/admin/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  if (res.status === 401 && path !== 'login') throw new Unauthorized();
  if (!res.ok || data.ok === false) throw new Error(data.error ?? data.code ?? `HTTP ${res.status}`);
  return data;
}

/** A write: shows the result, then re-renders the page so it shows what the server now holds. */
async function act(path: string, body: Json, done = 'Done.'): Promise<Json | null> {
  try {
    const r = await api(path, body);
    toast(done);
    void route();
    return r;
  } catch (e) {
    if (e instanceof Unauthorized) return showLogin(), null;
    toast((e as Error).message, true);
    return null;
  }
}

// ---------------------------------------------------------------- small UI pieces

function toast(text: string, err = false) {
  const el = h('div', { class: `toast${err ? ' err' : ''}`, role: 'status' }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), err ? 6000 : 2800);
}

/** Destructive actions: the admin types `expected` before the button works. */
function confirmTyped(title: string, detail: string, expected: string, onOk: (typed: string) => void) {
  const input = h('input', { placeholder: expected, 'aria-label': 'Type to confirm', autocomplete: 'off' }) as HTMLInputElement;
  const ok = h('button', { class: 'danger', disabled: true }, title) as HTMLButtonElement;
  const back = h('div', { class: 'dialog-back' });
  const close = () => back.remove();
  input.addEventListener('input', () => (ok.disabled = input.value.trim().toLowerCase() !== expected.trim().toLowerCase()));
  ok.addEventListener('click', () => {
    close();
    onOk(input.value);
  });
  back.append(
    h(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
      h('h2', null, title),
      h('p', null, detail),
      h('p', { class: 'small muted' }, 'Type ', h('code', null, expected), ' to confirm. A snapshot goes to the audit log first, so it can be restored.'),
      input,
      h('div', { class: 'row', style: 'margin-top:12px;justify-content:flex-end' }, h('button', { onclick: close }, 'Cancel'), ok),
    ),
  );
  back.addEventListener('click', (e) => e.target === back && close());
  document.body.append(back);
  input.focus();
}

const fmtDate = (t: number | null | undefined) => (t ? new Date(t).toLocaleString() : '—');
const fmtDay = (t: number | null | undefined) => (t ? new Date(t).toLocaleDateString() : '—');
function fmtAgo(t: number | null | undefined) {
  if (!t) return '—';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
function fmtBytes(n: number | null | undefined) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) (v /= 1024), i++;
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${u[i]}`;
}
const fmtUptime = (s: number) => `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const pill = (text: string, kind = '') => h('span', { class: `pill ${kind}` }, text);
const tile = (k: string, v: string | number, s?: string) => h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v)), s ? h('div', { class: 's' }, s) : null);
const card = (title: string | null, ...children: (Node | null | false)[]) => h('section', { class: 'card' }, title ? h('h2', null, title) : null, ...children);
const playerLink = (id: string | null | undefined, name: string | null | undefined) => (id ? h('a', { href: `#/player/${encodeURIComponent(id)}` }, name || id) : h('span', { class: 'muted' }, name || '—'));

function table(head: (string | Node)[], rows: (Node | string | number | null)[][], opts: { empty?: string; onRow?: (i: number) => void } = {}) {
  if (!rows.length) return h('p', { class: 'muted' }, opts.empty ?? 'Nothing here yet.');
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      null,
      h('thead', null, h('tr', null, ...head.map((c) => h('th', null, c)))),
      h(
        'tbody',
        null,
        ...rows.map((r, i) =>
          h('tr', opts.onRow ? { class: 'click', onclick: () => opts.onRow!(i) } : null, ...r.map((c) => h('td', null, c == null ? '—' : typeof c === 'number' ? String(c) : c))),
        ),
      ),
    ),
  );
}

/** A report shows the target's lines as the server captured them; anything else shows its own text. Never edited. */
function modText(m: Json): Node[] {
  if (m.lines?.length) return (m.lines as string[]).map((l) => h('div', null, `“${l}”`));
  return m.text ? [h('div', null, m.text)] : [];
}

function subPill(sub: Json | null) {
  if (!sub) return pill('none');
  if (sub.comp) return pill(`COMP ${sub.active ? 'active' : sub.status}`, 'comp');
  if (sub.provider === 'dev') return pill(`test ${sub.status}`);
  return pill(sub.active ? `${sub.status}` : sub.status, sub.active ? 'good' : sub.status === 'expired' ? '' : 'warn');
}

/** Sign-ups per day: one series, so one hue, no legend box; each bar has a hover tooltip and the same numbers sit in a table. */
function signupChart(days: { day: string; accounts: number }[]) {
  const W = 640;
  const H = 160;
  const pad = { l: 28, r: 6, t: 8, b: 22 };
  const max = Math.max(1, ...days.map((d) => d.accounts));
  const bw = (W - pad.l - pad.r) / days.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const svgNs = 'http://www.w3.org/2000/svg';
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(svgNs, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Sign-ups per day, last 30 days' });
  const tip = h('div', { class: 'tip', hidden: true });
  for (const v of [0, max]) {
    svg.append(el('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), stroke: '#e2e0db', 'stroke-width': 1 }));
    const t = el('text', { x: pad.l - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 10, fill: '#737a88' });
    t.textContent = String(v);
    svg.append(t);
  }
  days.forEach((d, i) => {
    const x = pad.l + i * bw;
    const top = y(d.accounts);
    const hgt = H - pad.b - top;
    if (d.accounts > 0) {
      const r = Math.min(4, (bw - 2) / 2, hgt);
      const w = bw - 2;
      const bx = x + 1;
      const base = H - pad.b;
      svg.append(el('path', { d: `M${bx},${base} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + w - r} Q${bx + w},${top} ${bx + w},${top + r} V${base} Z`, fill: '#2a78d6' }));
    }
    const hit = el('rect', { x, y: pad.t, width: bw, height: H - pad.t - pad.b, fill: 'transparent' });
    hit.addEventListener('pointerenter', () => {
      tip.hidden = false;
      tip.textContent = `${d.day}: ${d.accounts} sign-up${d.accounts === 1 ? '' : 's'}`;
      tip.style.left = `${((x + bw / 2) / W) * 100}%`;
      tip.style.top = `${(top / H) * 100}%`;
    });
    hit.addEventListener('pointerleave', () => (tip.hidden = true));
    svg.append(hit);
    // a label every 7 days, counted back from today so the newest day always has one
    if ((days.length - 1 - i) % 7 === 0) {
      const t = el('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 10, fill: '#737a88' });
      t.textContent = d.day.slice(5);
      svg.append(t);
    }
  });
  svg.append(el('line', { x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b, stroke: '#c9c6bf', 'stroke-width': 1 }));
  return h(
    'div',
    null,
    h('div', { class: 'chart' }, svg, tip),
    h('details', null, h('summary', null, 'Table'), table(['Day', 'Accounts', 'Profiles'], [...days].reverse().map((d) => [d.day, d.accounts, (d as Json).profiles]))),
  );
}

// ---------------------------------------------------------------- shell, login, router

const SECTIONS = [
  ['overview', 'Overview'],
  ['players', 'Players'],
  ['subscriptions', 'Subscriptions'],
  ['moderation', 'Moderation'],
  ['feedback', 'Feedback'],
  ['world', 'World & areas'],
  ['config', 'Game variables'],
  ['data', 'Data'],
  ['audit', 'Audit log'],
] as const;

let me: { name: string } | null = null;
let catalogs: Json | null = null;
const main = h('main');

function showLogin(message = '') {
  me = null;
  clear(root);
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Admin password', 'aria-label': 'Admin password' }) as HTMLInputElement;
  const name = h('input', { autocomplete: 'nickname', placeholder: 'Your name (for the audit log)', 'aria-label': 'Your name', value: localStorage.getItem('tb-admin-name') ?? '' }) as HTMLInputElement;
  const err = h('p', { class: 'err', hidden: !message }, message);
  const go = async (e: Event) => {
    e.preventDefault();
    err.hidden = true;
    try {
      localStorage.setItem('tb-admin-name', name.value.trim());
      await api('login', { password: pw.value, name: name.value.trim() });
      pw.value = '';
      await start();
    } catch (x) {
      err.textContent = (x as Error).message;
      err.hidden = false;
    }
  };
  root.append(
    h(
      'form',
      { class: 'card login', onsubmit: go },
      h('h1', null, 'Tudo Bem admin'),
      h('p', { class: 'muted small' }, 'Same password as the in-game admin gate. The session lasts 30 minutes without activity.'),
      h('div', { class: 'grid', style: 'gap:10px' }, name, pw, h('button', { class: 'primary', type: 'submit' }, 'Sign in'), err),
    ),
  );
  name.value ? pw.focus() : name.focus();
}

async function start() {
  try {
    me = (await api('session')) as { name: string };
    catalogs = await api('catalogs');
  } catch (e) {
    return showLogin(e instanceof Unauthorized ? '' : (e as Error).message);
  }
  clear(root);
  const nav = h('nav', null, ...SECTIONS.map(([id, label]) => h('a', { href: `#/${id}`, 'data-id': id }, label)));
  const logout = h('button', { onclick: async () => (await api('logout', {}).catch(() => null), showLogin('Signed out.')) }, 'Sign out');
  root.append(
    h(
      'div',
      { class: 'shell' },
      h('aside', { class: 'side' }, h('div', { class: 'brand' }, 'Tudo Bem', h('small', null, 'Admin dashboard')), nav, h('div', { class: 'who' }, h('span', null, `Signed in as ${me.name}`), logout, h('a', { href: '/', style: 'color:#9aa3b2' }, 'Open the game'))),
      main,
    ),
  );
  await route();
}

async function route() {
  if (!me) return;
  const parts = (location.hash.replace(/^#\/?/, '') || 'overview').split('/');
  const section = parts[0] === 'player' ? 'players' : parts[0]!;
  for (const a of root.querySelectorAll<HTMLAnchorElement>('nav a')) a.classList.toggle('on', a.dataset.id === section);
  const view: Record<string, () => Promise<Node[]>> = {
    overview: viewOverview,
    players: viewPlayers,
    player: () => viewPlayer(decodeURIComponent(parts[1] ?? '')),
    subscriptions: viewSubscriptions,
    moderation: viewModeration,
    feedback: viewFeedback,
    world: viewWorld,
    config: viewConfig,
    data: viewData,
    audit: viewAudit,
  };
  const fn = view[parts[0]!] ?? viewOverview;
  try {
    const nodes = await fn();
    clear(main);
    main.append(...nodes);
  } catch (e) {
    if (e instanceof Unauthorized) return showLogin('Your admin session ended. Sign in again.');
    clear(main);
    main.append(card('Something went wrong', h('p', { class: 'err' }, (e as Error).message)));
  }
}

window.addEventListener('hashchange', () => void route());

// ---------------------------------------------------------------- 1. overview

async function viewOverview(): Promise<Node[]> {
  const o = await api('overview');
  const jev = o.jev as Json;
  const jevKind = jev.state === 'ready' ? 'good' : jev.state === 'stub' ? 'warn' : jev.state === 'loading' ? 'warn' : 'bad';
  return [
    h('h1', null, 'Overview'),
    h(
      'div',
      { class: 'tiles' },
      tile('Online now', o.online.players, `${o.online.instances.length} room instance(s)`),
      tile('Accounts', o.totals.accounts),
      tile('Profiles', o.totals.profiles),
      tile('Subscribers', o.totals.subscribers, `${o.totals.comps} comp`),
      tile('To review', o.todo.pendingModeration, `reports + escalations, 7 days`),
      tile('New feedback', o.todo.newFeedback),
    ),
    h(
      'div',
      { class: 'grid two' },
      card(
        'Online by room',
        table(
          ['Instance', 'Room', 'Players', 'CPUs'],
          o.online.instances.filter((i: Json) => i.players > 0).map((i: Json) => [i.name, i.room, i.players, i.cpus]),
          { empty: 'Nobody is in the world right now.' },
        ),
        o.online.list.length ? h('h3', null, 'Players') : null,
        o.online.list.length ? table(['Name', 'Room', 'Idle'], o.online.list.map((p: Json) => [playerLink(p.profileId, p.name), p.instanceName ?? '—', `${Math.round(p.idleMs / 1000)}s`])) : null,
      ),
      card('Sign-ups per day (accounts, 30 days)', signupChart(o.signups)),
    ),
    h(
      'div',
      { class: 'grid three' },
      card(
        'Server',
        h(
          'dl',
          { class: 'kv' },
          h('dt', null, 'Version'),
          h('dd', null, h('code', null, String(o.server.version))),
          h('dt', null, 'Uptime'),
          h('dd', null, fmtUptime(o.server.uptimeSec)),
          h('dt', null, 'Started'),
          h('dd', null, fmtDate(o.server.startedAt)),
          h('dt', null, 'Node'),
          h('dd', null, o.server.node),
          h('dt', null, 'Memory'),
          h('dd', null, `${o.server.rssMb} MB RSS`),
          h('dt', null, 'Region'),
          h('dd', null, o.server.region ?? '—'),
        ),
      ),
      card(
        'Jev moderation',
        h('p', null, pill(jev.state, jevKind), ' ', jev.model ? h('code', null, jev.model) : null),
        jev.error ? h('p', { class: 'err small' }, jev.error) : null,
        h('p', { class: 'small muted' }, jev.state === 'stub' ? 'Word filter only: the model is not configured on this server.' : 'Chat goes through the word filter, then the model.'),
      ),
      card(
        'Storage',
        h(
          'dl',
          { class: 'kv' },
          h('dt', null, 'Database'),
          h('dd', null, fmtBytes(o.storage.dbBytes)),
          h('dt', null, 'Disk free'),
          h('dd', null, o.storage.disk ? `${fmtBytes(o.storage.disk.free)} of ${fmtBytes(o.storage.disk.total)}` : '—'),
          h('dt', null, 'Last backup'),
          h('dd', null, o.storage.backups.last ? `${fmtDate(o.storage.backups.last)} (${fmtAgo(o.storage.backups.last)})` : 'none yet'),
          h('dt', null, 'Backups'),
          h('dd', null, `${o.storage.backups.count} files, ${fmtBytes(o.storage.backups.bytes)}`),
          h('dt', null, 'Profile writes'),
          h('dd', null, o.storage.store.failures ? pill(`${o.storage.store.failures} failing`, 'bad') : pill('ok', 'good'), ` ${o.storage.store.pending} pending`),
        ),
      ),
    ),
  ];
}

// ---------------------------------------------------------------- 2. players

const playerQuery = { q: '', filter: '', sort: 'lastSeen', dir: 'desc', offset: 0 };

async function viewPlayers(): Promise<Node[]> {
  const params = new URLSearchParams({ q: playerQuery.q, filter: playerQuery.filter, sort: playerQuery.sort, dir: playerQuery.dir, offset: String(playerQuery.offset), limit: '100' });
  const r = await api(`players?${params}`);
  const search = h('input', { type: 'search', class: 'grow', placeholder: 'Search name, email or id', value: playerQuery.q, 'aria-label': 'Search players' }) as HTMLInputElement;
  let timer = 0;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      playerQuery.q = search.value;
      playerQuery.offset = 0;
      void route().then(() => {
        const s = main.querySelector<HTMLInputElement>('input[type=search]');
        s?.focus();
        s?.setSelectionRange(s.value.length, s.value.length);
      });
    }, 250);
  });
  const filter = h(
    'select',
    { 'aria-label': 'Filter', onchange: (e: Event) => ((playerQuery.filter = (e.target as HTMLSelectElement).value), (playerQuery.offset = 0), void route()) },
    ...[
      ['', 'Everyone'],
      ['online', 'Online'],
      ['subscribers', 'Subscribers'],
      ['banned', 'Banned'],
      ['muted', 'Muted'],
      ['founder', 'Founder flag'],
      ['noprofile', 'No avatar yet'],
      ['test', 'Test profiles'],
    ].map(([v, l]) => h('option', { value: v, selected: playerQuery.filter === v }, l)),
  );
  const sortable = (key: string, label: string) =>
    h(
      'th',
      {
        class: 'sort',
        onclick: () => {
          playerQuery.dir = playerQuery.sort === key && playerQuery.dir === 'desc' ? 'asc' : 'desc';
          playerQuery.sort = key;
          void route();
        },
      },
      label,
      playerQuery.sort === key ? (playerQuery.dir === 'desc' ? ' ▾' : ' ▴') : '',
    );
  const rows: Json[] = r.rows;
  const tbl = h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      null,
      h(
        'thead',
        null,
        h('tr', null, sortable('name', 'Name'), sortable('email', 'Email'), sortable('coins', 'RV'), sortable('belt', 'Belt'), sortable('words', 'Words'), h('th', null, 'Sub'), h('th', null, 'Status'), sortable('createdAt', 'Joined'), sortable('lastSeen', 'Last seen')),
      ),
      h(
        'tbody',
        null,
        ...rows.map((p) =>
          h(
            'tr',
            { class: 'click', onclick: () => (location.hash = `#/player/${encodeURIComponent(p.id)}`) },
            h('td', null, p.name ?? h('span', { class: 'muted' }, '(no avatar)')),
            h('td', null, p.email ?? '—', p.google ? h('span', { class: 'muted small' }, ' G') : null),
            h('td', { class: 'num' }, p.coins ?? '—'),
            h('td', null, p.belt ? `${p.belt} ${p.stripes}` : '—'),
            h('td', { class: 'num' }, String(p.words)),
            h('td', null, p.sub ? subPill(p.sub) : ''),
            h('td', null, p.online ? pill(`online · ${p.room ?? ''}`, 'good') : null, p.banned ? pill('banned', 'bad') : null, p.muted ? pill('muted', 'warn') : null, p.testUser ? pill('test') : null),
            h('td', null, fmtDay(p.createdAt)),
            h('td', null, fmtAgo(p.lastSeen)),
          ),
        ),
      ),
    ),
  );
  const pager = h(
    'div',
    { class: 'row', style: 'margin-top:10px' },
    h('span', { class: 'muted small grow' }, `${r.total} match${r.total === 1 ? '' : 'es'}, showing ${r.total ? playerQuery.offset + 1 : 0}–${Math.min(r.total, playerQuery.offset + 100)}`),
    h('button', { disabled: playerQuery.offset === 0, onclick: () => ((playerQuery.offset = Math.max(0, playerQuery.offset - 100)), void route()) }, 'Previous'),
    h('button', { disabled: playerQuery.offset + 100 >= r.total, onclick: () => ((playerQuery.offset += 100), void route()) }, 'Next'),
  );
  return [h('h1', null, 'Players & accounts'), card(null, h('div', { class: 'row' }, search, filter), rows.length ? tbl : h('p', { class: 'muted' }, 'No players match.'), pager)];
}

async function viewPlayer(id: string): Promise<Node[]> {
  const d = await api(`player?id=${encodeURIComponent(id)}`);
  const a = d.account as Json | null;
  const p = d.profile as Json | null;
  const back = h('p', null, h('a', { href: '#/players' }, '← All players'));
  if (!p) {
    return [
      back,
      h('h1', null, a?.email ?? id),
      card('Account (no avatar yet)', accountBlock(a!)),
      card('Actions', h('div', { class: 'row' }, h('button', { onclick: () => act('player/signout', { id: a!.id }, 'Signed out everywhere.') }, 'Sign out all sessions'), deleteButton(a!.id, a!.email))),
    ];
  }
  const pid = p.id as string;
  const items = catalogs!.items as Record<string, { id: string; label: string; price: number }[]>;

  // RV
  const delta = h('input', { type: 'number', placeholder: '+50 or -20', style: 'width:120px', 'aria-label': 'RV amount' }) as HTMLInputElement;
  const reason = h('input', { class: 'grow', placeholder: 'Reason (goes in the audit log)', 'aria-label': 'Reason' }) as HTMLInputElement;
  const coinsForm = h(
    'div',
    { class: 'row' },
    delta,
    reason,
    h('button', { class: 'primary', onclick: () => act('player/coins', { id: pid, delta: Number(delta.value), reason: reason.value }, 'RV updated.') }, 'Apply'),
  );

  // items
  const kind = h('select', { 'aria-label': 'Kind' }, ...(catalogs!.itemKinds as string[]).map((k) => h('option', { value: k }, k))) as HTMLSelectElement;
  const item = h('select', { 'aria-label': 'Item', class: 'grow' }) as HTMLSelectElement;
  const qty = h('input', { type: 'number', value: '1', min: '1', max: '20', style: 'width:70px', 'aria-label': 'Quantity' }) as HTMLInputElement;
  const fillItems = () => {
    clear(item);
    for (const it of items[kind.value] ?? []) item.append(h('option', { value: it.id }, `${it.label}${it.price ? ` · ${it.price} RV` : ''}`));
  };
  kind.addEventListener('change', fillItems);
  fillItems();
  const itemForm = h(
    'div',
    { class: 'row' },
    kind,
    item,
    qty,
    h('button', { onclick: () => act('player/item', { id: pid, kind: kind.value, itemId: item.value, op: 'grant', qty: Number(qty.value) }, 'Granted.') }, 'Grant'),
    h('button', { onclick: () => act('player/item', { id: pid, kind: kind.value, itemId: item.value, op: 'remove', qty: Number(qty.value) }, 'Removed.') }, 'Remove'),
  );

  // pets (#234): the adopted animals, out / at home, remove, and a grant without a comp
  type BreedOpt = { id: string; pt: string; en: string; species: string; coats: { id: string; pt: string; en: string }[] };
  type PetRow = { id: string; breed: string; breedPt: string; coat: string; name: string | null; collar: string | null; toy: string | null; legacy?: boolean };
  const breeds = (catalogs!.breeds ?? []) as BreedOpt[];
  const pets = (p.pets ?? []) as PetRow[];
  const breedSel = h('select', { 'aria-label': 'Breed', class: 'grow' }, ...breeds.map((b) => h('option', { value: b.id }, `${b.pt} · ${b.en} (${b.species})`))) as HTMLSelectElement;
  const coatSel = h('select', { 'aria-label': 'Coat' }) as HTMLSelectElement;
  const fillCoats = () => {
    clear(coatSel);
    for (const c of breeds.find((b) => b.id === breedSel.value)?.coats ?? []) coatSel.append(h('option', { value: c.id }, `${c.pt} · ${c.en}`));
  };
  breedSel.addEventListener('change', fillCoats);
  fillCoats();
  const petName = h('input', { placeholder: 'Name (optional)', maxlength: '16', style: 'width:140px', 'aria-label': 'Pet name' }) as HTMLInputElement;
  const petsBlock = h(
    'div',
    null,
    table(
      ['Name', 'Breed', 'Coat', 'Collar / toy', ''],
      pets.map((q) => [
        h('span', null, q.name ?? h('span', { class: 'muted' }, 'no name'), ' ', q.id === p.activePetId ? pill('out', 'good') : pill('home'), q.legacy ? pill('legacy') : null),
        q.breedPt,
        q.coat,
        [q.collar, q.toy].filter(Boolean).join(' · ') || '—',
        h(
          'div',
          { class: 'row', style: 'margin:0' },
          q.id === p.activePetId
            ? h('button', { onclick: () => act('player/pet-active', { id: pid, petId: null }, 'Put away.') }, 'Em casa')
            : h('button', { onclick: () => act('player/pet-active', { id: pid, petId: q.id }, 'Taken out.') }, 'Levar'),
          h('button', { class: 'danger', onclick: () => confirmTyped('Remove pet', `Takes ${q.name ?? q.breedPt} off ${p.name}’s profile.`, q.name ?? q.breedPt, (typed) => void act('player/pet-remove', { id: pid, petId: q.id, confirm: typed }, 'Pet removed.')) }, 'Remove'),
        ),
      ]),
      { empty: 'No pets yet.' },
    ),
    h('div', { class: 'row' }, breedSel, coatSel, petName, h('button', { class: 'primary', onclick: () => act('player/pet-grant', { id: pid, breed: breedSel.value, coat: coatSel.value, name: petName.value }, 'Pet granted.') }, 'Grant pet')),
  );

  // belt
  const belt = h('select', { 'aria-label': 'Belt' }, ...(catalogs!.belts as string[]).map((b) => h('option', { value: b, selected: b === p.belt }, b))) as HTMLSelectElement;
  const stripes = h('select', { 'aria-label': 'Stripes' }, ...[0, 1, 2, 3, 4].map((n) => h('option', { value: String(n), selected: n === p.stripes }, `${n} stripe${n === 1 ? '' : 's'}`))) as HTMLSelectElement;
  const beltForm = h('div', { class: 'row' }, belt, stripes, h('button', { onclick: () => act('player/belt', { id: pid, belt: belt.value, stripes: Number(stripes.value) }, 'Belt set.') }, 'Set belt'), h('span', { class: 'muted small' }, `${p.wins} wins now. Wins decide the belt, so this writes the win count for that rank.`));

  // moderation actions
  const minutes = h('select', { 'aria-label': 'Mute length' }, ...[['10', '10 min'], ['60', '1 hour'], ['1440', '1 day'], ['10080', '7 days']].map(([v, l]) => h('option', { value: v }, l))) as HTMLSelectElement;
  const newName = h('input', { placeholder: 'New name', value: p.name, 'aria-label': 'New name' }) as HTMLInputElement;

  const intro = (which: string, label: string) => h('button', { onclick: () => act('player/reset-intro', { id: pid, which }, `${label} reset.`) }, label);

  return [
    back,
    h('h1', null, p.name, ' ', d.live ? pill(`online · ${d.live.instanceName ?? d.live.room}`, 'good') : pill(`last seen ${fmtAgo(p.lastSeen)}`), ' ', p.banned ? pill('banned', 'bad') : null, p.mutedUntil ? pill(`muted until ${fmtDate(p.mutedUntil)}`, 'warn') : null),
    h(
      'div',
      { class: 'tiles' },
      tile('RV', p.coins),
      tile('Belt', `${p.belt} ${p.stripes}`, `${p.wins} wins${p.giOwned ? '' : ' · no gi'}`),
      tile('Diary words', p.diaryWords, `escola XP ${p.escola.xp}`),
      tile('Streak', p.escola.streak, `best ${p.escola.best}`),
      tile('Nameplate', p.nameplate),
      tile('Friends', p.friends, `${p.blocked} blocked`),
    ),
    h(
      'div',
      { class: 'grid two' },
      h(
        'div',
        null,
        card('Account', a ? accountBlock(a) : h('p', { class: 'muted' }, 'No account (legacy guest profile).')),
        card(
          'Profile',
          h(
            'dl',
            { class: 'kv' },
            h('dt', null, 'Profile id'),
            h('dd', null, h('code', null, pid)),
            h('dt', null, 'Created'),
            h('dd', null, fmtDate(p.createdAt)),
            h('dt', null, 'Founder flag'),
            h('dd', null, p.founder ? 'yes' : 'no', p.founderBadge ? ' · supporter badge' : '', p.founderBanner ? ' · banner' : ''),
            h('dt', null, 'Subscription'),
            h('dd', null, subPill(p.subscription), p.subscription?.currentPeriodEnd ? ` until ${fmtDay(p.subscription.currentPeriodEnd)}` : ''),
            h('dt', null, 'Hats'),
            h('dd', null, p.hats.join(', ') || '—', p.hat ? ` (wearing ${p.hat})` : ''),
            h('dt', null, 'Furniture'),
            h('dd', null, Object.entries(p.furniture).map(([k, n]) => `${k} ×${n}`).join(', ') || '—', ` · ${p.apartment} placed`),
            h('dt', null, 'Birds'),
            h('dd', null, p.parrotColors.join(', ') || '—'),
            h('dt', null, 'Bag'),
            h('dd', null, Object.entries(p.bag).map(([k, n]) => `${k} ×${n}`).join(', ') || '—'),
            h('dt', null, 'Pet'),
            h('dd', null, p.pet ?? '—', Object.keys(p.petNames).length ? ` (${Object.entries(p.petNames).map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''),
            h('dt', null, 'Arrival'),
            h('dd', null, `desembarque ${p.desembarqueDone ? 'done' : 'pending'} · intro ${p.arrivalIntroDone ? 'done' : 'pending'}${p.replayFlight ? ' · flight replays next sign-in' : ''}`),
            h('dt', null, 'Tutorial'),
            h('dd', null, `${Object.values(p.tutorial).filter(Boolean).length}/${Object.keys(p.tutorial).length} steps${p.tutorialRewarded ? ' · bonus paid' : ''}`),
            h('dt', null, 'Kitnet'),
            h('dd', null, `${p.apartment} piece(s) placed`),
            h('dt', null, 'Academy'),
            h('dd', null, d.academy ? `${d.academy.name} (${d.academy.owner ? 'owner' : 'member'}, ${d.academy.members} members)` : '—'),
            h('dt', null, 'Padaria'),
            h('dd', null, d.padaria ? `${d.padaria.name} (size ${d.padaria.size})` : '—'),
            h('dt', null, 'Correria'),
            h('dd', null, p.correria ? `${p.correria.shifts ?? 0} shifts, best ${p.correria.best ?? 0}` : '—'),
            h('dt', null, 'Feira medals'),
            h('dd', null, String(p.feiraMedals.length)),
          ),
        ),
      ),
      h(
        'div',
        null,
        card('Give or take RV', coinsForm, h('p', { class: 'small muted' }, `Up to ${catalogs!.adminGrantMax} RV at a time. Admin grants are logged, and the player sees it live.`)),
        card('Items, hats, birds, furniture', itemForm, h('p', { class: 'small muted' }, 'From the real catalogs. Adoption needs a comp or a direct grant (Pets card).')),
        card('Pets', petsBlock, h('p', { class: 'small muted' }, `Up to 6. A granted pet waits at home in the kitnet; it only follows the player while they have access (subscription or comp). Collars and toys owned: ${(p.petItems ?? []).join(', ') || 'none'}.`)),
        card('Belt and stripes', beltForm),
        card('Tutorials and intro', h('div', { class: 'row' }, intro('tutorial', 'Tutorial steps'), intro('desembarque', 'Desembarque'), intro('arrivalIntro', 'Arrival intro'), intro('flight', 'Flight in')), h('p', { class: 'small muted' }, 'The tutorial bonus is not paid twice. Arrival resets start on the next sign-in.')),
        card(
          'Moderation',
          h(
            'div',
            { class: 'row' },
            minutes,
            h('button', { onclick: () => act('player/mute', { id: pid, minutes: Number(minutes.value) }, 'Muted.') }, 'Mute'),
            p.mutedUntil ? h('button', { onclick: () => act('player/mute', { id: pid, minutes: 0 }, 'Unmuted.') }, 'Unmute') : null,
            h('button', { disabled: !d.live, onclick: () => act('player/kick', { id: pid }, 'Kicked.') }, 'Kick'),
            p.banned ? h('button', { onclick: () => act('player/ban', { id: pid, ban: false }, 'Unbanned.') }, 'Unban') : h('button', { class: 'danger', onclick: () => act('player/ban', { id: pid, ban: true }, 'Banned.') }, 'Ban'),
          ),
          h('div', { class: 'row' }, newName, h('button', { onclick: () => act('player/rename', { id: pid, name: newName.value }, 'Renamed.') }, 'Rename'), h('span', { class: 'small muted' }, 'Checked by the same filter and model as chat.')),
          h(
            'div',
            { class: 'row' },
            h('button', { onclick: () => act('player/founder', { id: pid, founder: !p.founder }, 'Founder flag updated.') }, p.founder ? 'Remove founder flag' : 'Set founder flag'),
            a ? h('button', { onclick: () => act('player/signout', { id: pid }, 'Signed out everywhere.') }, 'Sign out all sessions') : null,
          ),
        ),
        card(
          'Danger zone',
          h(
            'div',
            { class: 'row' },
            h('button', { class: 'danger', onclick: () => confirmTyped('Reset progress', `Wipes RV, belt, diary, escola, purchases and tutorials for ${p.name}. Keeps the login, name, looks, friends, photos and subscription.`, p.name, (typed) => void act('player/reset-progress', { id: pid, confirm: typed }, 'Progress reset.')) }, 'Reset progress'),
            deleteButton(pid, a?.email ?? p.name),
          ),
        ),
      ),
    ),
    card(
      'Moderation history',
      table(
        ['When', 'Kind', 'By', 'About', 'Text'],
        (d.moderation as Json[]).map((m) => [fmtDate(m.at), pill(m.kind, m.kind === 'block' || m.kind === 'report' ? 'bad' : 'warn'), m.playerName, m.targetName ?? '—', h('div', null, ...modText(m))]),
        { empty: 'No moderation entries.' },
      ),
    ),
    h(
      'div',
      { class: 'grid two' },
      card('Feedback they sent', table(['When', 'Status', 'Text'], (d.feedback as Json[]).map((f) => [fmtDate(f.createdAt), pill(f.triage.status), f.text]), { empty: 'No feedback.' })),
      card('Billing events', table(['When', 'Event', 'Status', 'Outcome'], (d.billingEvents as Json[]).map((e) => [fmtDate(e.at), e.kind, e.status ?? '—', e.outcome]), { empty: 'No webhook events.' })),
    ),
    card('Admin changes to this player', auditTable(d.audit)),
    card('Raw profile', h('p', { class: 'small muted' }, 'Stored JSON, without the session token or photo bytes.'), h('pre', null, JSON.stringify(d.raw, null, 2))),
  ];
}

function accountBlock(a: Json) {
  return h(
    'div',
    null,
    h(
      'dl',
      { class: 'kv' },
      h('dt', null, 'Email'),
      h('dd', null, a.email, a.google ? ' (Google)' : ''),
      h('dt', null, 'Account id'),
      h('dd', null, h('code', null, a.id)),
      h('dt', null, 'Created'),
      h('dd', null, fmtDate(a.createdAt)),
      h('dt', null, 'Last login'),
      h('dd', null, fmtDate(a.lastLoginAt)),
      h('dt', null, '18+ ticked'),
      h('dd', null, a.confirmed18At ? fmtDate(a.confirmed18At) : 'no'),
    ),
    h('h3', null, `Sessions (${a.sessions.length})`),
    table(['Signed in', 'Expires'], (a.sessions as Json[]).map((s) => [fmtDate(s.createdAt), fmtDate(s.expiresAt)]), { empty: 'No live sessions.' }),
  );
}

function deleteButton(id: string, expected: string) {
  return h(
    'button',
    {
      class: 'danger',
      onclick: () =>
        confirmTyped('Delete account', 'Deletes the account, its profile, places it owns, feedback and moderation entries (the same cascade as a player deleting themselves).', expected, async (typed) => {
          const r = await act('player/delete', { id, confirm: typed }, 'Account deleted. It can be restored from the audit log.');
          if (r) location.hash = '#/players';
        }),
    },
    'Delete account',
  );
}

// ---------------------------------------------------------------- 3. subscriptions

async function viewSubscriptions(): Promise<Node[]> {
  const d = await api('subscriptions');
  const who = h('input', { placeholder: 'Player id, name or email', class: 'grow', 'aria-label': 'Player' }) as HTMLInputElement;
  const days = h('input', { type: 'number', value: '30', min: '1', max: '366', style: 'width:90px', 'aria-label': 'Days' }) as HTMLInputElement;
  const resolve = async () => {
    const q = who.value.trim();
    if (!q) return null;
    const r = await api(`players?q=${encodeURIComponent(q)}&limit=2`);
    if (r.total !== 1) {
      toast(r.total ? 'More than one player matches. Use the id.' : 'No player matches.', true);
      return null;
    }
    return r.rows[0].id as string;
  };
  return [
    h('h1', null, 'Subscriptions'),
    card(
      'Comp supporter perks',
      h('p', { class: 'small muted' }, 'A comp gives the subscriber perks (pets, chat bubbles) with no payment. It is marked COMP everywhere, does not grant the founder badge or banner, and never touches Lemon Squeezy. There are no money actions here.'),
      h(
        'div',
        { class: 'row' },
        who,
        days,
        h('button', { class: 'primary', onclick: async () => { const id = await resolve(); if (id) void act('subscriptions/comp', { id, grant: true, days: Number(days.value) }, 'Comp granted.'); } }, 'Grant comp'),
        h('button', { onclick: async () => { const id = await resolve(); if (id) void act('subscriptions/comp', { id, grant: false }, 'Comp revoked.'); } }, 'Revoke comp'),
      ),
    ),
    card(
      `Subscribers (${(d.rows as Json[]).filter((r) => r.active).length} active)`,
      table(
        ['Player', 'Email', 'Status', 'Until', 'Badge', ''],
        (d.rows as Json[]).map((r) => [
          playerLink(r.id, r.name),
          r.email ?? '—',
          subPill(r.status === 'none' ? null : r),
          fmtDay(r.currentPeriodEnd),
          r.founderBadge ? pill('founder', 'good') : '',
          r.comp ? h('button', { onclick: () => act('subscriptions/comp', { id: r.id, grant: false }, 'Comp revoked.') }, 'Revoke comp') : '',
        ]),
        { empty: 'No subscribers yet.' },
      ),
    ),
    card(
      'Lemon Squeezy webhook events',
      table(['When', 'Event id', 'Kind', 'Player', 'Status', 'Outcome'], (d.events as Json[]).map((e) => [fmtDate(e.at), h('code', null, e.eventId), e.kind, playerLink(e.profileId, e.profileId), e.status ?? '—', pill(e.outcome, e.outcome === 'applied' ? 'good' : '')]), { empty: 'No webhook events recorded yet.' }),
    ),
  ];
}

// ---------------------------------------------------------------- 4. moderation

const modQuery = { kind: '', q: '' };

async function viewModeration(): Promise<Node[]> {
  const d = await api(`moderation?kind=${modQuery.kind}&q=${encodeURIComponent(modQuery.q)}`);
  const kind = h(
    'select',
    { 'aria-label': 'Kind', onchange: (e: Event) => ((modQuery.kind = (e.target as HTMLSelectElement).value), void route()) },
    h('option', { value: '' }, 'All kinds'),
    ...(catalogs!.moderationKinds as string[]).map((k) => h('option', { value: k, selected: modQuery.kind === k }, k)),
  );
  const q = h('input', { type: 'search', class: 'grow', placeholder: 'Search name, text or id', value: modQuery.q, 'aria-label': 'Search' }) as HTMLInputElement;
  q.addEventListener('change', () => ((modQuery.q = q.value), void route()));
  return [
    h('h1', null, 'Moderation'),
    card(
      'Muted and banned now',
      table(
        ['Player', 'Banned', 'Muted until', ''],
        (d.restricted as Json[]).map((r) => [
          playerLink(r.id, r.name),
          r.banned ? fmtDate(r.banned) : '—',
          r.mutedUntil ? fmtDate(r.mutedUntil) : '—',
          h('div', { class: 'row', style: 'margin:0' }, r.banned ? h('button', { onclick: () => act('player/ban', { id: r.id, ban: false }, 'Unbanned.') }, 'Unban') : null, r.mutedUntil ? h('button', { onclick: () => act('player/mute', { id: r.id, minutes: 0 }, 'Unmuted.') }, 'Unmute') : null),
        ]),
        { empty: 'Nobody is muted or banned.' },
      ),
    ),
    card(
      'Log (moderation.jsonl and reports)',
      h('p', { class: 'small muted' }, 'Chat text is shown as it was sent. It is never edited here.'),
      h('div', { class: 'row' }, kind, q),
      table(
        ['When', 'Kind', 'Where', 'Who', 'Text', 'Labels', 'Action'],
        (d.items as Json[]).map((m) => [
          fmtDate(m.at),
          pill(m.kind, m.kind === 'block' || m.kind === 'report' ? 'bad' : 'warn'),
          `${m.surface} · ${m.room}`,
          h('div', null, playerLink(m.playerId, m.playerName), m.targetName ? h('div', { class: 'small muted' }, 'reported ', playerLink(m.targetId, m.targetName)) : null),
          h('div', null, m.reason ? h('div', { class: 'small' }, `Reason: ${m.reason}`) : null, ...modText(m)),
          (m.labels as string[]).join(', ') + (m.toxicity != null ? ` (${Number(m.toxicity).toFixed(2)})` : ''),
          m.subject
            ? h(
                'div',
                { class: 'row', style: 'margin:0' },
                h('button', { onclick: () => act('player/mute', { id: m.subject.id, minutes: 60 }, `${m.subject.name} muted for 1 hour.`) }, 'Mute 1h'),
                m.subject.banned ? pill('banned', 'bad') : h('button', { class: 'danger', onclick: () => act('player/ban', { id: m.subject.id, ban: true }, `${m.subject.name} banned.`) }, 'Ban'),
              )
            : '',
        ]),
        { empty: 'The log is empty.' },
      ),
    ),
  ];
}

// ---------------------------------------------------------------- 5. feedback

const fbQuery = { status: 'new', q: '' };

async function viewFeedback(): Promise<Node[]> {
  const d = await api(`feedback?status=${fbQuery.status}&q=${encodeURIComponent(fbQuery.q)}`);
  const tabs = h(
    'div',
    { class: 'tabs' },
    ...['new', 'seen', 'done', ''].map((s) => h('button', { class: fbQuery.status === s ? 'on' : '', onclick: () => ((fbQuery.status = s), void route()) }, s || 'all')),
  );
  const q = h('input', { type: 'search', placeholder: 'Search text, player or contact', value: fbQuery.q, 'aria-label': 'Search', class: 'grow' }) as HTMLInputElement;
  q.addEventListener('change', () => ((fbQuery.q = q.value), void route()));
  const rows = (d.items as Json[]).map((f) => {
    const note = h('textarea', { 'aria-label': 'Note', placeholder: 'Note (only admins see it)' }, f.triage.note) as HTMLTextAreaElement;
    const set = (status: string) => act('feedback/triage', { id: f.id, status, note: note.value }, `Marked ${status}.`);
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'row' }, pill(f.triage.status, f.triage.status === 'new' ? 'warn' : f.triage.status === 'done' ? 'good' : ''), f.category ? pill(f.category) : null, h('span', { class: 'muted small grow' }, `${fmtDate(f.createdAt)} · ${f.room ?? 'no room'}`), playerLink(f.profileId, f.playerName ?? (f.profileId ? f.profileId : 'guest'))),
      h('p', { style: 'white-space:pre-wrap' }, f.text),
      f.contact ? h('p', { class: 'small' }, 'Contact: ', f.contact) : null,
      note,
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => set('new') }, 'New'), h('button', { onclick: () => set('seen') }, 'Seen'), h('button', { class: 'primary', onclick: () => set('done') }, 'Done')),
    );
  });
  return [h('h1', null, 'Feedback'), h('div', { class: 'row' }, tabs, q), ...(rows.length ? rows : [h('p', { class: 'muted' }, 'No notes here.')])];
}

// ---------------------------------------------------------------- 6. world

async function viewWorld(): Promise<Node[]> {
  const d = await api('world');
  const overrides = new Map((d.layouts as Json[]).map((l) => [l.room, l.objects]));
  const cap = h('input', { type: 'number', min: '1', max: '16', value: String(d.roomCap.value), style: 'width:80px', 'aria-label': 'Room cap' }) as HTMLInputElement;
  const cart = d.feiraCart as Json;
  return [
    h('h1', null, 'World & areas'),
    h(
      'div',
      { class: 'grid two' },
      card(
        'Feira carts',
        h('p', { class: 'small muted' }, `Carts ship off. Today (${cart.day}): ${cart.featured ? `${cart.featured} is open` : 'every cart is closed'}.`),
        table(
          ['Game', 'Built', 'Mode', ''],
          (cart.games as Json[]).map((g) => [
            `${g.en} (${g.pt})`,
            g.implemented ? 'yes' : 'not yet',
            pill(g.mode, g.mode === 'off' ? '' : 'good'),
            h('div', { class: 'row', style: 'margin:0' }, ...['off', 'on', 'rotation'].map((m) => h('button', { disabled: g.mode === m, onclick: () => act('world/feira-cart', { game: g.id, mode: m }, `${g.en}: ${m}.`) }, m))),
          ]),
        ),
      ),
      card(
        'Room cap',
        h('p', { class: 'small muted' }, 'Players per room instance before a new instance opens (1–16). Applies to the next join.'),
        h(
          'div',
          { class: 'row' },
          cap,
          h('button', { class: 'primary', onclick: () => act('config', { key: 'roomCap', value: Number(cap.value) }, 'Room cap saved.') }, 'Save'),
          d.roomCap.overridden ? h('button', { onclick: () => act('config', { key: 'roomCap', reset: true }, 'Room cap back to default.') }, 'Use server default') : h('span', { class: 'muted small' }, 'server default'),
        ),
        h('h3', null, 'Live instances'),
        table(['Instance', 'Room', 'Players'], (d.instances as Json[]).map((i) => [i.name, i.room, i.players]), { empty: 'No instances open.' }),
      ),
    ),
    card(
      'Rooms and layouts',
      h('p', { class: 'small muted' }, 'Design mode is the level editor, in the game, signed in with this same admin session. Drafts are private; a publish is an override in the database (audited, revertable); reset puts the room back to the layout in the code for everyone.'),
      table(
        ['Room', 'Layout', ''],
        (d.rooms as Json[]).map((r) => [
          `${r.name} (${r.id})`,
          overrides.has(r.id) ? pill(`override · ${overrides.get(r.id)} objects`, 'warn') : pill('code'),
          h(
            'div',
            { class: 'row', style: 'margin:0' },
            h('a', { href: r.designUrl, target: '_blank', rel: 'noopener' }, 'Open in design mode'),
            overrides.has(r.id) ? h('button', { onclick: () => confirm(`Reset ${r.name} to the layout in the code?`) && act('world/layout-reset', { room: r.id }, 'Layout reset.') }, 'Reset layout') : null,
          ),
        ]),
      ),
    ),
  ];
}

// ---------------------------------------------------------------- 7. game variables

async function viewConfig(): Promise<Node[]> {
  const d = await api('config');
  const groups = new Map<string, Json[]>();
  for (const v of d.values as Json[]) groups.set(v.group, [...(groups.get(v.group) ?? []), v]);
  return [
    h('h1', null, 'Game variables'),
    h('p', { class: 'muted' }, 'Each value is read live by the server. Overrides are stored in the database and survive restarts; reset goes back to the shipped default.'),
    ...[...groups].map(([group, vals]) =>
      card(
        group,
        table(
          ['Variable', 'Value', 'Default', 'Range', ''],
          vals.map((v) => {
            const input = h('input', { type: 'number', min: String(v.min), max: String(v.max), value: String(v.value), style: 'width:100px', 'aria-label': v.label }) as HTMLInputElement;
            return [
              h('div', null, h('strong', null, v.label), ' ', v.overridden ? pill('override', 'warn') : null, h('div', { class: 'small muted' }, v.help), v.playerCopy ? h('div', { class: 'small', style: 'color:#b26a00' }, 'Player-facing text still names the default.') : null),
              h('div', { class: 'row', style: 'margin:0' }, input, h('span', { class: 'muted small' }, v.unit)),
              String(v.default),
              `${v.min}–${v.max}`,
              h(
                'div',
                { class: 'row', style: 'margin:0' },
                h('button', { class: 'primary', onclick: () => act('config', { key: v.key, value: Number(input.value) }, `${v.label} saved.`) }, 'Save'),
                v.overridden ? h('button', { onclick: () => act('config', { key: v.key, reset: true }, `${v.label} reset.`) }, 'Reset') : null,
              ),
            ];
          }),
        ),
      ),
    ),
    card('Locked', table(['Variable', 'Value', 'Why'], (d.locked as Json[]).map((l) => [l.label, h('code', null, l.value), h('span', { class: 'small' }, l.why)]))),
  ];
}

// ---------------------------------------------------------------- 8. data

async function viewData(): Promise<Node[]> {
  const d = await api('data/backups');
  return [
    h('h1', null, 'Data'),
    h(
      'div',
      { class: 'grid two' },
      card(
        'Export CSV',
        h('p', { class: 'small muted' }, 'No password or session hashes. Each export is written to the audit log.'),
        h('div', { class: 'row' }, h('a', { href: '/api/admin/data/export?what=accounts' }, h('button', null, 'Accounts CSV')), h('a', { href: '/api/admin/data/export?what=profiles' }, h('button', null, 'Profiles CSV'))),
      ),
      card(
        'Backups',
        h('p', { class: 'small muted' }, 'The server makes one every hour and keeps the newest 48 that fit in 200 MB. A backup file is the whole database, password hashes included: keep downloads private.'),
        h('button', { class: 'primary', onclick: () => act('data/backup', {}, 'Backup made.') }, 'Make a backup now'),
      ),
    ),
    card('Backup files', table(['File', 'Size', 'Made', ''], (d.backups as Json[]).map((b) => [h('code', null, b.name), fmtBytes(b.bytes), `${fmtDate(b.at)} (${fmtAgo(b.at)})`, h('a', { href: `/api/admin/data/backup-file?name=${encodeURIComponent(b.name)}` }, 'Download')]), { empty: 'No backups yet.' })),
  ];
}

// ---------------------------------------------------------------- 9. audit

const auditQuery = { action: '' };

function auditTable(items: Json[]) {
  return table(
    ['#', 'When', 'Who', 'Action', 'Summary', ''],
    items.map((e) => [
      String(e.id),
      fmtDate(e.at),
      e.actor,
      h('code', null, e.action),
      h('div', null, e.summary, e.before || e.after ? h('details', null, h('summary', null, 'before / after'), h('pre', null, JSON.stringify({ before: e.before, after: e.after }, null, 2))) : null),
      e.hasSnapshot
        ? h(
            'div',
            { class: 'row', style: 'margin:0' },
            h('button', { onclick: () => showSnapshot(e.id) }, 'Snapshot'),
            e.action === 'player.reset-progress' || e.action === 'player.delete'
              ? h('button', { onclick: () => confirm(`Restore from audit #${e.id}?`) && act('audit/restore', { id: e.id }, 'Restored.') }, 'Restore')
              : null,
          )
        : '',
    ]),
    { empty: 'No admin changes yet.' },
  );
}

async function showSnapshot(id: number) {
  const r = await api(`audit/entry?id=${id}`).catch((e) => (toast((e as Error).message, true), null));
  if (!r) return;
  const back = h('div', { class: 'dialog-back' });
  back.append(h('div', { class: 'dialog', style: 'width:min(820px,100%)' }, h('h2', null, `Snapshot #${id}`), h('p', { class: 'small muted' }, 'Redacted: no password hash or session token.'), h('pre', null, JSON.stringify(r.entry.snapshot, null, 2)), h('button', { onclick: () => back.remove() }, 'Close')));
  back.addEventListener('click', (e) => e.target === back && back.remove());
  document.body.append(back);
}

async function viewAudit(): Promise<Node[]> {
  const d = await api(`audit?limit=200&action=${encodeURIComponent(auditQuery.action)}`);
  const filter = h(
    'select',
    { 'aria-label': 'Action', onchange: (e: Event) => ((auditQuery.action = (e.target as HTMLSelectElement).value), void route()) },
    h('option', { value: '' }, 'All actions'),
    ...(d.actions as string[]).map((a) => h('option', { value: a, selected: auditQuery.action === a }, a)),
  );
  return [h('h1', null, 'Audit log'), card(null, h('p', { class: 'small muted' }, 'Append-only: the database refuses edits and deletes on this table. Newest first.'), h('div', { class: 'row' }, filter), auditTable(d.items))];
}

void start();
