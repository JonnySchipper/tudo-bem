/**
 * Phase 0 chat safety — a deterministic stand-in for the Jev classifier.
 *
 * Pipeline (GDD §2.4): PII regex → label classify (blocklists EN+PT + context rules) → action.
 * The same function runs on the client (instant feedback) and on the server (authoritative).
 * Swap for a real Jev gateway behind the `ChatSafetyService` interface on the server.
 */

export type SafetyAction = 'allow' | 'warn' | 'block' | 'escalate';

export type SafetyLabel =
  | 'pii'
  | 'off_platform_contact'
  | 'slur'
  | 'profanity'
  | 'sexual'
  | 'dating'
  | 'prohibited_substance'
  | 'politics'
  | 'scam'
  | 'bullying'
  | 'self_harm'
  | 'spam';

export interface SafetyVerdict {
  action: SafetyAction;
  labels: SafetyLabel[];
  /** Text safe to broadcast (masked for warn); empty for block/escalate. */
  text: string;
  /** Friendly note shown to the sender (PT + EN gloss). */
  note?: { pt: string; en: string };
}

const MASK = '•••';

/** Lowercase, strip accents, undo common leetspeak, collapse 3+ repeated letters. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[013457@$]/g, (c) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' })[c] ?? c)
    .replace(/(.)\1{2,}/g, '$1');
}

interface Rule {
  label: SafetyLabel;
  action: Exclude<SafetyAction, 'allow'>;
  /** Whole-word terms (normalized). Multi-word terms allowed. */
  terms?: string[];
  /** Regex tested against normalized text. */
  patterns?: RegExp[];
}

const RULES: Rule[] = [
  {
    label: 'self_harm',
    action: 'escalate',
    terms: ['kill myself', 'want to die', 'quero morrer', 'vou me matar', 'quero me matar', 'suicide', 'suicidio', 'cut myself'],
  },
  {
    label: 'bullying',
    action: 'escalate',
    terms: ['kill yourself', 'kys', 'se mata', 'vai se matar', 'go die'],
  },
  {
    label: 'slur',
    action: 'block',
    terms: [
      'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny', 'chink', 'spic', 'kike', 'wetback', 'coon', 'dyke',
      'viado', 'bicha', 'sapatao', 'traveco', 'retardado', 'retardada', 'crioulo', 'macaco imundo', 'seu macaco', 'sua macaca',
    ],
  },
  {
    label: 'sexual',
    action: 'block',
    terms: [
      // Not listed on purpose: "pelada" (pickup football), "rola" (slang: "happens"), "pinto" (chick).
      'sex', 'sexy', 'nude', 'nudes', 'naked', 'porn', 'porno', 'horny', 'boobs', 'tits', 'penis', 'vagina', 'sexo', 'pelado',
      'tesao', 'peitos', 'safadinha', 'safadinho',
    ],
    // "gostoso/gostosa" is normal for food; only block when aimed at a person.
    patterns: [/\b(vc|voce|tu|ela|ele|you)\s+(e|eh|ta|esta|is|are|r)\s+(muito\s+)?(gostos[oa]|hot)\b/],
  },
  {
    label: 'dating',
    action: 'block',
    terms: [
      'namora comigo', 'namorar comigo', 'quer namorar', 'sair comigo', 'me beija', 'kiss me', 'date me', 'go out with me',
      'be my girlfriend', 'be my boyfriend', 'seja minha namorada', 'seja meu namorado', 'ficar comigo',
    ],
  },
  {
    label: 'profanity',
    action: 'block',
    terms: [
      'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'pussy', 'cock', 'whore',
      'slut', 'porra', 'caralho', 'merda', 'puta', 'foda', 'foder', 'fodase', 'foda se', 'cu', 'buceta', 'boceta', 'bosta',
      'arrombado', 'arrombada', 'desgracado', 'desgracada', 'filho da puta', 'fdp', 'vsf', 'vtnc', 'pqp', 'cacete', 'piranha',
    ],
  },
  {
    label: 'scam',
    action: 'block',
    terms: [
      'free coins', 'free rv', 'moedas gratis', 'rv gratis', 'your password', 'sua senha', 'password', 'senha', 'credit card',
      'cartao de credito', 'pix', 'venmo', 'paypal', 'cashapp', 'gift card', 'dinheiro real',
    ],
  },
  {
    label: 'off_platform_contact',
    action: 'block',
    terms: [
      'add me on', 'me adiciona no', 'me add no', 'my number', 'meu numero', 'meu zap', 'me chama no', 'text me',
      'dm me', 'follow me on', 'me segue no',
    ],
  },
  {
    label: 'off_platform_contact',
    action: 'warn',
    terms: ['discord', 'whatsapp', 'zap', 'zapzap', 'insta', 'instagram', 'snapchat', 'telegram', 'tiktok', 'facebook', 'kik', 'skype', 'twitter'],
  },
  {
    label: 'prohibited_substance',
    action: 'warn',
    terms: [
      // "vinho" is also a color (wine-red), so only the English noun is listed.
      'cerveja', 'cerva', 'breja', 'beer', 'beers', 'vodka', 'cachaca', 'caipirinha', 'pinga', 'wine', 'whisky', 'whiskey',
      'tequila', 'drunk', 'bebado', 'bebada', 'bebum', 'chope', 'chopp', 'boteco', 'maconha', 'weed', 'cocaine', 'cocaina', 'drogas',
      'drugs', 'vape', 'cigarro', 'cigarette',
    ],
  },
  {
    label: 'politics',
    action: 'warn',
    // Bare "lula" is squid on a menu; only the political uses are listed.
    terms: ['bolsonaro', 'presidente lula', 'lula presidente', 'lula livre', 'trump', 'biden', 'kamala', 'eleicao', 'election', 'comunista', 'communist', 'fascista', 'fascist', 'petista', 'bolsominion'],
  },
  {
    label: 'bullying',
    action: 'warn',
    terms: ['idiota', 'burra', 'imbecil', 'babaca', 'otario', 'otaria', 'stupid', 'idiot', 'loser', 'dumb', 'shut up', 'cala a boca', 'ninguem gosta de voce', 'nobody likes you', 'you are ugly', 'voce e feio', 'voce e feia'],
  },
];

