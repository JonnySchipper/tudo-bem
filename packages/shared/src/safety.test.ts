import { describe, expect, it } from 'vitest';
import { classifyChat, validateName } from './safety.js';

describe('classifyChat (Jev stub)', () => {
  it.each([
    'Oi, tudo bem?',
    'Bom dia, pessoal!',
    'tá bom, cara, muito legal',
    'Vamos pra direita ou pra esquerda?',
    'Essa coxinha tá gostosa demais!',
    'meu nome é Ana, sou dos EUA',
    'eu moro no Canadá',
    'bora jogar uma pelada no parque?',
    'isso não rola',
    'que camiseta vinho bonita',
    'Me vê uma lula frita',
    'beijos, até amanhã!',
    'putz, errei o pedido',
    'I love this hat!',
    'whats up everyone',
  ])('allows normal chat: %s', (msg) => {
    const v = classifyChat(msg);
    expect(v.action).toBe('allow');
    expect(v.text).toBe(msg);
  });

  it.each([
    ['me liga 11 98765-4321', 'pii'],
    ['my email is kid@example.com', 'pii'],
    ['moro na rua Augusta 1200', 'pii'],
    ['entra em www.site-estranho.com', 'pii'],
    ['me segue no insta @meuperfil', 'off_platform_contact'],
    ['add me on discord', 'off_platform_contact'],
    ['my school is Lincoln Middle', 'pii'],
  ])('blocks PII / contact exchange: %s', (msg, label) => {
    const v = classifyChat(msg);
    expect(v.action).toBe('block');
    expect(v.labels).toContain(label);
    expect(v.text).toBe('');
    expect(v.note?.en).toBeTruthy();
  });

  it.each([
    ['what the fuck', 'profanity'],
    ['que porra é essa', 'profanity'],
    ['FUUUUCK', 'profanity'],
    ['sh1t', 'profanity'],
    ['seu viado', 'slur'],
    ['send nudes', 'sexual'],
    ['você é gostosa', 'sexual'],
    ['quer namorar comigo?', 'dating'],
    ['free coins here!! give me your password', 'scam'],
  ])('blocks constitution violations: %s', (msg, label) => {
    const v = classifyChat(msg);
    expect(v.action).toBe('block');
    expect(v.labels).toContain(label);
  });

  it('warns and masks alcohol / politics / platform names but still delivers', () => {
    const beer = classifyChat('bora tomar uma cerveja');
    expect(beer.action).toBe('warn');
    expect(beer.labels).toContain('prohibited_substance');
    expect(beer.text).toBe('bora tomar uma •••');

    const pol = classifyChat('Quem gosta do Trump?');
    expect(pol.action).toBe('warn');
    expect(pol.text).toBe('Quem gosta do •••?');

    const accented = classifyChat('Cachaça não!');
    expect(accented.action).toBe('warn');
    expect(accented.text).toBe('••• não!');
  });

  it('escalates self-harm with a supportive note', () => {
    const v = classifyChat('eu quero morrer');
    expect(v.action).toBe('escalate');
    expect(v.labels).toContain('self_harm');
    expect(v.note?.en).toMatch(/988/);
  });

  it('validates display names', () => {
    expect(validateName('Jonny').ok).toBe(true);
    expect(validateName('Maria Clara').ok).toBe(true);
    expect(validateName('a').ok).toBe(false);
    expect(validateName('ana12345').ok).toBe(false);
    expect(validateName('fuck').ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
  });
});
