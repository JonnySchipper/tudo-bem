import type { NpcId } from './rooms.js';
import type { Bilingual } from './types.js';
import type { TalkNode } from './npcTalk.js';
import { COUNTER_LINES } from './diaryLines.js';

/**
 * Bate-papos (#229): short pre-made conversations with a neighbour, in the dialogue box. They replace the old graded Conversa.
 * Each one is a small tree of NPC lines (PT + EN gloss) and reply chips. A bate-papo is never graded: there is no score, no right or
 * wrong reply and no math; every chip leads on, and talking one through to the end is all there is to it (a little friendship, once a
 * game day per neighbour, and the cartela's "Bate-papo na praça" stamp).
 *
 * At 4 hearts (BOND_MILESTONES `story`) a neighbour opens up and tells you their own story: the bate-papo with `minHearts: 4`.
 * The placeholders are the greetings' (`fillTalk`): `{nome}`, `{obrigad}`, `{saudacao}` / `{greeting}`.
 * Every PT string here is new content: `needs_br: true`.
 */
export interface PapoNode extends TalkNode {
  /** A diary line anchor (diaryLines.ts) this node says word for word, so it can teach that line's word. */
  anchor?: string;
}

export interface Papo {
  id: string;
  npc: NpcId;
  title: Bilingual;
  /** Opens from this many hearts with the NPC (the 4-heart story). Unset = always open. */
  minHearts?: number;
  start: string;
  /** Chip `next` is a node id or `end`. */
  nodes: Record<string, PapoNode>;
}

/** Hearts at which a neighbour tells you their story (BOND_MILESTONES: `story`). */
export const STORY_HEARTS = 4;

/** A bate-papo's last chip: `next: 'end'`. */
const bye = (pt: string, en: string) => ({ pt, en, next: 'end' });

