/**
 * Phase 0 gloss: phrasebook + word lexicon for the English line under Portuguese bubbles (Verde plates).
 * Deterministic and offline. Replace with a translation service behind `GlossService` later.
 */

const PHRASES: Record<string, string> = {
  'tudo bem': 'how’s it going / all good',
  'tudo bem?': 'how’s it going?',
  'tudo bom': 'all good',
  'tudo otimo': 'all great',
  'tudo certo': 'all good',
  'e voce': 'and you',
  'e ai': 'what’s up',
  'bom dia': 'good morning',
  'boa tarde': 'good afternoon',
  'boa noite': 'good evening',
  'ate logo': 'see you soon',
  'ate mais': 'see you later',
  'ate amanha': 'see you tomorrow',
  'tchau': 'bye',
  'oi': 'hi',
  'ola': 'hello',
  'obrigado': 'thank you',
  'obrigada': 'thank you',
  'muito obrigado': 'thank you very much',
  'muito obrigada': 'thank you very much',
  'de nada': 'you’re welcome',
  'por favor': 'please',
  'com licenca': 'excuse me',
  'desculpa': 'sorry',
  'desculpe': 'sorry',
  'valeu': 'thanks',
  'beleza': 'cool / okay',
  'legal': 'cool',
  'que legal': 'how cool',
  'muito legal': 'very cool',
  'nossa': 'wow',
  'tudo joia': 'all good',
  'prazer': 'nice to meet you',
  'muito prazer': 'very nice to meet you',
  'como vai': 'how are you',
  'como voce esta': 'how are you',
  'qual e o seu nome': 'what’s your name',
  'qual o seu nome': 'what’s your name',
  'como voce se chama': 'what’s your name',
  'meu nome e': 'my name is',
  'eu me chamo': 'my name is',
  'de onde voce e': 'where are you from',
  'eu sou de': 'I’m from',
  'sou de': 'I’m from',
  'me ve um': 'give me a',
  'me ve uma': 'give me a',
  'eu quero': 'I want',
  'eu queria': 'I’d like',
  'eu gostaria de': 'I would like',
  'quanto custa': 'how much is it',
  'quanto e': 'how much is it',
  'so isso': 'that’s all',
  'mais alguma coisa': 'anything else',
  'por conta da casa': 'on the house',
  'volte sempre': 'come back anytime',
  'vamos la': 'let’s go',
  'bora': 'let’s go',
  'bora jogar': 'let’s play',
  'vamos jogar': 'let’s play',
  'que horas sao': 'what time is it',
  'eu nao sei': 'I don’t know',
  'nao sei': 'I don’t know',
  'nao entendi': 'I didn’t understand',
  'pode repetir': 'can you repeat',
  'mais devagar': 'more slowly',
  'fala mais devagar': 'speak more slowly',
  'o que e isso': 'what is this',
  'fica bem': 'looks good',
  'fica bem em voce': 'looks good on you',
  'gostei do seu chapeu': 'I like your hat',
  'que chapeu legal': 'what a cool hat',
  'bem-vindo': 'welcome',
  'bem-vinda': 'welcome',
  'bem vindo': 'welcome',
  'bem vinda': 'welcome',
  'parabens': 'congratulations',
  'boa sorte': 'good luck',
  'estou com fome': 'I’m hungry',
  'to com fome': 'I’m hungry',
  'eu tambem': 'me too',
  'tambem': 'also / too',
  'claro': 'of course',
  'com certeza': 'for sure',
  'pode ser': 'could be / sure',
  'ta bom': 'okay',
  'ta': 'okay',
  'sim': 'yes',
  'nao': 'no',
  'kkk': '(laughing)',
  'kkkk': '(laughing)',
  'haha': '(laughing)',
  'rs': '(heh)',
  'vem ca': 'come here',
  'vamos na padaria': 'let’s go to the bakery',
  'minha kitnet': 'my studio apartment',
  'quer ser meu amigo': 'want to be my friend',
  'quer ser minha amiga': 'want to be my friend',
  'bom apetite': 'enjoy your meal',
};

