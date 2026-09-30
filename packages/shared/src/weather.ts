/**
 * Deterministic game weather (HOWTO Phase 6 step 4). One roll per game day from a seed; the weather
 * changes only at 06:00, so before 06:00 the previous game day's roll is still in effect.
 */
import { gameDay, gameMinutes } from './clock.js';
import { mulberry32 } from './meveum.js';
import type { Bilingual } from './types.js';

export type Weather = 'sol' | 'nublado' | 'garoa' | 'chuva';

export const WEATHER_KINDS: readonly Weather[] = ['sol', 'nublado', 'garoa', 'chuva'];

/** Cumulative thresholds: sol 55%, nublado 25%, garoa 15%, chuva 5%. */
const T_SOL = 0.55;
const T_NUBLADO = 0.8;
const T_GAROA = 0.95;

/** Minute of the game day at which the weather changes (06:00). */
export const WEATHER_CHANGE_MIN = 360;

const WEATHER_SALT = 0x9e3779b1;

/** The roll for one game day (any integer, negative included). Pure. */
export function weatherFor(gameDayNumber: number): Weather {
  const seed = (Math.imul(Math.floor(gameDayNumber) | 0, 0x85ebca6b) ^ WEATHER_SALT) >>> 0;
  const rng = mulberry32(seed);
  rng(); // discard the first output: sequential seeds correlate slightly in the first draw
  const r = rng();
  if (r < T_SOL) return 'sol';
  if (r < T_NUBLADO) return 'nublado';
  if (r < T_GAROA) return 'garoa';
  return 'chuva';
}

/** The weather in effect at a timestamp: today's roll from 06:00, yesterday's before that. */
export function weatherAt(nowMs: number): Weather {
  const day = gameDay(nowMs);
  return weatherFor(gameMinutes(nowMs) < WEATHER_CHANGE_MIN ? day - 1 : day);
}

// needs_br: true
export const WEATHER_COPY: Record<Weather, Bilingual> = {
  sol: { pt: 'Sol', en: 'Sunny' },
  nublado: { pt: 'Nublado', en: 'Cloudy' },
  garoa: { pt: 'Garoa', en: 'Drizzle' },
  chuva: { pt: 'Chuva', en: 'Rain' },
};

// needs_br: true
export const WEATHER_IDLE_LINES: Record<Weather, Bilingual[]> = {
  sol: [
    { pt: 'Que dia lindo, hein?', en: 'What a beautiful day, huh?' },
    { pt: 'Hoje tá um solzão!', en: "It's really sunny today!" },
    { pt: 'Dia bom pra passear.', en: 'Good day for a walk.' },
  ],
  nublado: [
    { pt: 'Hoje tá nublado.', en: "It's cloudy today." },
    { pt: 'Acho que vai chover.', en: 'I think it will rain.' },
    { pt: 'Tá meio cinza hoje, né?', en: "It's a bit grey today, isn't it?" },
  ],
  garoa: [
    { pt: 'Que garoa, hein?', en: 'What a drizzle, huh?' },
    { pt: 'Tá garoando de novo.', en: "It's drizzling again." },
    { pt: 'São Paulo, a terra da garoa!', en: 'São Paulo, the land of drizzle!' },
  ],
  chuva: [
    { pt: 'Que chuva forte!', en: 'What heavy rain!' },
    { pt: 'Tô sem guarda-chuva!', en: "I don't have an umbrella!" },
    { pt: 'Vamos ficar aqui até parar.', en: "Let's stay here until it stops." },
  ],
};
