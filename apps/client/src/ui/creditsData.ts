/** Credits data (pure, so it is tested without a DOM). The panel is in credits.ts. */

export interface CreditLine {
  id: string;
  /** what the credit is for, PT + EN */
  role: { pt: string; en: string };
  /** who / what, plain text (names are not translated) */
  who: string;
  /** shown after the name, small */
  note?: string;
  link?: { href: string; label: string };
}

export const LIMEZU_URL = 'https://limezu.itch.io/';

export const CREDITS: CreditLine[] = [
  {
    id: 'art',
    role: { pt: 'Arte', en: 'Art' },
    who: 'LimeZu',
    note: 'Modern Exteriors e Modern Interiors',
    link: { href: LIMEZU_URL, label: 'limezu.itch.io' },
  },
  {
    id: 'vila',
    role: { pt: 'Peças originais', en: 'Original pieces' },
    who: 'Vila Ipê',
    note: 'Retratos, vira-lata, barracas da feira, kombi, fusca e fachadas',
  },
  {
    id: 'voices',
    role: { pt: 'Vozes', en: 'Voices' },
    who: 'Microsoft Edge neural TTS',
    note: 'pt-BR Antonio (Seu Carlos) e Francisca (papagaio e avisos), gravadas antes com edge-tts',
  },
  {
    id: 'fonts',
    role: { pt: 'Fontes', en: 'Fonts' },
    who: 'Nunito, Baloo 2 e Pixelify Sans',
    note: 'Google Fonts, licença SIL Open Font',
    link: { href: 'https://fonts.google.com/', label: 'fonts.google.com' },
  },
  {
    id: 'engine',
    role: { pt: 'Motor do mundo', en: 'World engine' },
    who: 'Phaser 3',
    note: 'licença MIT',
    link: { href: 'https://phaser.io/', label: 'phaser.io' },
  },
  {
    id: 'sound',
    role: { pt: 'Música e sons', en: 'Music and sound' },
    who: 'Sintetizados no navegador (Web Audio)',
    note: 'nenhum arquivo de terceiros; áudio CC0 será listado aqui quando entrar',
  },
];
