/**
 * Admin panel: moderation review (reports with the server's snapshot of what the target said, Jev flags),
 * the banned list, and the mute / ban buttons the player rows and report rows share.
 */
import { REPORT_REASON_LABELS, type AdminBannedRow, type ClientMsg, type ModerationRow } from '@tudobem/shared';
import { h, en } from './dom';

type AdminSend = (m: Extract<ClientMsg, { t: 'admin' }>) => void;

let send: AdminSend | null = null;
let listEl: HTMLElement | null = null;
let bannedEl: HTMLElement | null = null;

export const MUTE_MINUTES = 60;

/** Mute / ban buttons for one player (online row or report target). */
export function moderationButtons(targetId: string, name: string): HTMLElement {
  return h(
    'span',
    { class: 'admin-sub-actions' },
    h('button', { type: 'button', class: 'ghost', 'data-mute': targetId, onclick: () => send?.({ t: 'admin', action: 'mute', targetId, minutes: MUTE_MINUTES }) }, `Mute ${MUTE_MINUTES}m`),
    h(
      'button',
      {
        type: 'button',
        class: 'ghost',
        'data-ban': targetId,
        onclick: () => {
          if (confirm(`Banir ${name}? A conta não entra mais até você desfazer.`)) send?.({ t: 'admin', action: 'ban', targetId });
        },
      },
      'Ban',
    ),
  );
}

/** The moderation + banned sections, and asks the server for both. */
export function adminModerationSection(sendAdmin: AdminSend | null): HTMLElement[] {
  send = sendAdmin;
  listEl = h('div', { class: 'admin-moderation', id: 'admin-moderation' }, h('p', { class: 'admin-empty' }, 'Carregando…'));
  bannedEl = h('div', { class: 'admin-banned', id: 'admin-banned' }, h('p', { class: 'admin-empty' }, '…'));
  send?.({ t: 'admin', action: 'moderation' });
  send?.({ t: 'admin', action: 'banned' });
  return [
    h('h3', { id: 'admin-moderation-title' }, 'Moderação'),
    en('Reports and flagged chat, newest first. Report lines are what the server delivered, not what the reporter sent.', true),
    listEl,
    h('button', { class: 'ghost', id: 'admin-moderation-refresh', type: 'button', onclick: () => send?.({ t: 'admin', action: 'moderation' }) }, 'Atualizar moderação'),
    h('h3', null, 'Banidos'),
    en('Banned accounts cannot enter until unbanned.', true),
    bannedEl,
  ];
}

export function renderModeration(items: ModerationRow[]): void {
  if (!listEl) return;
  listEl.replaceChildren();
  if (!items.length) {
    listEl.append(h('p', { class: 'admin-empty' }, 'Nada pra revisar.'));
    return;
  }
  // Reports first: those are people asking for help.
  const sorted = [...items.filter((i) => i.kind === 'report'), ...items.filter((i) => i.kind !== 'report')];
  for (const row of sorted.slice(0, 60)) {
    const when = new Date(row.at).toISOString().slice(5, 16).replace('T', ' ');
    const reason = row.reason ? REPORT_REASON_LABELS[row.reason].pt : row.labels.join(', ');
    const head =
      row.kind === 'report'
        ? `${row.playerName} denunciou ${row.targetName ?? row.targetId ?? '?'} · ${reason}`
        : `${row.kind} · ${row.playerName} · ${reason}`;
    const lines = row.kind === 'report' ? (row.lines?.length ? row.lines : ['(sem falas recentes)']) : [row.text];
    const who = row.kind === 'report' ? row.targetId : row.playerId;
    const whoName = row.kind === 'report' ? (row.targetName ?? '?') : row.playerName;
    listEl.append(
      h(
        'div',
        { class: 'admin-player admin-mod-row', 'data-kind': row.kind },
        h(
          'div',
          { class: 'admin-player-who' },
          h('b', null, head),
          h('span', { class: 'admin-player-room' }, `${when} · ${row.room}`),
          ...lines.map((l) => h('q', { class: 'admin-mod-line', style: 'display:block' }, l)),
        ),
        who ? moderationButtons(who, whoName) : null,
      ),
    );
  }
}

export function renderBanned(rows: AdminBannedRow[]): void {
  if (!bannedEl) return;
  bannedEl.replaceChildren();
  if (!rows.length) {
    bannedEl.append(h('p', { class: 'admin-empty' }, 'Ninguém banido.'));
    return;
  }
  for (const row of rows) {
    bannedEl.append(
      h(
        'div',
        { class: 'admin-player', 'data-banned': row.id },
        h('div', { class: 'admin-player-who' }, h('b', null, row.name), h('span', { class: 'admin-player-room' }, new Date(row.at).toISOString().slice(0, 10))),
        h('button', { type: 'button', class: 'primary', 'data-unban': row.id, onclick: () => send?.({ t: 'admin', action: 'unban', targetId: row.id }) }, 'Desbanir'),
      ),
    );
  }
}
