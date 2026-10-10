/**
 * The first-time cards, in English (the player may have no Portuguese yet). Two kinds:
 * - `game`: how to play a minigame, with the controls on a computer and on a phone.
 * - `place`: how a panel or an activity works (the Diário, Favores, the Cartela, a bate-papo, the camera, ...): what it is for and the rules
 *   a new player would otherwise only learn by bumping into them.
 * The game's own Portuguese name sits in the title. `selector` is the root element: it is in the page only while the thing is open
 * (ui/howToPlay.ts watches for it). Pure data, tested.
 */
import { CARTELA_REWARD, ECONOMY, FILM, MISSION_REWARD, RECADO_DAY_BONUS_RV, RECADO_MAX_ACTIVE, RECADOS_PER_DAY } from '@tudobem/shared';

export interface HowToPlay {
  id: string;
  /** `game` (default): a minigame, "How to play" with controls. `place`: a panel or activity, "How it works". */
  kind?: 'game' | 'place';
  /** The game's root while it is open. */
  selector: string;
  pt: string;
  en: string;
  goal: string;
  steps: string[];
  /** Controls. Required for a game; optional for a place. */
  desktop?: string;
  phone?: string;
  /** Rooms where the card does not open by itself (a guided tutorial already explains it there). The "?" still works. */
  quietIn?: readonly string[];
}

