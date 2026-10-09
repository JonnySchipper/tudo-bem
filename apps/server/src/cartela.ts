import {
  addCalendarDays,
  CARTELA_COPY,
  CARTELA_GOAL,
  normalizeCartela,
  stampsOnDay,
  todayEastern,
  tryCartelaStamp,
  type CartelaActivity,
  type ConversaGrade,
} from '@tudobem/shared';
import type { RoomId } from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import type { Session } from './world.js';
import type { StoredProfile } from './store.js';

export interface CartelaDeps {
  now: () => number;
  store: ProfileStore;
  reward: (s: Session, amount: number, reason: { pt: string; en: string }) => void;
  pushProfile: (s: Session) => void;
  /** Eastern calendar day for stamp limits (default: America/New_York). */
  day?: () => string;
}

/** Server-side cartela: stamps from bairro activities, pays on the 7th, persists on the profile. */
export class CartelaTracker {
  constructor(private readonly d: CartelaDeps) {}

  private day() {
    return this.d.day?.() ?? todayEastern(this.d.now());
  }

  private of(p: StoredProfile) {
    p.cartela = normalizeCartela(p.cartela);
    return p.cartela;
  }

  private emit(s: Session, activity: CartelaActivity, stamps: number, todayCount: number, paid: boolean) {
    s.send({ t: 'cartela', stamps, todayCount, activity, paid });
  }

  tryStamp(s: Session, activity: CartelaActivity): boolean {
    const p = s.profile;
    if (!p) return false;
    const day = addCalendarDays(this.day(), p.testDayOffset ?? 0);
    const cur = this.of(p);
    const res = tryCartelaStamp(cur, activity, day);
    if (!res.ok) return false;
    p.cartela = res.next;
    this.d.store.save(p.id);
    const shown = res.paid ? CARTELA_GOAL : res.next.stamps;
    this.emit(s, activity, shown, stampsOnDay(res.next, day), res.paid);
    if (res.paid) {
      this.d.reward(s, res.reward, {
        pt: CARTELA_COPY.paid.pt,
        en: CARTELA_COPY.paid.en,
      });
    } else {
      this.d.pushProfile(s);
    }
    return true;
  }

  /** Finished jiu-jitsu roll (at least one beat played). */
  onBoutEnd(s: Session, played: boolean) {
    if (played) this.tryStamp(s, 'tatame');
  }

  /** Finished padaria counter shift with at least one customer served. */
  onCorreriaEnd(s: Session, served: number) {
    if (served >= 1) this.tryStamp(s, 'balcao');
  }

  /** Stepped into the feira map (join), not just walking past the door on the street. */
  onEntered(s: Session, room: RoomId) {
    if (room === 'feira') this.tryStamp(s, 'feira');
  }

  /** Real Conversa in the praça (HTTP flow finished); small talk chips do not call this. */
  onConversaEnd(s: Session, _grade: ConversaGrade) {
    if (s.instance?.def.id !== 'praca') return;
    this.tryStamp(s, 'conversa');
  }
}