// needs_br: true (every line and chip)
export const PAPOS: readonly Papo[] = [
  // ---------------------------------------------------------------- Seu Carlos
  {
    id: 'carlos.cedo',
    npc: 'carlos',
    title: { pt: 'Acordar cedo', en: 'Getting up early' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Sabe quando eu acordo? Bem cedo, antes do sol!', en: '{greeting}, {nome}! Know when I wake up? Really early, before the sun!' },
        chips: [
          { pt: 'Nossa, que cedo!', en: 'Wow, that’s early!', next: 'pao' },
          { pt: 'Eu gosto de dormir.', en: 'I like to sleep.', next: 'dormir' },
        ],
      },
      pao: {
        line: { pt: 'É pra fazer o pão quentinho. O cheiro do pão é o meu despertador.', en: 'It’s to make the bread nice and warm. The smell of bread is my alarm clock.' },
        chips: [
          { pt: 'Que legal!', en: 'How cool!', next: 'tchau' },
          { pt: 'Eu amo pão quentinho.', en: 'I love warm bread.', next: 'tchau' },
        ],
      },
      dormir: {
        line: { pt: 'Eu também! Mas o pão não espera. Padeiro acorda cedo.', en: 'Me too! But bread doesn’t wait. Bakers get up early.' },
        chips: [
          { pt: 'Coitado!', en: 'Poor thing!', next: 'tchau' },
          { pt: 'Que trabalho bonito.', en: 'What lovely work.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Volte amanhã cedo, então. O pão vai estar quentinho!', en: 'Come back early tomorrow, then. The bread will be nice and warm!' },
        chips: [bye('Volto, sim! Tchau!', 'I will! Bye!'), bye('Valeu, Seu Carlos!', 'Thanks, Seu Carlos!')],
      },
    },
  },
  {
    id: 'carlos.cafe',
    npc: 'carlos',
    title: { pt: 'Café ou suco?', en: 'Coffee or juice?' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'E aí, {nome}? Você gosta de café?', en: 'Hey, {nome}! Do you like coffee?' },
        chips: [
          { pt: 'Gosto muito!', en: 'I really do!', next: 'forte' },
          { pt: 'Prefiro suco.', en: 'I prefer juice.', next: 'suco' },
        ],
      },
      forte: {
        line: { pt: 'Eu também! Café bem forte, com um pouco de leite. É o melhor.', en: 'Me too! Really strong coffee, with a little milk. It’s the best.' },
        chips: [
          { pt: 'Hoje quero pra viagem.', en: 'Today I want it to go.', next: 'viagem' },
          { pt: 'Hoje vou tomar aqui.', en: 'Today I’ll have it here.', next: 'aqui' },
        ],
      },
      suco: {
        line: { pt: 'Suco de laranja também é bom! Fresquinho, de manhã.', en: 'Orange juice is good too! Nice and fresh, in the morning.' },
        chips: [
          { pt: 'Pra viagem, por favor.', en: 'To go, please.', next: 'viagem' },
          { pt: 'Aqui mesmo, por favor.', en: 'Right here, please.', next: 'aqui' },
        ],
      },
      viagem: {
        anchor: 'carlos.viagem',
        line: { pt: COUNTER_LINES['carlos.viagem']!, en: 'To go, then. Here you are. Come back anytime!' },
        chips: [bye('Valeu, Seu Carlos!', 'Thanks, Seu Carlos!'), bye('Tchau!', 'Bye!')],
      },
      aqui: {
        line: { pt: 'Pode sentar ali. A mesa da janela é a melhor.', en: 'Have a seat over there. The table by the window is the best.' },
        chips: [bye('{obrigad}, Seu Carlos!', 'Thank you, Seu Carlos!'), bye('Boa ideia!', 'Good idea!')],
      },
    },
  },
  {
    id: 'carlos.historia',
    npc: 'carlos',
    title: { pt: 'A história da padaria', en: 'The bakery’s story' },
    minHearts: STORY_HEARTS,
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Ei, {nome}! Posso te contar uma coisa? Essa padaria era do meu pai.', en: 'Hey, {nome}! Can I tell you something? This bakery was my father’s.' },
        chips: [
          { pt: 'Conta, sim!', en: 'Please, tell me!', next: 'pai' },
          { pt: 'Sério? Que legal!', en: 'Really? How cool!', next: 'pai' },
        ],
      },
      pai: {
        line: { pt: 'Ele chegou do Nordeste sem nada, só com uma receita de pão. E o bairro inteiro vinha aqui.', en: 'He came from the Northeast with nothing, just a bread recipe. And the whole neighborhood came here.' },
        chips: [
          { pt: 'Que história bonita.', en: 'What a beautiful story.', next: 'hoje' },
          { pt: 'E a receita?', en: 'And the recipe?', next: 'receita' },
        ],
      },
      receita: {
        line: { pt: 'A receita é segredo de família! Mas pra você... um dia eu conto.', en: 'The recipe is a family secret! But for you... someday I’ll tell.' },
        chips: [{ pt: 'Vou esperar!', en: 'I’ll wait!', next: 'hoje' }],
      },
      hoje: {
        line: { pt: 'Hoje você também é da família da padaria. Obrigado por voltar sempre.', en: 'Now you’re part of the bakery family too. Thank you for always coming back.' },
        chips: [bye('Eu que agradeço!', 'Thank YOU!'), bye('Que carinho, Seu Carlos!', 'That’s so kind, Seu Carlos!')],
      },
    },
  },
  // ---------------------------------------------------------------- Dona Graça (the night baker)
  {
    id: 'graca.noite',
    npc: 'graca',
    title: { pt: 'A noite na padaria', en: 'Night at the bakery' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! Você gosta da noite?', en: '{greeting}, {nome}! Do you like the night?' },
        chips: [
          { pt: 'Gosto, é tranquila.', en: 'I do, it’s peaceful.', next: 'quieta' },
          { pt: 'Prefiro o dia.', en: 'I prefer the day.', next: 'dia' },
        ],
      },
      quieta: {
        line: { pt: 'Eu também. De noite o bairro fica quietinho, só o forno faz barulho.', en: 'Me too. At night the neighborhood gets nice and quiet, only the oven makes noise.' },
        chips: [
          { pt: 'A senhora não fica com sono?', en: 'Don’t you get sleepy, ma’am?', next: 'sono' },
          { pt: 'Que delícia!', en: 'How lovely!', next: 'tchau' },
        ],
      },
      dia: {
        line: { pt: 'O dia é bonito, mas a noite tem estrelas e pão saindo do forno!', en: 'The day is pretty, but the night has stars and bread coming out of the oven!' },
        chips: [
          { pt: 'A senhora não fica com sono?', en: 'Don’t you get sleepy, ma’am?', next: 'sono' },
          { pt: 'Verdade!', en: 'True!', next: 'tchau' },
        ],
      },
      sono: {
        line: { pt: 'Um pouquinho! Mas um cafezinho resolve tudo.', en: 'A little bit! But a little coffee fixes everything.' },
        chips: [{ pt: 'Ha! Com certeza.', en: 'Ha! For sure.', next: 'tchau' }],
      },
      tchau: {
        line: { pt: 'Até a próxima, {nome}! Se cuida.', en: 'Until next time, {nome}! Take care.' },
        chips: [bye('Tchau, Dona Graça!', 'Bye, Dona Graça!'), bye('Valeu! Até mais!', 'Thanks! See you!')],
      },
    },
  },
  {
    id: 'graca.bolo',
    npc: 'graca',
    title: { pt: 'Bolo de fubá', en: 'Cornmeal cake' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Ô, {nome}! Você já comeu bolo de fubá?', en: 'Oh, {nome}! Have you ever had bolo de fubá (cornmeal cake)?' },
        chips: [
          { pt: 'Ainda não. O que é?', en: 'Not yet. What is it?', next: 'fuba' },
          { pt: 'Já! É uma delícia.', en: 'Yes! It’s delicious.', next: 'delicia' },
        ],
      },
      fuba: {
        line: { pt: 'É um bolo de milho, simples e gostoso. Bom com café!', en: 'It’s a corn cake, simple and tasty. Good with coffee!' },
        chips: [{ pt: 'Parece bom!', en: 'Sounds good!', next: 'avo' }],
      },
      delicia: {
        line: { pt: 'Né? É o bolo da minha infância.', en: 'Right? It’s the cake of my childhood.' },
        chips: [{ pt: 'Que bonito!', en: 'How lovely!', next: 'avo' }],
      },
      avo: {
        line: { pt: 'Minha avó fazia toda tarde. A casa ficava cheirosa.', en: 'My grandmother made it every afternoon. The house smelled wonderful.' },
        chips: [bye('Que lembrança boa!', 'What a nice memory!'), bye('Quero provar um dia!', 'I want to try it someday!')],
      },
    },
  },
  {
    id: 'graca.historia',
    npc: 'graca',
    title: { pt: 'A cantora da madrugada', en: 'The late-night singer' },
    minHearts: STORY_HEARTS,
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Ô, {nome}! Sabe por que eu gosto de trabalhar de noite?', en: 'Oh, {nome}! Do you know why I like working at night?' },
        chips: [
          { pt: 'Por quê?', en: 'Why?', next: 'coral' },
          { pt: 'Conta pra mim!', en: 'Tell me!', next: 'coral' },
        ],
      },
      coral: {
        line: { pt: 'Quando eu era jovem, eu cantava num coral. Cantar de noite é o meu costume.', en: 'When I was young, I sang in a choir. Singing at night is my habit.' },
        chips: [
          { pt: 'A senhora canta?', en: 'You sing, ma’am?', next: 'canta' },
          { pt: 'Que legal!', en: 'How cool!', next: 'canta' },
        ],
      },
      canta: {
        line: { pt: 'Canto até hoje! De madrugada, eu canto pro pão crescer.', en: 'I still do! Late at night, I sing so the bread will rise.' },
        chips: [
          { pt: 'Que lindo!', en: 'How beautiful!', next: 'fim' },
          { pt: 'Canta uma pra mim?', en: 'Will you sing one for me?', next: 'fim' },
        ],
      },
      fim: {
        line: { pt: 'Um dia eu canto pra você, viu? Você é uma visita muito querida.', en: 'Someday I’ll sing for you, okay? You’re a very dear visitor.' },
        chips: [bye('{obrigad}, Dona Graça!', 'Thank you, Dona Graça!'), bye('Vou cobrar, hein!', 'I’ll hold you to that!')],
      },
    },
  },
  // ---------------------------------------------------------------- Nanda (the hat stall)
  {
    id: 'nanda.sol',
    npc: 'nanda',
    title: { pt: 'Sol e chapéu', en: 'Sun and hats' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: '{saudacao}, {nome}! O sol tá forte hoje, né?', en: '{greeting}, {nome}! The sun is strong today, huh?' },
        chips: [
          { pt: 'Tá muito forte!', en: 'It’s really strong!', next: 'chapeu' },
          { pt: 'Eu gosto de sol.', en: 'I like the sun.', next: 'chapeu' },
        ],
      },
      chapeu: {
        line: { pt: 'Por isso eu vendo chapéu! Proteger a cabeça é importante.', en: 'That’s why I sell hats! Protecting your head is important.' },
        chips: [
          { pt: 'Qual é o seu favorito?', en: 'Which one is your favorite?', next: 'favorito' },
          { pt: 'Você tem razão.', en: 'You’re right.', next: 'tchau' },
        ],
      },
      favorito: {
        line: { pt: 'A boina! É elegante e combina com tudo.', en: 'The beret! It’s elegant and goes with everything.' },
        chips: [
          { pt: 'Combina mesmo!', en: 'It really does!', next: 'tchau' },
          { pt: 'Eu prefiro boné.', en: 'I prefer a cap.', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Bom passeio, {nome}! E não esquece o chapéu!', en: 'Have a nice stroll, {nome}! And don’t forget your hat!' },
        chips: [bye('Não esqueço! Tchau!', 'I won’t! Bye!'), bye('Valeu, Nanda!', 'Thanks, Nanda!')],
      },
    },
  },
  {
    id: 'nanda.fonte',
    npc: 'nanda',
    title: { pt: 'A fonte da praça', en: 'The fountain in the square' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Ei, {nome}! Você já viu a fonte da praça?', en: 'Hey, {nome}! Have you seen the fountain in the square (praça)?' },
        chips: [
          { pt: 'Já vi! É bonita.', en: 'I have! It’s pretty.', next: 'fonte' },
          { pt: 'Ainda não.', en: 'Not yet.', next: 'nao' },
        ],
      },
      fonte: {
        line: { pt: 'De tarde, as crianças brincam perto dela. Eu adoro o barulho da água.', en: 'In the afternoon, the kids play near it. I love the sound of the water.' },
        chips: [
          { pt: 'Eu também!', en: 'Me too!', next: 'tchau' },
          { pt: 'Que gostoso!', en: 'How nice!', next: 'tchau' },
        ],
      },
      nao: {
        line: { pt: 'Fica bem no meio da praça. Vale a pena!', en: 'It’s right in the middle of the square. It’s worth it!' },
        chips: [
          { pt: 'Vou lá ver!', en: 'I’ll go see it!', next: 'tchau' },
          { pt: 'Valeu pela dica!', en: 'Thanks for the tip!', next: 'tchau' },
        ],
      },
      tchau: {
        line: { pt: 'Até mais, {nome}!', en: 'See you, {nome}!' },
        chips: [bye('Até mais!', 'See you!'), bye('Tchau, Nanda!', 'Bye, Nanda!')],
      },
    },
  },
  {
    id: 'nanda.historia',
    npc: 'nanda',
    title: { pt: 'O primeiro chapéu', en: 'The first hat' },
    minHearts: STORY_HEARTS,
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Ei, {nome}! Quer saber como eu comecei a fazer chapéus?', en: 'Hey, {nome}! Want to know how I started making hats?' },
        chips: [
          { pt: 'Quero!', en: 'I do!', next: 'mae' },
          { pt: 'Conta, Nanda!', en: 'Tell me, Nanda!', next: 'mae' },
        ],
      },
      mae: {
        line: { pt: 'Minha mãe era costureira. Eu aprendi com ela, na mesa da cozinha.', en: 'My mother was a seamstress. I learned from her, at the kitchen table.' },
        chips: [
          { pt: 'Que bonito!', en: 'How lovely!', next: 'primeiro' },
          { pt: 'E o primeiro chapéu?', en: 'And the first hat?', next: 'primeiro' },
        ],
      },
      primeiro: {
        line: { pt: 'O primeiro ficou torto! Mas eu usei com orgulho o dia todo.', en: 'The first one came out crooked! But I wore it proudly all day.' },
        chips: [
          { pt: 'Que fofo!', en: 'How cute!', next: 'fim' },
          { pt: 'Eu queria ver!', en: 'I’d love to see it!', next: 'fim' },
        ],
      },
      fim: {
        line: { pt: 'Gosto muito de conversar com você, {nome}.', en: 'I really like talking with you, {nome}.' },
        chips: [bye('Eu também, Nanda!', 'Me too, Nanda!'), bye('Até amanhã!', 'See you tomorrow!')],
      },
    },
  },
  // ---------------------------------------------------------------- Júlia (the square's guide)
  {
    id: 'julia.bairro',
    npc: 'julia',
    title: { pt: 'O bairro', en: 'The neighborhood' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Oi, {nome}! Tá gostando de Vila Ipê?', en: 'Hi, {nome}! Are you enjoying Vila Ipê?' },
        chips: [
          { pt: 'Tô adorando!', en: 'I’m loving it!', next: 'gosto' },
          { pt: 'Ainda tô conhecendo.', en: 'I’m still getting to know it.', next: 'conhecer' },
        ],
      },
      gosto: {
        line: { pt: 'Que bom! Aqui todo mundo se conhece. É como uma família grande.', en: 'Great! Everyone knows each other here. It’s like a big family.' },
        chips: [
          { pt: 'Que legal!', en: 'How cool!', next: 'dica' },
          { pt: 'Todo mundo é simpático.', en: 'Everyone is friendly.', next: 'dica' },
        ],
      },
      conhecer: {
        line: { pt: 'Sem pressa! Fala com os vizinhos. Eles adoram conversar.', en: 'No rush! Talk to the neighbors. They love to chat.' },
        chips: [
          { pt: 'Vou falar, sim!', en: 'I will!', next: 'dica' },
          { pt: 'Boa ideia!', en: 'Good idea!', next: 'dica' },
        ],
      },
      dica: {
        line: { pt: 'Uma dica: de manhã tem feira de rua. As frutas são ótimas!', en: 'A tip: in the morning there’s a street market (feira de rua). The fruit is great!' },
        chips: [bye('Valeu pela dica!', 'Thanks for the tip!'), bye('Vou lá amanhã!', 'I’ll go tomorrow!')],
      },
    },
  },
  {
    id: 'julia.ipe',
    npc: 'julia',
    title: { pt: 'Por que Vila Ipê?', en: 'Why Vila Ipê?' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Sabe por que o bairro se chama Vila Ipê?', en: 'Do you know why the neighborhood is called Vila Ipê?' },
        chips: [
          { pt: 'Não sei. Por quê?', en: 'I don’t know. Why?', next: 'arvore' },
          { pt: 'Por causa das árvores?', en: 'Because of the trees?', next: 'arvore' },
        ],
      },
      arvore: {
        line: { pt: 'Por causa dos ipês! São árvores com flores amarelas e roxas.', en: 'Because of the ipês! They’re trees with yellow and purple flowers.' },
        chips: [
          { pt: 'Que lindo!', en: 'How beautiful!', next: 'inverno' },
          { pt: 'Quando elas florescem?', en: 'When do they bloom?', next: 'inverno' },
        ],
      },
      inverno: {
        line: { pt: 'No fim do inverno. A rua fica toda colorida!', en: 'At the end of winter. The street gets all colorful!' },
        chips: [bye('Quero ver!', 'I want to see it!'), bye('Vou tirar uma foto!', 'I’ll take a photo!')],
      },
    },
  },
  {
    id: 'julia.historia',
    npc: 'julia',
    title: { pt: 'Quando a Júlia chegou', en: 'When Júlia arrived' },
    minHearts: STORY_HEARTS,
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Ei, {nome}! Posso te contar um segredo? Eu também cheguei aqui de fora.', en: 'Hey, {nome}! Can I tell you a secret? I came here from somewhere else too.' },
        chips: [
          { pt: 'Sério? De onde?', en: 'Really? From where?', next: 'onde' },
          { pt: 'Não acredito!', en: 'No way!', next: 'onde' },
        ],
      },
      onde: {
        line: { pt: 'De uma cidade pequena, no interior. No começo, eu não conhecia ninguém.', en: 'From a small town in the countryside. At first, I didn’t know anyone.' },
        chips: [
          { pt: 'Deve ser difícil.', en: 'That must be hard.', next: 'cafe' },
          { pt: 'E depois?', en: 'And then?', next: 'cafe' },
        ],
      },
      cafe: {
        line: { pt: 'Aí o Seu Carlos me deu um café e um sorriso. Pronto: virei vizinha!', en: 'Then Seu Carlos gave me a coffee and a smile. That was it: I became a neighbor!' },
        chips: [
          { pt: 'Que história linda!', en: 'What a lovely story!', next: 'fim' },
          { pt: 'O Seu Carlos é demais!', en: 'Seu Carlos is the best!', next: 'fim' },
        ],
      },
      fim: {
        line: { pt: 'Por isso eu sou guia. Quero que todo mundo se sinta em casa, como você.', en: 'That’s why I’m a guide. I want everyone to feel at home, like you.' },
        chips: [bye('Eu me sinto em casa!', 'I feel at home!'), bye('{obrigad}, Júlia!', 'Thank you, Júlia!')],
      },
    },
  },
  // ---------------------------------------------------------------- Professora Bia (the academia)
  {
    id: 'prof.treino',
    npc: 'prof',
    title: { pt: 'O treino', en: 'Training' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Oi, {nome}! Você treina sempre?', en: 'Hi, {nome}! Do you train often?' },
        chips: [
          { pt: 'Quase todo dia!', en: 'Almost every day!', next: 'bom' },
          { pt: 'Ainda não.', en: 'Not yet.', next: 'comeco' },
        ],
      },
      bom: {
        line: { pt: 'Muito bem! O importante é não parar.', en: 'Very good! The important thing is not to stop.' },
        chips: [{ pt: 'Vou continuar!', en: 'I’ll keep going!', next: 'calma' }],
      },
      comeco: {
        line: { pt: 'Tudo bem! Todo mundo começa do começo.', en: 'That’s okay! Everyone starts at the beginning.' },
        chips: [{ pt: 'Que bom ouvir isso.', en: 'Good to hear that.', next: 'calma' }],
      },
      calma: {
        line: { pt: 'Uma dica: respira fundo e tenha calma no tatame.', en: 'A tip: breathe deep and stay calm on the mat.' },
        chips: [bye('Vou lembrar!', 'I’ll remember!'), bye('{obrigad}, professora!', 'Thank you, teacher!')],
      },
    },
  },
  {
    id: 'prof.faixa',
    npc: 'prof',
    title: { pt: 'As faixas', en: 'The belts' },
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Sabe o que a cor da faixa mostra?', en: 'Do you know what the belt’s color shows?' },
        chips: [
          { pt: 'O nível do aluno?', en: 'The student’s level?', next: 'nivel' },
          { pt: 'Não sei.', en: 'I don’t know.', next: 'nivel' },
        ],
      },
      nivel: {
        line: { pt: 'Isso! Branca, azul, roxa, marrom e preta. Leva anos!', en: 'That’s it! White, blue, purple, brown and black. It takes years!' },
        chips: [
          { pt: 'E a sua faixa?', en: 'And your belt?', next: 'preta' },
          { pt: 'Que difícil!', en: 'That’s hard!', next: 'paciencia' },
        ],
      },
      preta: {
        line: { pt: 'A minha é preta. Mas eu ainda aprendo todo dia.', en: 'Mine is black. But I still learn every day.' },
        chips: [bye('Que demais!', 'That’s awesome!'), bye('Que bonito!', 'How lovely!')],
      },
      paciencia: {
        line: { pt: 'Com paciência, tudo dá certo. Igual aprender português!', en: 'With patience, everything works out. Just like learning Portuguese!' },
        chips: [bye('É verdade!', 'That’s true!'), bye('Vou ter paciência.', 'I’ll be patient.')],
      },
    },
  },
  {
    id: 'prof.historia',
    npc: 'prof',
    title: { pt: 'Por que o jiu-jitsu', en: 'Why jiu-jitsu' },
    minHearts: STORY_HEARTS,
    start: 'oi',
    nodes: {
      oi: {
        line: { pt: 'Ei, {nome}! Quer saber por que eu comecei no jiu-jitsu?', en: 'Hey, {nome}! Want to know why I started jiu-jitsu?' },
        chips: [
          { pt: 'Quero, sim!', en: 'Yes, I do!', next: 'timida' },
          { pt: 'Por quê, professora?', en: 'Why, teacher?', next: 'timida' },
        ],
      },
      timida: {
        line: { pt: 'Eu era muito tímida. Não falava com ninguém na escola.', en: 'I was very shy. I didn’t talk to anyone at school.' },
        chips: [
          { pt: 'Sério? Não parece!', en: 'Really? It doesn’t seem like it!', next: 'tatame' },
          { pt: 'E o que mudou?', en: 'And what changed?', next: 'tatame' },
        ],
      },
      tatame: {
        line: { pt: 'No tatame, eu fiz amigos e perdi o medo. Mudou a minha vida.', en: 'On the mat, I made friends and lost my fear. It changed my life.' },
        chips: [
          { pt: 'Que bonito!', en: 'How lovely!', next: 'fim' },
          { pt: 'Que história incrível!', en: 'What an amazing story!', next: 'fim' },
        ],
      },
      fim: {
        line: { pt: 'Agora você também faz parte da nossa academia. Oss!', en: 'Now you’re part of our academy too. Oss!' },
        chips: [bye('Oss, professora!', 'Oss, teacher!'), bye('{obrigad} por contar!', 'Thanks for telling me!')],
      },
    },
  },
];

