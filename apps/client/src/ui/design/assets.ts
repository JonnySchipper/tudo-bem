/**
 * Design mode's asset palette: every placeable sprite of the real atlases, plus the props the server gives a meaning to (a counter that opens a
 * game, a seat, a fence). Pure: it reads a manifest's sprite table and the shared prop templates, so it is unit tested.
 *
 * A sprite no layout uses yet becomes a `cenario` prop with that art (the generic scenery kind every map is mostly made of). A template keeps
 * its kind, action, seat and size: placing "Balcão da padaria" places a counter that still opens Correria.
 */
import type { PropDef } from '@tudobem/shared';
import type { SpriteInfo } from './model';

export type Category = 'furniture' | 'props' | 'plants' | 'signs' | 'npcs' | 'interactables' | 'lights' | 'decals' | 'buildings';

/** Palette tabs in order, with Portuguese labels and an English gloss. `npcs` lists the room's NPC spots (read-only: they are not layout). */
export const CATEGORIES: readonly { id: Category; pt: string; en: string }[] = [
  { id: 'furniture', pt: 'Móveis', en: 'Furniture' },
  { id: 'props', pt: 'Objetos', en: 'Props' },
  { id: 'plants', pt: 'Plantas', en: 'Plants' },
  { id: 'signs', pt: 'Placas', en: 'Signs' },
  { id: 'npcs', pt: 'NPCs', en: 'NPC spots' },
  { id: 'interactables', pt: 'Interativos', en: 'Interactables' },
  { id: 'lights', pt: 'Luzes', en: 'Lights' },
  { id: 'decals', pt: 'Chão', en: 'Decals' },
  { id: 'buildings', pt: 'Prédios', en: 'Buildings' },
];

export interface ManifestSprite extends SpriteInfo {
  atlas: string;
  frame: string;
  footprint: [number, number];
  lit?: string;
  anim?: { frames: string[] } | null;
}

export interface Asset {
  /** Stable key (favorites and recents are stored by it). */
  key: string;
  label: string;
  category: Category;
  /** Manifest key drawn for the thumbnail and the placement ghost, or null (a placeholder box). */
  sprite: string | null;
  template: PropDef;
  /** Lowercase text the search box matches. */
  search: string;
}

/** Prefixes that are not world objects (characters, effects, the HUD kit, the bout frames, terrain and walls). */
const NOT_PLACEABLE = /^(chars|fx|ui|bjj|walls|tiles|icons|portraits|backdrop|flock|wires|fence)\//;

const RULES: [Category, RegExp][] = [
  ['lights', /poste|lamp|luminaria|lanterna|lampiao|holofote|light|vela|neon/],
  ['plants', /ipe|arvore|tree|planta|plant|vaso|pot_|flor|flower|sebe|hedge|canteiro|planter|grama|grass|bush|arbusto|palm|palmeira|folha|samambaia|cacto|horta|tuft/],
  ['signs', /placa|sign|letreiro|lousa|painel|quadro|cartaz|poster|banner|faixa|totem|placar|mural|board|menu|cardapio/],
  ['furniture', /mesa|cadeira|banco|banqueta|bench|cama|sofa|poltrona|estante|prateleira|shelf|balcao|armario|cozinha|table|chair|vitrine|estufa|caixa|bicicletario|arquibancada|vestiario|tatame|geladeira|fogao|pia|tapete/],
  ['buildings', /^(facades|buildings|casas)\/|fachada|predio|edificio|loja|shop_|torre|terminal|portao|muro/],
];

/** Which tab an asset goes under. Interactive templates first, then ground art, then by name. */
export function categorize(key: string, template: PropDef, sprite: SpriteInfo | null): Category {
  if (template.action || template.seat || template.vendor) return 'interactables';
  if (template.lightAtNight || sprite?.light) return 'lights';
  if (template.kind === 'tatame' || sprite?.decal || key.startsWith('decals/')) return 'decals';
  const name = `${key} ${template.kind}`.toLowerCase();
  for (const [cat, re] of RULES) if (re.test(name)) return cat;
  return 'props';
}

/** "props/banco_praca" -> "banco praca". */
export function labelOf(key: string): string {
  return (key.split('/').pop() ?? key).replace(/_/g, ' ');
}

/** Sprites that are parts of other sprites (a roof drawn over its facade, the lit-window overlay, the folded feira stall). */
function partKeys(sprites: Record<string, ManifestSprite>): Set<string> {
  const parts = new Set<string>();
  for (const s of Object.values(sprites)) {
    if (typeof s.overhead === 'string') parts.add(s.overhead);
    if (s.lit) parts.add(s.lit);
  }
  for (const k of Object.keys(sprites)) if (k.endsWith('_fechada') || k.endsWith('_lit') || k.includes('#')) parts.add(k);
  return parts;
}

/**
 * The palette. `templates` are the shared prop templates (`propPalette()`, one per distinct prop already in some room), `artKeyOf` is the
 * renderer's PropDef -> sprite key.
 */
export function buildAssets(
  sprites: Record<string, ManifestSprite>,
  templates: readonly { key: string; label: string; template: PropDef }[],
  artKeyOf: (p: PropDef) => string | null,
): Asset[] {
  const out: Asset[] = [];
  const covered = new Set<string>();
  // a sprite some room places on its own (the closed airport booth) is offered even when it is also a part of another sprite
  const used = new Set(templates.map((t) => artKeyOf(t.template)).filter((k): k is string => !!k));
  for (const t of templates) {
    const sprite = artKeyOf(t.template);
    const def = sprite ? sprites[sprite] ?? null : null;
    // a plain scenery template is the same as the sprite entry below; keep only templates that carry a meaning or a size of their own
    if (sprite && t.template.kind === 'cenario' && !t.template.action && !t.template.seat && !t.template.label) {
      const fp = def?.footprint;
      if (!fp || (fp[0] === (t.template.w ?? 1) && fp[1] === (t.template.h ?? 1))) continue;
    }
    if (sprite) covered.add(sprite);
    const template = { ...structuredClone(t.template), id: t.template.kind };
    delete template.label;
    if (t.template.label) template.label = structuredClone(t.template.label);
    out.push({
      key: `t:${t.key}`,
      label: t.label,
      category: categorize(sprite ?? t.template.kind, t.template, def),
      sprite: def ? sprite : null,
      template,
      search: `${t.label} ${t.template.kind} ${sprite ?? ''} ${t.template.action ?? ''}`.toLowerCase(),
    });
  }
  const parts = partKeys(sprites);
  for (const [key, s] of Object.entries(sprites)) {
    if (covered.has(key) || (!used.has(key) && (NOT_PLACEABLE.test(key) || parts.has(key)))) continue;
    const [w, h] = s.footprint ?? [1, 1];
    const template: PropDef = { id: labelOf(key).replace(/ /g, '_'), kind: 'cenario', x: 0, y: 0, blocks: !s.decal && !key.startsWith('decals/'), art: key };
    if (w > 1) template.w = w;
    if (h > 1) template.h = h;
    out.push({ key: `s:${key}`, label: labelOf(key), category: categorize(key, template, s), sprite: key, template, search: `${labelOf(key)} ${key}`.toLowerCase() });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'pt'));
}

/** Search: every word must appear. */
export function matches(a: Asset, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => a.search.includes(w));
}

/** Keep `key` first in a most-recent-first list, at most `max` long. */
export function bumpRecent(list: readonly string[], key: string, max = 16): string[] {
  return [key, ...list.filter((k) => k !== key)].slice(0, max);
}