const WORDS: Record<string, string> = {
  eu: 'I', voce: 'you', vc: 'you', ele: 'he', ela: 'she', nos: 'we', 'a gente': 'we', eles: 'they', elas: 'they',
  meu: 'my', minha: 'my', seu: 'your', sua: 'your', o: 'the', a: 'the', os: 'the', as: 'the', um: 'a', uma: 'a',
  e: 'and/is', de: 'of', do: 'of the', da: 'of the', no: 'in the', na: 'in the', em: 'in', com: 'with', sem: 'without',
  para: 'for', pra: 'for', por: 'for', que: 'that/what', quem: 'who', onde: 'where', quando: 'when', como: 'how', porque: 'because',
  sou: 'am', es: 'are', esta: 'is', estou: 'am', to: 'I’m', tem: 'has/there is', tenho: 'I have', quero: 'I want', gosto: 'I like',
  gosta: 'likes', vou: 'I’m going', vai: 'goes/will', vamos: 'let’s', vem: 'come', faz: 'does', fazer: 'to do', ir: 'to go',
  comer: 'to eat', beber: 'to drink', jogar: 'to play', falar: 'to speak', aprender: 'to learn', estudar: 'to study',
  aqui: 'here', ali: 'there', la: 'there', muito: 'very/a lot', pouco: 'a little', mais: 'more', menos: 'less', bem: 'well', mal: 'badly',
  bom: 'good', boa: 'good', otimo: 'great', legal: 'cool', bonito: 'pretty', bonita: 'pretty', lindo: 'beautiful', linda: 'beautiful',
  novo: 'new', nova: 'new', grande: 'big', pequeno: 'small', quente: 'hot', frio: 'cold', gostoso: 'tasty', gostosa: 'tasty', delicia: 'delicious',
  amigo: 'friend', amiga: 'friend', amigos: 'friends', gente: 'people/folks', pessoal: 'everyone', galera: 'everyone',
  padaria: 'bakery', praca: 'square', casa: 'home', kitnet: 'studio apartment', chapeu: 'hat', bone: 'cap', cadeira: 'chair',
  pao: 'bread', paes: 'breads', queijo: 'cheese', cafe: 'coffee', leite: 'milk', suco: 'juice', laranja: 'orange', coxinha: 'coxinha (croquette)',
  cafezinho: 'little coffee', bolo: 'cake', agua: 'water', guarana: 'guaraná soda', fome: 'hunger', sede: 'thirst',
  hoje: 'today', amanha: 'tomorrow', ontem: 'yesterday', agora: 'now', depois: 'later', sempre: 'always', nunca: 'never', ja: 'already',
  dia: 'day', noite: 'night', tarde: 'afternoon', manha: 'morning', semana: 'week',
  jogo: 'game', musica: 'music', papagaio: 'parrot', gato: 'cat', cachorro: 'dog',
  brasil: 'Brazil', 'sao paulo': 'São Paulo', sampa: 'São Paulo', eua: 'USA', inglaterra: 'England', canada: 'Canada',
  zero: 'zero', dois: 'two', duas: 'two', tres: 'three', quatro: 'four', cinco: 'five', seis: 'six', sete: 'seven', oito: 'eight', nove: 'nine', dez: 'ten',
  sim: 'yes', nao: 'no', talvez: 'maybe', obrigado: 'thanks', obrigada: 'thanks', oi: 'hi', ola: 'hello', tchau: 'bye',
  feliz: 'happy', triste: 'sad', cansado: 'tired', cansada: 'tired', animado: 'excited', animada: 'excited',
  aprendendo: 'learning', portugues: 'Portuguese', ingles: 'English', falo: 'I speak', entendo: 'I understand',
  sentar: 'to sit', dancar: 'to dance', rir: 'to laugh', olha: 'look', ve: 'see', vi: 'I saw', viu: 'did you see',
  isso: 'this/that', esse: 'this', essa: 'this', aquele: 'that', tudo: 'everything', nada: 'nothing', algo: 'something',
  onibus: 'bus', metro: 'subway', rua: 'street', predio: 'building', loja: 'shop',
};

const ADJ: Record<string, string> = { legal: 'cool', lindo: 'beautiful', linda: 'beautiful', bonito: 'nice', bonita: 'nice', massa: 'awesome', gostoso: 'tasty', gostosa: 'tasty' };

const PATTERNS: [RegExp, (m: RegExpMatchArray, g: (s: string) => string) => string][] = [
  [/^que (.+) (legal|lindo|linda|bonito|bonita|massa|gostoso|gostosa)$/, (m, g) => `what a ${ADJ[m[2]]} ${g(m[1])}`],
  [/^(?:eu )?gosto d[oae]s? (.+)$/, (m, g) => `I like ${g(m[1])}`],
  [/^(?:eu )?adoro (.+)$/, (m, g) => `I love ${g(m[1])}`],
  [/^(?:vamos|bora) (?:pra|para|na|no|a|ao) (.+)$/, (m, g) => `let’s go to the ${g(m[1])}`],
  [/^(?:eu )?sou d[eoa]s? (.+)$/, (m, g) => `I’m from ${g(m[1])}`],
  [/^(?:eu )?(?:me chamo|sou o|sou a) (.+)$/, (m) => `I’m ${m[1]}`],
];

