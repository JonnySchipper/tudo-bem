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
    goal: 'Make tapiocas with the filling each customer asks for.',
    steps: ['Tap a pan to spread the batter.', 'Tap again to flip it at the right moment.', 'Add the filling from the bowls.', 'Serve it to the customer who ordered it.'],
    desktop: 'Click pans, bowls and customers. You can also drag a tapioca onto a customer.',
    phone: 'Tap pans, bowls and customers, or drag a tapioca onto a customer.',
  },
  {
    id: 'pastel',
    selector: '#pastel-root',
    pt: 'Pastel',
    en: 'Pastel stand',
    goal: 'Fold, fry and serve pastéis with the fillings customers ask for.',
    steps: ['Take dough, then tap the fillings (two for a combo).', 'Crimp it closed and drop it in the fryer.', 'Pull it out while it is golden, not burnt.', 'Serve. If the oil catches fire, tap “Apaga!”.'],
    desktop: 'Click everything: dough, fillings, crimp, fryer and customers.',
    phone: 'Tap everything: dough, fillings, crimp, fryer and customers.',
  },
  {
    id: 'caldo',
    selector: '#caldo-root',
    pt: 'Caldo de cana',
    en: 'Sugarcane juice press',
    goal: 'Press sugarcane juice and serve it the way each customer likes it.',
    steps: ['Put cane in the press and turn the lever.', 'Put a cup under the spout before the juice runs (or it spills).', 'Add the flavor and ice they asked for.', 'Serve it to the customer.'],
    desktop: 'Drag things with the mouse, or click one and then click where it goes.',
    phone: 'Drag with your finger, or tap one thing and then tap where it goes.',
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
