import { h } from './dom';

/**
 * Composer scaffold: Praça late-afternoon hero with Padaria awning in mid-ground (one scene, not collage).
 * OPUS-VISUAL: painted isometric Praça, ipê canopy, glass case specular, Copan haze.
 */
export function createIntroHeroScene(): HTMLElement {
  const wrap = h('div', { class: 'intro-hero-scene', 'aria-hidden': 'true' });
  wrap.innerHTML = `<svg class="intro-hero-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 700" preserveAspectRatio="xMidYMid slice" role="presentation">
  <defs>
    <linearGradient id="tb-sky" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#b8d4e0"/>
      <stop offset="55%" stop-color="#A8C5D4"/>
      <stop offset="100%" stop-color="#e8c9a0"/>
    </linearGradient>
    <linearGradient id="tb-sun" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,236,196,0.55)"/>
      <stop offset="100%" stop-color="rgba(255,236,196,0)"/>
    </linearGradient>
    <linearGradient id="tb-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d4a574"/>
      <stop offset="100%" stop-color="#8b5e3c"/>
    </linearGradient>
  </defs>
  <rect width="390" height="700" fill="url(#tb-sky)"/>
  <ellipse cx="70" cy="120" rx="120" ry="80" fill="url(#tb-sun)"/>
  <!-- Praça ground / calçada -->
  <path d="M0 420 L390 380 L390 700 L0 700 Z" fill="url(#tb-ground)" opacity="0.92"/>
  <path d="M0 440 L390 400" stroke="#2C2C2C" stroke-width="1.2" opacity="0.15" fill="none"/>
  <!-- Fountain hint -->
  <ellipse cx="118" cy="468" rx="34" ry="12" fill="#9A9A92" opacity="0.35"/>
  <path d="M118 430 Q118 455 118 468" stroke="#A8C5D4" stroke-width="3" opacity="0.5"/>
  <!-- Ipê / trees -->
  <ellipse cx="52" cy="400" rx="38" ry="28" fill="#2F5D50" opacity="0.85"/>
  <ellipse cx="48" cy="385" rx="30" ry="22" fill="#f5cf3f" opacity="0.75"/>
  <ellipse cx="200" cy="395" rx="42" ry="30" fill="#2F5D50" opacity="0.8"/>
  <ellipse cx="195" cy="378" rx="34" ry="24" fill="#D4A017" opacity="0.7"/>
  <!-- Bench silhouettes -->
  <rect x="28" y="448" width="36" height="8" rx="3" fill="#8b5e3c" opacity="0.7"/>
  <rect x="240" y="438" width="40" height="8" rx="3" fill="#8b5e3c" opacity="0.65"/>
  <!-- Padaria mid-ground (readable awning) -->
  <rect x="218" y="318" width="132" height="88" rx="6" fill="#F5E6D3" stroke="#2C2C2C" stroke-width="1.6"/>
  <path d="M210 318 L360 302 L360 332 L210 348 Z" fill="#C45C26" stroke="#2C2C2C" stroke-width="1.6"/>
  <path d="M218 332 L340 320" stroke="#8f3e15" stroke-width="2" opacity="0.5"/>
  <rect x="232" y="352" width="48" height="42" rx="3" fill="#d9eef5" stroke="#2C2C2C" stroke-width="1.2" opacity="0.9"/>
  <rect x="288" y="352" width="48" height="42" rx="3" fill="#d9eef5" stroke="#2C2C2C" stroke-width="1.2" opacity="0.85"/>
  <rect x="248" y="368" width="72" height="6" rx="2" fill="#8b5e3c" opacity="0.5"/>
  <!-- Warm key from left -->
  <rect width="390" height="700" fill="url(#tb-sun)" opacity="0.35"/>
</svg>`;
  return wrap;
}
