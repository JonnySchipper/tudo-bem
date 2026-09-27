import type {
  Appearance,
  Bilingual,
  EmoteKind,
  FriendInfo,
  PlacedFurniture,
  PrivateProfile,
  Pronoun,
  PublicAvatar,
  RoomId,
  Tile,
  TutorialStep,
} from './types.js';
import type { SceneView } from './carlos.js';
import type { MgBuiltUnit, MgOrderLine, MgOutcome, Tray } from './meveum.js';
import type { SafetyAction } from './safety.js';
import type { NpcId } from './rooms.js';
import type { ConversaGrade, ConversaMeter, ConversaScores, ConversaSubject } from './conversa.js';
import type { BjjProgress, RollPuzzleView } from './academia.js';

/** Client → server messages. JSON over a single WebSocket at /ws. */
export type ClientMsg =
  | { t: 'hello'; token?: string }
  | { t: 'createProfile'; name: string; pronoun: Pronoun; appearance: Appearance }
  /** Real player input (pointer / key / touch) since the last report. Resets the server idle clock; `ping` never does. */
  | { t: 'active' }
  | { t: 'updateAppearance'; appearance: Appearance }
  | { t: 'join'; room: RoomId; instanceId?: string; ownerId?: string }
  | { t: 'move'; x: number; y: number; sit?: boolean }
  | { t: 'stand' }
  | { t: 'emote'; kind: EmoteKind }
  | { t: 'chat'; text: string }
  | { t: 'report'; targetId: string; text?: string }
  | { t: 'portal'; portalId: string }
  | { t: 'scene'; action: 'start'; npc: NpcId }
  | { t: 'scene'; action: 'choose'; chip: number }
  | { t: 'scene'; action: 'type'; text: string }
  | { t: 'scene'; action: 'close' }
  | { t: 'conversa'; action: 'start'; npc: NpcId; subjectId?: string }
  | { t: 'conversa'; action: 'say'; text: string }
  | { t: 'conversa'; action: 'chip'; chip: number }
  | { t: 'conversa'; action: 'close' }
  | { t: 'mg'; action: 'start' }
  | { t: 'mg'; action: 'submit'; tray: Tray; mods?: string[]; built?: MgBuiltUnit[] }
  | { t: 'mg'; action: 'timeout' }
  | { t: 'mg'; action: 'quit' }
  | { t: 'mg'; action: 'sync' }
  | { t: 'buy'; kind: 'hat' | 'furniture'; itemId: string }
  | { t: 'equipHat'; hatId: string | null }
  | { t: 'parrot'; action: 'adopt' | 'toggle' | 'hint' }
  | { t: 'furniture'; action: 'place'; itemId: string; x: number; y: number; rot: 0 | 1 }
  | { t: 'furniture'; action: 'move'; uid: string; x: number; y: number; rot: 0 | 1 }
  | { t: 'furniture'; action: 'pickup'; uid: string }
  | { t: 'friend'; action: 'request' | 'accept' | 'decline' | 'remove'; targetId: string }
  | { t: 'friends' }
  | { t: 'mission'; action: 'take' }
  | { t: 'roll'; action: 'queue' }
  | { t: 'roll'; action: 'cancel' }
  | { t: 'roll'; action: 'answer'; choice: number }
  | { t: 'roll'; action: 'answer'; order: number[] }
  | { t: 'roll'; action: 'timeout' }
  | { t: 'roll'; action: 'rematch' }
  | { t: 'roll'; action: 'quit' }
  | { t: 'ping' };

export interface RoomStateMsg {
  t: 'roomState';
  room: RoomId;
  instanceId: string;
  instanceName: string;
  ownerId: string | null;
  ownerName: string | null;
  cap: number;
  selfId: string;
  avatars: PublicAvatar[];
  furniture: PlacedFurniture[];
}

export type NoticeLevel = 'info' | 'warn' | 'block' | 'reward' | 'error';

export type MgServerMsg =
  | {
      t: 'mg';
      phase: 'order';
      round: number;
      rounds: number;
      customer: string;
      pt: string;
      en: string;
      timeMs: number;
      repeat: boolean;
      points: number;
      streak: number;
      mods: string[];
      /** Item ids + qty for station batch buttons (server still validates submit). */
      lines: MgOrderLine[];
      resync?: boolean;
    }
  | { t: 'mg'; phase: 'result'; round: number; outcome: MgOutcome | 'repita'; carlos: Bilingual; expected?: MgOrderLine[]; expectedMods?: string[]; points: number; streak: number }
  | { t: 'mg'; phase: 'end'; points: number; coins: number; perfect: number; rounds: number; carlos: Bilingual };

/**
 * Conversa (GDD §5.6). Only ever sent to the player having the conversation — never broadcast.
 * `mode` is 'ai' for generative turns, 'authored' for the Carlos graph fallback.
 */
