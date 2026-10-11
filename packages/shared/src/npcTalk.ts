import type { NpcId } from './rooms.js';
import type { Bilingual } from './types.js';
import { GREETING_EN, greetingCap, greetingFor } from './clock.js';

/**
 * Short authored greetings (Nanda, Júlia, Dona Graça, Professora Bia): 3 lines, two reply chips each, A1 informal Brazilian
 * Portuguese. They are client-side flows (no rewards, no server authority); the client tells the server with a `talk` message so the
 * recado engine's `talked` event fires. Every PT string here is new content: `needs_br: true`.
 *
 * `{obrigad}` in a chip is filled with obrigado / obrigada from the player's pronoun, `{nome}` with the player's name (only from 2 hearts: before
 * that the NPC does not know it, and ", {nome}" is dropped), `{saudacao}` / `{greeting}` with the PT / EN greeting that fits the game hour.
 */
export interface TalkChip {
  pt: string;
  en: string;
  /** Next node id, or `end` (close), `help` (Júlia's tutorial menu), `shop` (Nanda's hat shop). */
  next: string;
}
export interface TalkNode {
  line: Bilingual;
  chips: TalkChip[];
}
export interface NpcTalk {
  start: string;
  nodes: Record<string, TalkNode>;
}

export const NPC_TALK: Partial<Record<NpcId, NpcTalk>> = {
  nanda: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Tudo bem? Eu sou a Nanda.', en: '{greeting}, {nome}! How’s it going? I’m Nanda.' },
        chips: [
          { pt: '{saudacao}, Nanda! Tudo bem!', en: '{greeting}, Nanda! All good!', next: 'chapeus' },
          { pt: 'Beleza! E você?', en: 'Cool! And you?', next: 'chapeus' },
        ],
      },
      chapeus: {
        line: { pt: 'Tudo ótimo! Gostou dos chapéus? Tem boné, boina e chapéu de sol.', en: 'Great! Do you like the hats? There’s a cap, a beret and a sun hat.' },
        chips: [
          { pt: 'Gostei! Quero ver.', en: 'I like them! I want to see.', next: 'shop' },
          { pt: 'Agora não, {obrigad}.', en: 'Not now, thanks.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Beleza! Volte sempre. Tchau!', en: 'Sure thing! Come back anytime. Bye!' },
        chips: [
          { pt: 'Tchau, Nanda!', en: 'Bye, Nanda!', next: 'end' },
          { pt: 'Valeu! Tchau!', en: 'Thanks! Bye!', next: 'end' },
        ],
      },
    },
  },
  // Dona Graça (the night baker) has her counter and bate-papos; this greeting is the short fallback when a dialogue is opened without them
  graca: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Eu sou a Dona Graça, a padeira da noite.', en: '{greeting}, {nome}! I’m Dona Graça, the night baker.' },
        chips: [
          { pt: '{saudacao}, Dona Graça!', en: '{greeting}, Dona Graça!', next: 'cafe' },
          { pt: 'Tudo bem? E a senhora?', en: 'How are you? And you, ma’am?', next: 'cafe' },
        ],
      },
      cafe: {
        line: { pt: 'Tudo bem! Quer um cafezinho?', en: 'All good! Want a little coffee?' },
        chips: [
          { pt: 'Quero, por favor.', en: 'Yes, please.', next: 'tchau' },
          { pt: 'Agora não, {obrigad}.', en: 'Not now, thanks.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Tá bom! Volte sempre. Tchau!', en: 'Okay! Come back anytime. Bye!' },
        chips: [
          { pt: 'Tchau, Dona Graça!', en: 'Bye, Dona Graça!', next: 'end' },
          { pt: 'Valeu! Tchau!', en: 'Thanks! Bye!', next: 'end' },
        ],
      },
    },
  },
  prof: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Oi, {nome}! Tudo bem? Eu sou a professora Bia.', en: 'Hi, {nome}! How’s it going? I’m Professor Bia.' },
        chips: [
          { pt: 'Oi, professora! Tudo bem!', en: 'Hi, professor! All good!', next: 'tatame' },
          { pt: 'Beleza! E você?', en: 'Cool! And you?', next: 'tatame' },
        ],
      },
      tatame: {
        line: { pt: 'Tudo ótimo! O tatame está livre. Quer treinar?', en: 'Great! The mat is free. Want to train?' },
        chips: [
          // straight onto the mat (the queue lobby), the same as the board by the tatame
          { pt: 'Quero, sim!', en: 'Yes, I do!', next: 'treino' },
          { pt: 'Hoje não, {obrigad}.', en: 'Not today, thanks.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Beleza! Até a próxima.', en: 'Sure thing! Until next time.' },
        chips: [
          { pt: 'Tchau, professora!', en: 'Bye, professor!', next: 'end' },
          { pt: 'Valeu! Até logo!', en: 'Thanks! See you later!', next: 'end' },
        ],
      },
    },
  },
  // ---- the Praia (PRAIA-PLAN.md 6). Special `next`s: `rental` (Bento's boats), `caderneta` (Neide's fishing log), `snacks` (Jô's menu),
  // `sell` (Jô's fish tray). Each opener has 3 chips, so the bate-papo chip still fits the 4 a box shows. Jô's beach hats are on the rack
  // itself; Neide's big fish wait behind "Como é que pesca?"; Bento's party boat is in his rental menu. needs_br: true (every line and chip)
  bento: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}! Eu sou o Bento. Esses barcos aí são todos meus.', en: '{greeting}! I’m Bento. Those boats there are all mine.' },
        chips: [
          { pt: 'Quanto custa alugar?', en: 'How much to rent?', next: 'precos' },
          { pt: 'Qual é o melhor barco?', en: 'Which is the best boat?', next: 'melhor' },
          { pt: 'Tchau, Seu Bento!', en: 'Bye, Mr. Bento!', next: 'end' },
        ],
      },
      precos: {
        line: { pt: 'O barquinho a remo é baratinho. Os outros custam mais. Quer ver?', en: 'The little rowboat is cheap. The others cost more. Want to see?' },
        chips: [
          { pt: 'Quero ver os barcos.', en: 'I want to see the boats.', next: 'rental' },
          { pt: 'Agora não, {obrigad}.', en: 'Not now, thanks.', next: 'end' },
        ],
      },
      melhor: {
        line: { pt: 'Pra começar, o barquinho a remo. Pra peixe grande, o de alto-mar.', en: 'To start, the little rowboat. For big fish, the deep-sea boat.' },
        chips: [
          { pt: 'Quero alugar um barco.', en: 'I want to rent a boat.', next: 'rental' },
          { pt: 'Valeu, Seu Bento!', en: 'Thanks, Mr. Bento!', next: 'end' },
        ],
      },
    },
  },
  neide: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}. Senta aí. Já pescou hoje?', en: '{greeting}, {nome}. Sit down. Fished yet today?' },
        chips: [
          { pt: 'Como é que pesca?', en: 'How do you fish?', next: 'como' },
          { pt: 'Minha caderneta de pesca', en: 'My fishing log', next: 'caderneta' },
          { pt: 'Tchau, Dona Neide!', en: 'Bye, Dona Neide!', next: 'end' },
        ],
      },
      como: {
        line: { pt: 'Segura pra lançar, e solta.', en: 'Hold to cast, and let go.' },
        chips: [{ pt: 'E depois?', en: 'And then?', next: 'como2' }],
      },
      como2: {
        line: { pt: 'Quando a boia afunda, é Fisgou! Toca rápido.', en: 'When the bobber sinks, that’s Fisgou! Tap fast.' },
        chips: [{ pt: 'E depois?', en: 'And then?', next: 'como3' }],
      },
      como3: {
        line: { pt: 'Puxa segurando. Ele corre? Solta um pouco.', en: 'Reel by holding. He runs? Let go a bit.' },
        chips: [
          { pt: 'Entendi, {obrigad}!', en: 'Got it, thanks!', next: 'end' },
          { pt: 'Onde tem peixe grande?', en: 'Where are the big fish?', next: 'grande' },
        ],
      },
      grande: {
        line: { pt: 'Na lagoa tem tucunaré. No alto-mar tem marlim. Mas cada um no seu dia.', en: 'The lagoon has peacock bass. The high seas have marlin. Each on its own day.' },
        chips: [
          { pt: 'Como é que pesca?', en: 'How do you fish?', next: 'como' },
          { pt: 'Valeu, Dona Neide!', en: 'Thanks, Dona Neide!', next: 'end' },
        ],
      },
    },
  },
  jo: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, meu bem! Vai um coco?', en: '{greeting}, dear! Coconut water?' },
        chips: [
          { pt: 'Vou querer um lanche.', en: 'I’d like a snack.', next: 'snacks' },
          { pt: 'Quer comprar peixe?', en: 'Do you want to buy fish?', next: 'peixe' },
          { pt: 'Só olhando, {obrigad}!', en: 'Just looking, thanks!', next: 'end' },
        ],
      },
      peixe: {
        line: { pt: 'Quero sim! Mostra o balde.', en: 'Sure I do! Show me the bucket.' },
        chips: [
          { pt: 'Tá aqui!', en: 'Here it is!', next: 'sell' },
          { pt: 'Depois eu volto.', en: 'I’ll come back later.', next: 'end' },
        ],
      },
    },
  },
  julia: {
    start: 'oi',
    nodes: {
      oi: {
        // First meeting only. `juliaTalkStart` moves a return visit to `ajuda`, which is already voiced.
        line: { pt: '{saudacao}, {nome}! Eu sou a Júlia. Tudo bem?', en: '{greeting}, {nome}! I’m Júlia. How’s it going?' },
        chips: [
          { pt: '{saudacao}, Júlia! Tudo bem!', en: '{greeting}, Júlia! All good!', next: 'ajuda' },
          { pt: 'Tudo bom! E você?', en: 'All good! And you?', next: 'ajuda' },
        ],
      },
      ajuda: {
        line: { pt: 'Que bom! Eu sou a guia da praça. Posso te ajudar?', en: 'Great! I’m the square’s guide. Can I help you?' },
        chips: [
          { pt: 'Sim, preciso de ajuda.', en: 'Yes, I need help.', next: 'help' },
          { pt: 'Não, {obrigad}. Estou só passeando.', en: 'No, thanks. I’m just strolling.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Beleza! Aproveite a praça. Tchau!', en: 'Sure thing! Enjoy the square. Bye!' },
        chips: [
          { pt: 'Tchau, Júlia!', en: 'Bye, Júlia!', next: 'end' },
          { pt: 'Valeu! Até logo!', en: 'Thanks! See you later!', next: 'end' },
        ],
      },
    },
  },
  // Seu Dito (Pet Shop, #234): `adopt` opens the panel on Adotar, `petshop` on the Lojinha. Adoption is "quando o coração mandar": never pushy.
  dito: {
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Bem-vindo ao pet shop. Quer ver os bichinhos?', en: '{greeting}, {nome}! Welcome to the pet shop. Want to see the little animals?' },
        chips: [
          { pt: 'Quero ver os bichinhos.', en: 'I want to see the animals.', next: 'bichos' },
          { pt: 'O que tem na loja?', en: 'What’s in the shop?', next: 'loja' },
        ],
      },
      bichos: {
        line: { pt: 'Tem cachorro e gato esperando um lar. Pode fazer carinho, eles adoram.', en: 'There are dogs and cats waiting for a home. You can pet them, they love it.' },
        chips: [
          { pt: 'Posso adotar um?', en: 'Can I adopt one?', next: 'adotar' },
          { pt: 'Vou fazer carinho.', en: 'I’ll go pet them.', next: 'end' },
        ],
      },
      adotar: {
        line: { pt: 'Vamos ver quem tá esperando um lar! Escolhe com calma, viu?', en: 'Let’s see who’s waiting for a home! Choose calmly, okay?' },
        chips: [
          { pt: 'Quero ver!', en: 'Show me!', next: 'adopt' },
          { pt: 'Deixa eu pensar.', en: 'Let me think.', next: 'end' },
        ],
      },
      loja: {
        line: { pt: 'Tem ração, brinquedo, coleira e caminha. Tudo com reais virtuais, {nome}.', en: 'There’s food, toys, collars and beds. All with virtual reais, {nome}.' },
        chips: [
          { pt: 'Quero ver a lojinha.', en: 'I want to see the shop.', next: 'petshop' },
          { pt: 'E banho e tosa?', en: 'And bath and grooming?', next: 'tosa' },
        ],
      },
      tosa: {
        line: { pt: 'O banho e tosa é ali no canto. O bichinho sai cheiroso!', en: 'The bath and grooming is over in the corner. The little one comes out smelling great!' },
        chips: [
          { pt: 'Que legal!', en: 'Nice!', next: 'end' },
          { pt: 'Muito {obrigad}, Seu Dito.', en: 'Thank you very much, Seu Dito.', next: 'end' },
        ],
      },
    },
  },
};