export const papoById = (id: unknown): Papo | undefined => (typeof id === 'string' ? PAPOS.find((p) => p.id === id) : undefined);

/** Is this bate-papo open to a player with that many hearts with its NPC? */
export const papoOpen = (papo: Papo, heartCount: number): boolean => papo.minHearts === undefined || heartCount >= papo.minHearts;

/** The bate-papos an NPC has, open or not. */
export const paposOf = (npc: NpcId): Papo[] => PAPOS.filter((p) => p.npc === npc);

/** The story an NPC tells at 4 hearts (BOND_MILESTONES `story`), if they have one. */
export const storyOf = (npc: NpcId): Papo | undefined => PAPOS.find((p) => p.npc === npc && p.minHearts === STORY_HEARTS);

/** Ids of the NPCs who have a bate-papo. */
export const PAPO_NPCS: readonly NpcId[] = [...new Set(PAPOS.map((p) => p.npc))];

/**
 * Which bate-papo an NPC starts now: their story once it is open and not heard yet, then one not heard yet, then they take turns
 * by game day. Null when the NPC has none.
 */
export function papoFor(npc: NpcId, heartCount: number, heard: readonly string[], day: number): Papo | null {
  const open = paposOf(npc).filter((p) => papoOpen(p, heartCount));
  if (!open.length) return null;
  const fresh = open.filter((p) => !heard.includes(p.id));
  const story = fresh.find((p) => p.minHearts !== undefined);
  if (story) return story;
  if (fresh.length) return fresh[0]!;
  const i = Math.abs(Math.trunc(Number.isFinite(day) ? day : 0)) % open.length;
  return open[i]!;
}