/** Words that must never trip the filter even if a rule changes (GDD §15.4 false-block watch). */
export const ALLOWLIST = ['ta', 'cara', 'legal', 'nossa', 'caramba', 'putz', 'direita', 'esquerda', 'bicho', 'gostoso', 'gostosa', 'beijo', 'beijos', 'massa', 'bora', 'valeu', 'passar', 'class', 'assistir', 'cocada'];

const PII: { label: SafetyLabel; re: RegExp }[] = [
  { label: 'pii', re: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  { label: 'pii', re: /(?:\+?\d[\s().-]*){7,}/ },
  { label: 'pii', re: /\b(https?:\/\/|www\.)\S+/i },
  { label: 'pii', re: /\b[\w-]+\.(com|net|org|br|io|gg|me|tv|app|xyz|ly)\b/i },
  { label: 'off_platform_contact', re: /(^|\s)@[a-z0-9_.]{2,}/i },
  { label: 'pii', re: /\b(rua|avenida|av\.|travessa|alameda|estrada|street|avenue|road|lane|drive)\s+[\p{L}\s]{2,30}\d{1,5}\b/iu },
  { label: 'pii', re: /\b\d{1,5}\s+[\p{L}]+\s+(street|st|avenue|ave|road|rd|lane|drive|dr)\b/iu },
  // Country/city is fine ("where are you from" is a lesson); school, street and full names are not.
  { label: 'pii', re: /\b(my school is|i go to .{0,20}school|i study at|minha escola (e|é)|eu estudo n[oa] (escola|colégio|colegio)|meu col[eé]gio (e|é)|i live (at|on) \d|moro na rua)/i },
  { label: 'pii', re: /\b(my (real|full) name is|meu nome (real|completo)|my last name|my surname|meu sobrenome)/i },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function termRegex(term: string): RegExp {
  const body = term.split(' ').map(esc).join('[\\s.,_-]+');
  return new RegExp(`(^|[^a-z0-9])(${body})(?=$|[^a-z0-9])`, 'g');
}

interface CompiledRule extends Rule {
  termRes: RegExp[];
  patternRes: RegExp[];
}

const COMPILED: CompiledRule[] = RULES.map((r) => ({
  ...r,
  termRes: (r.terms ?? []).map(termRegex),
  patternRes: (r.patterns ?? []).map((p) => new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g')),
}));

const NOTES: Record<SafetyLabel, { pt: string; en: string }> = {
  pii: { pt: 'Opa! Nada de dados pessoais aqui, tá?', en: 'Oops! No personal info here, okay? (phone, address, school, links)' },
  off_platform_contact: { pt: 'Vamos conversar aqui mesmo na praça!', en: 'Let’s keep chatting here in the world — no outside contacts.' },
  slur: { pt: 'Essa palavra não rola aqui.', en: 'That word isn’t allowed here.' },
  profanity: { pt: 'Sem palavrão, por favor!', en: 'No swearing, please!' },
  sexual: { pt: 'Esse assunto não é pra praça.', en: 'That topic isn’t for this space.' },
  dating: { pt: 'Aqui é lugar de amizade — sem paquera!', en: 'This is a friendship space — no flirting or dating.' },
  prohibited_substance: { pt: 'Aqui a gente fica no suco e no guaraná!', en: 'We stick to juice and guaraná here! (word hidden)' },
  politics: { pt: 'Sem política na praça, tá? Só diversão!', en: 'No politics in the square, okay? Just fun! (word hidden)' },
  scam: { pt: 'Cuidado! Nunca compartilhe senhas ou dinheiro.', en: 'Careful! Never share passwords or money.' },
  bullying: { pt: 'Vamos ser gentis uns com os outros!', en: 'Let’s be kind to each other! (word hidden)' },
  self_harm: {
    pt: 'Você é importante. Fale com um adulto de confiança.',
    en: 'You matter. Please talk to a trusted adult or a local helpline (US: call/text 988). A moderator has been notified.',
  },
  spam: { pt: 'Calma! Uma mensagem de cada vez.', en: 'Easy! One message at a time.' },
};

const SEVERITY: Record<SafetyAction, number> = { allow: 0, warn: 1, block: 2, escalate: 3 };

/** Map normalized-string match indices back to the original text (lengths match except NFD marks). */
function maskOriginal(original: string, spans: [number, number][]): string {
  if (!spans.length) return original;
  // Build index map from normalized chars to original chars.
  const map: number[] = [];
  const lowered = original.toLowerCase();
  let norm = '';
  for (let i = 0; i < lowered.length; i++) {
    const n = lowered[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const ch of n) {
      norm += ch;
      map.push(i);
    }
  }
  const chars = original.split('');
  const hit = new Array(chars.length).fill(false);
  for (const [s, e] of spans) for (let j = s; j < e && j < map.length; j++) hit[map[j]] = true;
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    if (hit[i]) {
      if (!hit[i - 1]) out += MASK;
    } else out += chars[i];
  }
  return out;
}

export function classifyChat(raw: string): SafetyVerdict {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return { action: 'block', labels: ['spam'], text: '' };

  const labels = new Set<SafetyLabel>();
  let action: SafetyAction = 'allow';
  const bump = (a: SafetyAction, l: SafetyLabel) => {
    labels.add(l);
    if (SEVERITY[a] > SEVERITY[action]) action = a;
  };

  for (const p of PII) if (p.re.test(text)) bump('block', p.label);

  // Leet-normalized copy for blocklists; keep a non-collapsed copy for masking offsets.
  const norm = normalize(text);
  const plain = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const maskSpans: [number, number][] = [];

  for (const rule of COMPILED) {
    let matched = false;
    for (const re of rule.termRes) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(norm))) {
        const term = m[2];
        if (ALLOWLIST.includes(term)) continue;
        matched = true;
        if (rule.action !== 'warn') continue;
        // Mask in the accent-stripped text; offsets there line up with the original.
        const tr = termRegex(term.replace(/[\s.,_-]+/g, ' '));
        let pm: RegExpExecArray | null;
        let found = false;
        while ((pm = tr.exec(plain))) {
          const s = pm.index + pm[1].length;
          maskSpans.push([s, s + pm[2].length]);
          found = true;
        }
        if (!found) {
          const s = m.index + m[1].length;
          maskSpans.push([s, s + term.length]);
        }
      }
    }
    for (const re of rule.patternRes) {
      re.lastIndex = 0;
      if (re.test(norm)) matched = true;
    }
    if (matched) bump(rule.action, rule.label);
  }

  // Shouting / char-spam heuristic.
  if (/(.)\1{7,}/.test(text) || (text.length > 24 && text === text.toUpperCase() && /[A-Z]{12,}/.test(text))) bump('warn', 'spam');

  const ordered = [...labels].sort((a, b) => labelWeight(b) - labelWeight(a));
  const top = ordered[0];
  if (action === 'allow') return { action, labels: [], text };
  if (action === 'warn') {
    const masked = maskOriginal(text, maskSpans);
    const finalText = labels.has('spam') && maskSpans.length === 0 ? text.toLowerCase() : masked;
    return { action, labels: ordered, text: finalText, note: NOTES[top] };
  }
  return { action, labels: ordered, text: '', note: NOTES[top] };
}

function labelWeight(l: SafetyLabel): number {
  const order: SafetyLabel[] = ['spam', 'politics', 'prohibited_substance', 'bullying', 'off_platform_contact', 'dating', 'profanity', 'scam', 'pii', 'sexual', 'slur', 'self_harm'];
  return order.indexOf(l);
}

/** Display names and room names: must be fully clean (no warn). */
export function validateName(raw: string, maxLen = 16): { ok: true; name: string } | { ok: false; reason: { pt: string; en: string } } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > maxLen)
    return { ok: false, reason: { pt: `O nome precisa ter de 2 a ${maxLen} letras.`, en: `Name must be 2–${maxLen} characters.` } };
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name))
    return { ok: false, reason: { pt: 'Use só letras, números e espaços.', en: 'Letters, numbers and spaces only.' } };
  if (/\d{4,}/.test(name)) return { ok: false, reason: { pt: 'Nada de números longos no nome.', en: 'No long numbers in names (could be personal info).' } };
  const v = classifyChat(name);
  if (v.action !== 'allow') return { ok: false, reason: { pt: 'Escolha outro nome, por favor.', en: 'Please choose a different name.' } };
  return { ok: true, name };
}