export type ConversaServerMsg =
  | {
      t: 'conversa';
      phase: 'open';
      npc: NpcId;
      npcName: string;
      subject: ConversaSubject;
      mode: 'ai' | 'authored';
      offline: boolean;
      line: Bilingual;
      chips: Bilingual[];
      turn: number;
      maxTurns: number;
    }
  | { t: 'conversa'; phase: 'said'; text: string; turn: number; maxTurns: number }
  | { t: 'conversa'; phase: 'rejected'; pt: string; en: string }
  | {
      t: 'conversa';
      phase: 'turn';
      mode: 'ai' | 'authored';
      offline: boolean;
      line: Bilingual;
      chips: Bilingual[];
      scores: ConversaScores;
      meter: ConversaMeter;
      tip: Bilingual | null;
      turn: number;
      maxTurns: number;
    }
  | {
      t: 'conversa';
      phase: 'end';
      mode: 'ai' | 'authored';
      offline: boolean;
      line: Bilingual;
      scores: ConversaScores;
      meter: ConversaMeter;
      tip: Bilingual | null;
      grade: ConversaGrade;
      gradeLabel: Bilingual;
      payout: number;
      reason: 'natural' | 'cap' | 'early';
      turn: number;
      maxTurns: number;
    }
  | { t: 'conversa'; phase: 'blocked'; reason: 'daily' | 'unavailable'; pt: string; en: string };

export type RollServerMsg =
  | { t: 'roll'; phase: 'queue'; waitMs: number; opponent: 'cpu' | null }
  | { t: 'roll'; phase: 'bow'; line: Bilingual }
  | {
      t: 'roll';
      phase: 'duel';
      round: number;
      maxRounds: number;
      puzzle: RollPuzzleView;
      timeMs: number;
      playerIdx: number;
      cpuIdx: number;
      positionPt: string;
      positionEn: string;
      submissionPt: string | null;
      submissionEn: string | null;
      /** Test / CI only when TB_TEST_ROLL=1 on server. */
      debugCorrect?: number | number[];
    }
  | {
      t: 'roll';
      phase: 'scramble';
      advance: 'player' | 'cpu' | 'none';
      line: Bilingual;
      playerIdx: number;
      cpuIdx: number;
      positionPt: string;
      positionEn: string;
    }
  | {
      t: 'roll';
      phase: 'end';
      winner: 'player' | 'cpu' | 'draw';
      reason: 'submission' | 'decisao';
      rv: number;
      bjj: BjjProgress;
      line: Bilingual;
      fistBump: Bilingual;
    };

/** Server → client messages. */
export type ServerMsg =
  | { t: 'welcome'; profile: PrivateProfile; token: string }
  | { t: 'needProfile' }
  | { t: 'idleWarning'; msLeft: number; pt: string; en: string }
  /** Sent right before the server closes the socket (code 4001) to free the seat. */
  | { t: 'kicked'; reason: 'idle'; pt: string; en: string }
  | { t: 'profile'; profile: PrivateProfile }
  | RoomStateMsg
  | { t: 'avatarJoined'; avatar: PublicAvatar }
  | { t: 'avatarLeft'; id: string }
  | { t: 'avatarMoved'; id: string; from: Tile; path: Tile[]; sit: boolean }
  | { t: 'avatarUpdated'; avatar: PublicAvatar }
  | { t: 'emote'; id: string; kind: EmoteKind }
  | { t: 'chat'; id: string; name: string; text: string; gloss: string | null; lang: 'pt' | 'en' | 'mix'; action: SafetyAction }
  | { t: 'notice'; level: NoticeLevel; pt: string; en: string }
  | { t: 'reward'; amount: number; coins: number; reason: Bilingual }
  | {
      t: 'scene';
      view: SceneView;
      lastScore?: 0 | 1 | 2 | 3;
      feedback?: Bilingual;
      said?: Bilingual;
      /** False when Gate A warned — echo only, do not slot-parse into the Pedido ticket. */
      fillTicket?: boolean;
      /** Gate A backstop toast when the client did not already show one. */
      notice?: { level: 'warn' | 'block'; pt: string; en: string };
      payout?: number;
      dailyBlocked?: boolean;
    }
  | MgServerMsg
  | ConversaServerMsg
  | RollServerMsg
  | { t: 'furnitureState'; furniture: PlacedFurniture[] }
  | { t: 'friends'; friends: FriendInfo[]; incoming: { id: string; name: string }[] }
  | { t: 'friendRequest'; fromId: string; fromName: string }
  | { t: 'parrotHint'; word: Bilingual }
  | { t: 'tutorial'; step: TutorialStep }
  | { t: 'error'; code: string; pt: string; en: string }
  | { t: 'pong' };