/**
 * Where a talk with Júlia begins.
 * The first meeting uses `oi` (“Eu sou a Júlia”). After that, start on `ajuda` so the line is one she already says.
 */
export function juliaTalkStart(alreadyMet: boolean): 'oi' | 'ajuda' {
  return alreadyMet ? 'ajuda' : 'oi';
}

/** The opening line of an NPC's greeting with the name filled in (what the server counts as "seen" for the Caderno). */
export function talkOpener(npc: NpcId, name = '', minute?: number): string | null {
  const t = NPC_TALK[npc];
  return t ? fillTalk(t.nodes[t.start]!.line.pt, { name, minute }) : null;
}

/** Hearts at which an NPC uses your name (BOND_MILESTONES: `uses_name`). */
export const NAME_HEARTS = 2;

/**
 * Fill `{nome}`, `{obrigad}` (obrigado, or obrigada for `pronoun: 'ela'`), `{saudacao}` and `{greeting}` (the greeting for `minute`, default morning).
 * `hearts` (when given) below 2 means the NPC does not know the name yet: ", {nome}" is dropped. Unset = the name is used.
 */
export function fillTalk(text: string, ctx: { name?: string; pronoun?: string; minute?: number; hearts?: number }): string {
  const g = greetingFor(ctx.minute ?? 600);
  const knowsName = !!ctx.name && (ctx.hearts === undefined || ctx.hearts >= NAME_HEARTS);
  return (knowsName ? text : text.replace(/,\s*\{nome\}/g, ''))
    .replace(/\{nome\}/g, knowsName ? ctx.name! : '')
    .replace(/\{obrigad\}/g, ctx.pronoun === 'ela' ? 'obrigada' : 'obrigado')
    .replace(/\{saudacao\}/g, greetingCap(g))
    .replace(/\{greeting\}/g, GREETING_EN[g])
    .replace(/\s+([!?,.])/g, '$1');
}

/** The greeting's last node: none of its chips leads to another node (the box closes or a panel opens). Shop buttons wait for it. */
export function isLastTalkNode(talk: NpcTalk, nodeId: string): boolean {
  const node = talk.nodes[nodeId];
  return !!node && node.chips.every((c) => !talk.nodes[c.next]);
}

/** Ids of the NPCs with a greeting (the client sends `talk` for these). */
export const TALKING_NPCS: NpcId[] = Object.keys(NPC_TALK) as NpcId[];
