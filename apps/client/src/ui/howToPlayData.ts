/**
 * How to play each minigame, in English (the player may have no Portuguese yet), with the controls on a computer and on a phone. The
 * game's own Portuguese name sits in the title. `selector` is the game's root element: it is in the page only while the game is open
 * (ui/howToPlay.ts watches for it). Pure data, tested.
 */
export interface HowToPlay {
  id: string;
  /** The game's root while it is open. */
  selector: string;
  pt: string;
  en: string;
  goal: string;
  steps: string[];
  desktop: string;
  phone: string;
}

export const HOW_TO_PLAY: readonly HowToPlay[] = [
  {
    id: 'correria',
    selector: '#correria',
    pt: 'Correria no Balcão',
    en: 'Rush at the bakery counter',
    goal: 'Customers order in Portuguese. Make what they ask for and serve it before they run out of patience.',
    steps: [
      'Listen to (or read) the order on the ticket.',
      'Grab items from the shelves, use the griddle (chapa), the juicer and the coffee machine.',
      'Pick the coffee options the customer asked for, then serve.',
      'When they ask “Quanto é?”, choose the right price.',
    ],
    desktop: 'Click the counter to grab and make things. Enter serves, C clears the tray, R repeats the order.',
    phone: 'Tap the counter to grab and make things, then tap Entregar to serve.',
  },
  {
    id: 'tapioca',
    selector: '#tapioca-root',
    pt: 'Tapioca',
    en: 'Tapioca stand',
    goal: 'Make tapiocas with the filling each customer asks for. The clock starts after the 3-2-1.',
    steps: [
      'Hold a pan to sieve the batter onto it. Let go when the white disc reaches the rim.',
      'Tap to flip it while the ring around the pan is in its green part.',
      'Add the filling they asked for, then tap to fold it.',
      'Drag the tapioca to the customer (or tap them).',
    ],
    desktop: 'Hold the mouse button on a pan to spread. Click to flip and fold. Drag fillings and tapiocas, or click them.',
    phone: 'Hold a pan to spread. Tap to flip and fold. Drag fillings and tapiocas, or tap them.',
  },
  {
    id: 'pastel',
    selector: '#pastel-root',
    pt: 'Pastel',
    en: 'Pastel stand',
    goal: 'Fold, fry and serve pastéis with the fillings customers ask for. The clock starts after the 3-2-1.',
    steps: [
      'Tap the dough, then the fillings (two for a combo), then the fork to crimp it.',
      'Drag it into the oil. Watch the bar: pull it out in the green, when it is golden.',
      'It goes onto the rack. Drag it to the customer (or tap them).',
      'Left too long it burns and catches fire. Tap the fire to put it out.',
    ],
    desktop: 'Click the dough, fillings, fork and oil, or drag them. Drag a pastel from the rack to a customer.',
    phone: 'Tap the dough, fillings, fork and oil, or drag them. Drag a pastel from the rack to a customer.',
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
    goal: 'A friendly roll: pick moves, score points and always respect your partner. Points come from moves, not quiz answers.',
    steps: ['Pick a partner, then start.', 'Each turn, choose a move card (or hold, or go for the finish).', 'Some turns ask you to read or type a short Portuguese line to land it.'],
    desktop: 'Click cards. Keys: 1-9 pick a move, H holds, F finishes, Enter confirms.',
    phone: 'Tap the cards and buttons.',
  },
  {
    id: 'escola',
    selector: '.backdrop[data-modal="escola"]',
    pt: 'Escola',
    en: 'School practice',
    goal: 'Short lessons with the words from your Diário. Practice keeps them strong.',
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
    goal: 'Ask the price, say how much you want, and pay with the right coins and notes.',
    steps: ['Ask “Quanto custa?” with a chip, or type it.', 'Choose how many.', 'Tap coins and notes into the tray, then Pagar. Check your change!'],
    desktop: 'Click chips or type, number keys pick chips. Esc closes.',
    phone: 'Tap chips or type, then tap the money and Pagar.',
  },
  {
    id: 'pedido',
    selector: '#dialogue-box[data-dialogue="pedido"]',
    pt: 'Pedido',
    en: 'Ordering at the bakery',
    goal: 'Order from Seu Carlos in Portuguese.',
    steps: ['Pick a reply, or type your own order (like “Me vê um pão na chapa, por favor”).', 'Answer his questions.'],
    desktop: 'Click a chip or press its number, or type and press Enter.',
    phone: 'Tap a chip, or type and tap Enviar.',
  },
];

export const howToPlay = (id: string): HowToPlay | undefined => HOW_TO_PLAY.find((g) => g.id === id);