const EN_HINTS = new Set([
  'the', 'is', 'are', 'you', 'i', 'my', 'your', 'what', 'hello', 'hi', 'hey', 'this', 'that', 'and', 'to', 'it', 'yes', 'no', 'how',
  'where', 'from', 'nice', 'cool', 'want', 'like', 'lol', 'thanks', 'thank', 'please', 'good', 'morning', 'bye', 'we', 'they', 'can',
  'do', 'dont', "don't", 'im', "i'm", 'with', 'have', 'here', 'there', 'friend', 'hat', 'play', 'game', 'let', "let's", 'lets', 'of', 'in',
  'am', 'was', 'be', 'so', 'just', 'go', 'going', 'really', 'omg', 'wow', 'awesome', 'love', 'sorry', 'name', 'who', 'why', 'when',
]);

export type ChatLang = 'pt' | 'en' | 'mix';

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"()]/g, '');

export function detectLang(text: string): ChatLang {
  const words = strip(text).match(/[a-z']+/g) ?? [];
  if (!words.length) return 'pt';
  let en = 0;
  let pt = 0;
  for (const w of words) {
    const inEn = EN_HINTS.has(w);
    const inPt = w in WORDS || w in PHRASES;
    if (inEn && !inPt) en++;
    else if (inPt && !inEn) pt++;
  }
  if (en > 0 && pt === 0) return 'en';
  if (en > pt * 2) return 'en';
  if (en > 0 && pt > 0) return 'mix';
  return 'pt';
}

/** Returns an English gloss for a Portuguese line, or null if the line is English / unglossable. */
export function glossPt(text: string): string | null {
  const lang = detectLang(text);
  if (lang === 'en') return null;
  const clean = strip(text).trim();
  const bare = clean.replace(/[!?.,;:…]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!bare) return null;
  if (PHRASES[bare]) return capitalize(PHRASES[bare]) + trailingPunct(clean);
  const lookup = (s: string) =>
    s
      .split(' ')
      .filter((w) => !['o', 'a', 'os', 'as', 'um', 'uma'].includes(w))
      .map((w) => WORDS[w] ?? w)
      .join(' ');
  for (const [re, render] of PATTERNS) {
    const m = bare.match(re);
    if (m) return capitalize(render(m, lookup)) + trailingPunct(clean);
  }

  // Split on sentence punctuation; greedy longest match per chunk (phrases up to 5 words, then words).
  const splitChunks = (s: string) => s.split(/([!?.,;:…]+)/).filter((c) => c.length);
  const chunks = splitChunks(clean);
  // Same tokenization on the original text so unknown words (names, places) keep their casing.
  const origChunks = splitChunks(text.replace(/[“”"()]/g, ''));
  const out: string[] = [];
  let known = 0;
  let total = 0;
  for (const [ci, chunk] of chunks.entries()) {
    if (/^[!?.,;:…]+$/.test(chunk)) {
      if (out.length) out[out.length - 1] += chunk.trim()[0];
      continue;
    }
    const words = chunk.trim().split(/\s+/).filter(Boolean);
    const orig = (origChunks[ci] ?? chunk).trim().split(/\s+/).filter(Boolean);
    const parts: string[] = [];
    for (let i = 0; i < words.length; ) {
      let matched = false;
      for (let n = Math.min(5, words.length - i); n >= 1; n--) {
        const cand = words.slice(i, i + n).join(' ');
        const hit = PHRASES[cand] ?? WORDS[cand];
        if (hit) {
          parts.push(hit);
          known += n;
          total += n;
          i += n;
          matched = true;
          break;
        }
      }
      if (!matched) {
        parts.push(orig.length === words.length ? orig[i] : words[i]);
        total++;
        i++;
      }
    }
    if (parts.length) out.push(parts.join(' '));
  }
  if (!total || known / total < 0.34) return null;
  return capitalize(out.join(' '));
}

function trailingPunct(s: string): string {
  const m = s.match(/[!?]+$/);
  return m ? m[0][0] : '';
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