// (Correria no Balcão has no card: it teaches by doing, one coach mark per new action, ui/correriaPracticeLogic.ts)
export const HOW_TO_PLAY: readonly HowToPlay[] = [
  {
    id: 'tapioca',
    selector: '#tapioca-root',
    pt: 'Tapioca',
    en: 'Tapioca stand',
    goal: 'Make tapiocas with the filling each customer asks for. The clock starts after the 3-2-1.',
    steps: [
      'Hold a pan to sift goma (tapioca flour) onto it. Let go when the white disc reaches the rim.',
      'It cooks slowly, so start another pan meanwhile. Tap to flip it when the ring around the pan is green.',
      'Drag the filling they asked for onto it, then tap to fold it.',
      'Drag the tapioca to the customer. Botched one? Drag it into the lixeira (bin) to clear the pan.',
    ],
    desktop: 'Hold the mouse button on a pan to spread. Click to flip and fold. Drag fillings and tapiocas.',
    phone: 'Hold a pan to spread. Tap to flip and fold. Drag fillings and tapiocas with your finger.',
  },
  {
    id: 'pastel',
    selector: '#pastel-root',
    pt: 'Pastel',
    en: 'Pastel stand',
    goal: 'Fold, fry and serve pastéis with the fillings customers ask for. The clock starts after the 3-2-1.',
    steps: [
      'Drag the dough onto the board, then drag the fillings onto it (two for a combo).',
      'Drag the fork onto it to crimp it, then drag it into the oil.',
      'Watch the bar. When it is golden (green), drag it out onto the rack, then drag it to the customer.',
      'Left too long it burns and catches fire. Tap the fire to put it out. Drag anything that went wrong into the bin.',
    ],
    desktop: 'Drag everything with the mouse. Click only to put out a fire.',
    phone: 'Drag everything with your finger. Tap only to put out a fire.',
  },
  {
    id: 'caldo',
    selector: '#caldo-root',
    pt: 'Caldo de cana',
    en: 'Sugarcane juice press',
    goal: 'Press sugarcane juice and serve it the way each customer likes it. The clock starts after the 3-2-1.',
    steps: [
      'Tap the cane to feed the press, and the cups to put one under the spout.',
      'Hold the wheel to press. Let go when the juice reaches the red line on the cup.',
      'Tap the fruit they asked for, and the ice if they want it com gelo.',
      'Drag the cup to the customer (or tap them). Park a cup on the tray to start the next.',
    ],
    desktop: 'Hold the mouse button on the wheel. Click or drag everything else.',
    phone: 'Hold your finger on the wheel. Tap or drag everything else.',
  },
  {
    id: 'bout',
    selector: '#bout-root',
    pt: 'Treino no tatame',
    en: 'Jiu-jitsu roll',
    goal: 'A friendly roll where Portuguese is the controller: Professora Bia calls short commands and you tap them in time. Score points, defend, and go for the finish.',
    steps: [
      'Pick a partner, then start. The partner says what they will try next.',
      'Your turn: pick a move card (the arrows › are how many commands it takes) or Segurar to hold.',
      'Bia calls each command (Pega! Puxa! Empurra! Gira! Levanta! Aperta!): tap that word before the ring runs out. Fast taps are Perfeito!',
      'Their turn: tap the right defense (Postura! Base! Trava! Sai!). Against a finish, tap Sai! again and again.',
    ],
    desktop: 'Click or press 1-4 for a card, H to hold. During a move press 1-6 for the commands, during a defense 1-4. Enter starts; Esc twice leaves a match.',
    phone: 'Tap a card, then tap the command buttons as Bia calls them. Defend with the four buttons.',
  },
  {
    id: 'escola',
    selector: '.backdrop[data-modal="escola"]',
    pt: 'Escola',
    en: 'School practice',
    goal: 'Short lessons with the words from your diary (Diário). Practice keeps them strong.',
    steps: ['Pick an answer, type the word, build the sentence or match the pairs.', 'Check, then go on to the next one.'],
    desktop: 'Click, or press 1-4 to choose. Enter checks and moves on. Esc closes.',
    phone: 'Tap your answer, then Check and Next.',
  },
  {
    id: 'damas',
    selector: '.backdrop[data-modal="checkers"]',
    pt: 'Damas',
    en: 'Checkers',
    goal: 'Beat the computer at checkers.',
    steps: ['Pick one of your glowing pieces.', 'Then pick a highlighted square. Captures are required.'],
    desktop: 'Click a piece, then a square.',
    phone: 'Tap a piece, then a square.',
  },
  {
    id: 'feira',
    selector: '#dialogue-box[data-dialogue="feira"]',
    pt: 'Feira',
    en: 'Buying at the market',
    goal: 'Ask the price, listen to it in Portuguese, say how much you want, and pay. No math: Pagar hands over the exact price.',
    steps: ['Ask “Quanto custa?” (how much is it?) with a chip, or type it.', 'Listen to the price in words, then choose how many.', 'Tap Pagar (pay): it pays the exact price.'],
    desktop: 'Click chips or type, number keys pick chips. Esc closes.',
    phone: 'Tap chips or type, then tap Pagar.',
  },
  {
    id: 'petshop',
    kind: 'place',
    selector: '.backdrop[data-modal="petshop"]',
    pt: 'Pet Shop do Seu Dito',
    en: 'Seu Dito’s pet shop',
    goal: 'Meet the animals, learn their words, and (as a supporter) adopt one.',
    steps: [
      'Pet an animal in a pen (Fazer carinho): Seu Dito tells you about it, and that line goes in your Diário.',
      'Read the signs on the walls and photograph the things in the shop: every word here is free.',
      'Talk to Seu Dito at the counter.',
      'The Lojinha sells collars, toys, beds and food bowls for RV you earned in the Vila.',
      'Supporters can adopt a dog or a cat, name it and take it for a walk. The others wait at home in your kitnet.',
    ],
  },
  {
    id: 'balcao',
    kind: 'place',
    selector: '#dialogue-box[data-dialogue^="counter-"]',
    pt: 'Balcão da padaria',
    en: 'Ordering at the bakery counter',
    goal: 'Order from the baker in Portuguese. Each reply is what you would say at a real padaria.',
    steps: [
      'Each chip is an order, like “Me vê um pão na chapa”, with its price in reais virtuais (RV), the game’s play money.',
      'Pick one: you pay, and it goes into your bag (Favores → Mochila). Favors sometimes ask you to bring one to a neighbour.',
      'Bater papo (have a chat) opens a bate-papo with the baker: a short ready-made chat. It is never graded.',
      'The bakery game, Correria no Balcão, starts at the display case (vitrine) next to the counter.',
    ],
    desktop: 'Click a chip or press its number. Esc closes.',
    phone: 'Tap a chip.',
  },
  {
    id: 'papo',
    kind: 'place',
    selector: '#dialogue-box[data-dialogue^="papo-"]',
    pt: 'Bate-papo',
    en: 'A chat with a neighbour',
    goal: 'A short ready-made chat in Portuguese. There is no grade and no wrong answer: pick any reply and see where it goes.',
    steps: [
      'Start one with Bater papo (have a chat) at the padaria counter, or “Vamos bater um papo?” (shall we chat?) when you greet Nanda, Júlia or Professora Bia.',
      'Read the line (English under it), then tap a reply. Every reply leads on.',
      'Each neighbour has a few. At 4 ♥ they tell you their own story.',
      'Finishing one is a talk: it grows the friendship ♥, and in the Praça it gives the cartela’s Bate-papo stamp.',
    ],
    desktop: 'Click a reply or press its number. Esc closes.',
    phone: 'Tap a reply.',
  },
  {
    id: 'recados',
    kind: 'place',
    selector: '.backdrop[data-modal="recados"]',
    pt: 'Favores',
    en: 'Favors, your bag and your friends',
    goal: 'Neighbours ask you for small favors (favores). Doing them pays reais virtuais (RV), the game’s play money, and makes friends.',
    steps: [
      'A gold ! over a neighbour: they have a favor to ask. Talk to them (Pode deixar! = you got it / leave it to me), or press Aceitar here.',
      `Carry up to ${RECADO_MAX_ACTIVE}. The Favores list at the top shows the next step and where (📍); a green ? marks who the step is with.`,
      'Steps: talk to someone, read a sign, buy something and hand it over.',
      `${RECADOS_PER_DAY} favors in one day: Vizinho do dia (neighbour of the day), +${RECADO_DAY_BONUS_RV} RV.`,
      'Hearts ♥ grow when you talk and help. At 2 ♥ they use your name, at 4 ♥ they tell you their own story (a bate-papo), at 6 ♥ a gift for your kitnet.',
      `Bem-vindo à Vila Ipê is Júlia’s welcome list. Finish its 8 steps for a ${ECONOMY.tutorialBonus} RV bonus.`,
    ],
  },
  {
    id: 'diario',
    kind: 'place',
    selector: '.backdrop[data-modal="caderno"]',
    pt: 'Diário',
    en: 'Your word collection',
    goal: 'Every word you find in Vila Ipê is kept here as a sticker, place by place.',
    steps: [
      'You find words three ways: take photos with the camera, read signs, and listen when people talk to you.',
      'Tap a sticker to hear it. Each tab is a place. Fotos keeps your photos. Caderno keeps the words from signs and menus.',
      'Practise your words at the Escola with Dona Lúcia. Words go from Nova (new) to Aprendendo (learning), Quase lá (almost) and Dominada (mastered).',
      'Pra revisar counts the words due for practice. XP and dias seguidos (days in a row) come from Escola lessons.',
    ],
  },
  {
    id: 'cartela',
    kind: 'place',
    selector: '.backdrop[data-modal="cartela"]',
    pt: 'Cartela do bairro',
    en: 'Neighbourhood stamp card',
    goal: `Do different things around the Vila to collect stamps. Seven stamps fill the card and pay ${CARTELA_REWARD} RV.`,
    steps: [
      'Each activity gives one stamp a day: a jiu-jitsu roll at the Academia, a shift of Correria no Balcão at the Padaria, a visit to the Feira (street market), and a bate-papo (chat) in the Praça (square).',
      'So you can earn up to 4 stamps a day (Hoje means today). The day changes at midnight, New York time.',
      'The Bate-papo stamp counts a bate-papo finished in the Praça: with Nanda or Júlia, or Seu Carlos on his bench in the late evening (from 22:00 on the game clock).',
      'A full card pays out and a fresh card starts. Nothing is lost if you skip a day.',
    ],
  },
  {
    id: 'missao',
    kind: 'place',
    selector: '.backdrop[data-modal="kiosk"]',
    pt: 'Missão do dia',
    en: 'Daily mission',
    goal: `Three small steps, once a day, for a bonus of ${MISSION_REWARD} RV.`,
    steps: [
      'Take today’s mission with the button.',
      'The steps tick off by themselves as you play. A chip at the top of the screen shows how far you are.',
      'A new mission comes the next day.',
    ],
  },
  {
    id: 'camera',
    kind: 'place',
    selector: '#camera-banner',
    quietIn: ['aeroporto'],
    pt: 'Câmera',
    en: 'Camera',
    goal: 'Photograph things to collect their words for your diary (Diário).',
    steps: [
      'Aim at something and click: that is the photo. The camera closes after each photo.',
      'Each new thing inside the frame becomes a new word in your diary.',
      'Each photo uses one film (filme). How many you have left is on the banner. Photos at the airport are free.',
      `Out of film? Buy a roll of ${FILM.pack} from Júlia in the Praça (the square) for ${FILM.price} RV.`,
    ],
    desktop: 'Move the mouse to aim, click to take the photo. Click Câmera again to put it away.',
    phone: 'Tap the thing you want to photograph.',
  },
  {
    id: 'kimono',
    kind: 'place',
    selector: '#dialogue-box[data-dialogue^="gi-"]',
    pt: 'Kimono e faixas',
    en: 'Gi and belts',
    goal: 'Jiu-jitsu at the Academia is a Portuguese listening game. You buy a gi once, then train with Professora Bia’s partners.',
    steps: [
      'You need a gi (kimono) to train. You buy it once, and the white belt comes free.',
      'Each win counts toward a stripe (listra) on your belt. A stripe teaches a new move and opens new partners.',
      'Four stripes make the next belt. Your belt shows at the top of the screen and on your nameplate.',
      'A loss never takes a stripe away.',
    ],
  },
  {
    id: 'academias',
    kind: 'place',
    selector: '.backdrop[data-modal="academy"]',
    pt: 'Academias do bairro',
    en: 'Neighbourhood academies (teams)',
    goal: 'Academies are teams founded by players. Visit one, train on its mat, or join the team.',
    steps: [
      'Visitar takes you to its floor, where you can train on its mat.',
      'Joining is free. Members train in the team’s gi.',
      'Founding your own academy takes a brown belt.',
    ],
  },
  {
    id: 'placar-feira',
    kind: 'place',
    selector: '.backdrop[data-modal="feira-sign"]',
    pt: 'Placar da Feira',
    en: 'Market board',
    goal: 'Today’s best scores at the market cart game.',
    steps: [
      'There is one cart game each day (tapioca, pastel or caldo de cana). Play it at the cart next to this board.',
      'The top 3 for today are shown live.',
      'At midnight (New York time), 1st, 2nd and 3rd place each win a gold, silver or bronze medal to keep.',
      'Your medals are on the first page of your diary (Diário).',
    ],
  },
];

export const howToPlay = (id: string): HowToPlay | undefined => HOW_TO_PLAY.find((g) => g.id === id);