/** Old or hand-edited saves: keep only known bate-papo ids, no duplicates. */
export function normalizePapos(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => !!papoById(id)))] : [];
}

/** Everything wrong with a bate-papo (tests): a chip that leads nowhere, a node nobody reaches, a missing gloss. */
export function papoProblems(p: Papo): string[] {
  const bad: string[] = [];
  if (!p.nodes[p.start]) bad.push(`${p.id}: no start node "${p.start}"`);
  const reached = new Set<string>();
  const walk = (id: string) => {
    if (reached.has(id) || !p.nodes[id]) return;
    reached.add(id);
    for (const c of p.nodes[id]!.chips) walk(c.next);
  };
  walk(p.start);
  for (const [id, node] of Object.entries(p.nodes)) {
    if (!reached.has(id)) bad.push(`${p.id}.${id}: never reached`);
    if (!node.line.pt.trim() || !node.line.en.trim()) bad.push(`${p.id}.${id}: line needs PT and EN`);
    // before 2 hearts the NPC does not know the name and `fillTalk` drops only ", {nome}": a line opening on the name would start with a comma
    if (/^\{nome\}/.test(node.line.pt) || /^\{nome\}/.test(node.line.en)) bad.push(`${p.id}.${id}: opens on {nome}`);
    if (!node.chips.length) bad.push(`${p.id}.${id}: no chips (a bate-papo ends on a chip)`);
    for (const c of node.chips) {
      if (c.next !== 'end' && !p.nodes[c.next]) bad.push(`${p.id}.${id}: chip leads to unknown "${c.next}"`);
      if (!c.pt.trim() || !c.en.trim()) bad.push(`${p.id}.${id}: chip needs PT and EN`);
    }
  }
  return bad;
}
