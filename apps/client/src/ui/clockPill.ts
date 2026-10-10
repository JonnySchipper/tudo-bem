/**
 * The HUD clock pill (HOWTO Phase 6 step 2), top-left next to the brand: `sexta-feira (Friday) · 17:40 · ☀️`.
 * The weekday is the full Portuguese name plus a small English gloss (the short tag stays off the screen).
 * The tooltip keeps the English clock and weather: `sexta-feira (Friday) · 5:40 pm · Sunny`.
 * It updates when the game minute (or the weather) changes.
 */
import { WEATHER_COPY, formatClock, period, weekday, weekdayLabel, type Weather } from '@tudobem/shared';
import { clock } from '../gameClock';
import { h } from './dom';

/** 17:40 -> "5:40 pm" (the English reading; midnight is 12:00 am, noon 12:00 pm). */
export function clock12h(min: number): string {
  const m = Math.max(0, Math.min(1439, Math.floor(min)));
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}

/** A weather symbol for the pill: sun by day, moon by night when it is clear. */
export function weatherEmoji(weather: Weather, min: number): string {
  switch (weather) {
    case 'sol':
      return min >= 360 && min < 1080 ? '☀️' : '🌙';
    case 'nublado':
      return '☁️';
    case 'garoa':
      return '🌦️';
    case 'chuva':
      return '🌧️';
  }
}

export interface ClockPillView {
  /** Full Portuguese weekday, e.g. `sexta-feira`. */
  pt: string;
  /** English weekday, e.g. `Friday`. */
  en: string;
  /** `sexta-feira (Friday)` */
  day: string;
  time: string;
  emoji: string;
  /** `sexta-feira (Friday) · 17:40 · ☀️` */
  text: string;
  /** `sexta-feira (Friday) · 5:40 pm · Sunny` */
  title: string;
  /** part of the day, for styling */
  period: string;
}

/** What the pill shows for a game day number, a game minute and a weather. Pure. */
export function clockPillView(day: number, min: number, weather: Weather): ClockPillView {
  const wd = weekday(day);
  const time = formatClock(min);
  const emoji = weatherEmoji(weather, min);
  const label = weekdayLabel(wd);
  return {
    pt: wd.pt,
    en: wd.en,
    day: label,
    time,
    emoji,
    text: `${label} · ${time} · ${emoji}`,
    title: `${label} · ${clock12h(min)} · ${WEATHER_COPY[weather].en}`,
    period: period(min),
  };
}

/** Build the pill and keep it current. Returns the element; the timer stops itself when the element leaves the page. */
export function mountClockPill(): HTMLElement {
  const ptEl = h('b', { class: 'cp-pt', lang: 'pt-BR' });
  const glossEl = h('i', { class: 'hud-gloss cp-gloss' });
  const dayEl = h('span', { class: 'cp-day' }, ptEl, glossEl);
  const timeEl = h('span', { class: 'cp-time' });
  const wxEl = h('span', { class: 'cp-wx', 'aria-hidden': 'true' });
  const el = h(
    'span',
    { class: 'hud-clock clock-pill', id: 'clock-pill', role: 'timer', 'aria-live': 'off' },
    dayEl,
    h('span', { class: 'cp-when' }, h('span', { class: 'cp-sep' }, '·'), timeEl, h('span', { class: 'cp-sep' }, '·'), wxEl),
  );
  let last = '';
  const tick = () => {
    const v = clockPillView(clock.day(), clock.minutes(), clock.weather());
    if (v.text === last) return;
    last = v.text;
    ptEl.textContent = v.pt;
    glossEl.textContent = `(${v.en})`;
    timeEl.textContent = v.time;
    wxEl.textContent = v.emoji;
    el.title = v.title;
    el.setAttribute('aria-label', v.title);
    el.dataset.period = v.period;
  };
  tick();
  const id = window.setInterval(() => {
    if (!el.isConnected) {
      window.clearInterval(id);
      return;
    }
    tick();
  }, 500);
  return el;
}
