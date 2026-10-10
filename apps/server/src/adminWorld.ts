/**
 * The admin dashboard's handle on the live world (World.adminHost). Profile writes happen in adminOps.ts on the same
 * in-memory objects the world plays with; this bridge pushes the result to whoever is online. Browser-safe (world.ts imports it).
 */
import {
  ADMIN_KICKED_COPY,
  BANNED_COPY,
  type Bilingual,
  type FeiraCartAdminGame,
  type FeiraCartMode,
  type Nameplate,
  type PropDef,
  type RoomId,
  type SafetyVerdict,
  type ServerMsg,
} from '@tudobem/shared';
import type { CloseReason, Instance, Session } from './world.js';
import type { LayoutStore } from './layoutStore.js';
import type { PublishResult } from './designGithub.js';

export interface AdminWorldDeps {
  sessions: () => Iterable<Session>;
  instances: () => Iterable<Instance>;
  sessionByProfile: (id: string) => Session | undefined;
  pushProfile: (s: Session) => void;
  broadcastAvatar: (s: Session) => void;
  kick: (s: Session, reason: CloseReason, last?: ServerMsg) => void;
  dropAccount: (accountId: string) => void;
  forgetAccount: (accountId: string, profileId?: string) => void;
  classify: (text: string, nameplate: Nameplate) => Promise<SafetyVerdict>;
  feiraCartView: () => { day: string; featured: string | null; games: FeiraCartAdminGame[] };
  setFeiraCart: (game: string, mode: FeiraCartMode) => boolean;
  layoutOverrides: () => { room: RoomId; objects: number }[];
  revertLayout: (room: RoomId) => boolean;
  /** Design mode (designOps.ts): the saved layouts, drafts and history. */
  layouts: () => LayoutStore;
  /** Install a stored layout in this process and push it to every client. `null`: the code layout. */
  applyLayout: (room: RoomId, objects: PropDef[] | null) => void;
  githubConfigured: () => boolean;
  layoutPullRequest: (room: RoomId, objects: PropDef[]) => Promise<PublishResult>;
  markBoardsDirty: () => void;
  now: () => number;
}

export interface OnlinePlayer {
  profileId: string;
  name: string;
  accountId: string | null;
  room: RoomId | null;
  instanceId: string | null;
  instanceName: string | null;
  idleMs: number;
}

export interface AdminWorldHost {
  online(): OnlinePlayer[];
  instances(): { id: string; room: RoomId; name: string; players: number; cpus: number }[];
  isOnline(profileId: string): boolean;
  /** A profile changed under the admin: push it (and the avatar, for looks) to that player if they are online. */
  changed(profileId: string, opts?: { avatar?: boolean }): void;
  /** RV moved: the HUD counter animates like any other reward, and a take shows a notice. */
  coins(profileId: string, delta: number, coins: number, reason: Bilingual): void;
  notify(profileId: string, level: 'info' | 'warn', copy: Bilingual): void;
  /** Close the profile's socket. False when it is not online. */
  kick(profileId: string, reason: 'admin' | 'banned'): boolean;
  dropAccount(accountId: string): void;
  forgetAccount(accountId: string, profileId?: string): void;
  classify(text: string, nameplate: Nameplate): Promise<SafetyVerdict>;
  feiraCartView: AdminWorldDeps['feiraCartView'];
  setFeiraCart: AdminWorldDeps['setFeiraCart'];
  layoutOverrides: AdminWorldDeps['layoutOverrides'];
  revertLayout: AdminWorldDeps['revertLayout'];
  layouts: AdminWorldDeps['layouts'];
  applyLayout: AdminWorldDeps['applyLayout'];
  githubConfigured: AdminWorldDeps['githubConfigured'];
  layoutPullRequest: AdminWorldDeps['layoutPullRequest'];
  markBoardsDirty(): void;
  now(): number;
}

export function adminWorldHost(d: AdminWorldDeps): AdminWorldHost {
  return {
    online() {
      const t = d.now();
      const out: OnlinePlayer[] = [];
      for (const s of d.sessions()) {
        if (!s.profile) continue;
        out.push({
          profileId: s.profile.id,
          name: s.profile.name,
          accountId: s.accountId ?? null,
          room: s.instance?.def.id ?? null,
          instanceId: s.instance?.id ?? null,
          instanceName: s.instance?.name ?? null,
          idleMs: Math.max(0, t - s.lastActiveAt),
        });
      }
      return out.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    },
    instances() {
      return [...d.instances()].map((i) => ({ id: i.id, room: i.def.id, name: i.name, players: i.members.size, cpus: i.crowd?.size ?? 0 }));
    },
    isOnline: (id) => !!d.sessionByProfile(id)?.profile,
    changed(id, opts) {
      d.markBoardsDirty();
      const s = d.sessionByProfile(id);
      if (!s?.profile) return;
      d.pushProfile(s);
      if (opts?.avatar && s.instance) d.broadcastAvatar(s);
    },
    coins(id, delta, coins, reason) {
      const s = d.sessionByProfile(id);
      if (!s?.profile) return;
      if (delta > 0) s.send({ t: 'reward', amount: delta, coins, reason });
      else s.send({ t: 'notice', level: 'info', ...reason });
      d.pushProfile(s);
    },
    notify(id, level, copy) {
      d.sessionByProfile(id)?.send({ t: 'notice', level, pt: copy.pt, en: copy.en });
    },
    kick(id, reason) {
      const s = d.sessionByProfile(id);
      if (!s?.profile) return false;
      d.kick(s, reason, { t: 'kicked', reason, ...(reason === 'banned' ? BANNED_COPY : ADMIN_KICKED_COPY) });
      return true;
    },
    dropAccount: d.dropAccount,
    forgetAccount: d.forgetAccount,
    classify: d.classify,
    feiraCartView: d.feiraCartView,
    setFeiraCart: d.setFeiraCart,
    layoutOverrides: d.layoutOverrides,
    revertLayout: d.revertLayout,
    layouts: d.layouts,
    applyLayout: d.applyLayout,
    githubConfigured: d.githubConfigured,
    layoutPullRequest: d.layoutPullRequest,
    markBoardsDirty: d.markBoardsDirty,
    now: d.now,
  };
}
