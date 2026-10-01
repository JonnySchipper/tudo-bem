// Registry of `derive` generators used by import-map.json ({ "kind": "derive", "fn": "<name>" }).
// Each generator gets ctx = { load(spec), sheet(alias), map } and returns parts: [{ key?, img | frames[], fps?, anchor, meta? }].
import * as props from './props.mjs';
import * as wires from './wires.mjs';
import * as stall from './stall.mjs';
import * as critters from './critters.mjs';
import * as vehicles from './vehicles.mjs';
import * as vauth from './vehicles-auth.mjs';
import * as facades from './facades.mjs';
import * as edificio from './edificio.mjs';
import * as academia from './academia.mjs';
import * as portraits from './portraits.mjs';
import * as feiraMod from './feira.mjs';
import * as iconsMod from './icons.mjs';
import * as uiMod from './ui.mjs';
import * as uiIconsMod from './uiicons.mjs';
import * as vilaMod from './vila.mjs';
import * as telhadosMod from './telhados.mjs';
import * as backdropMod from './backdrop.mjs';
import * as fundosMod from './fundos.mjs';
import * as frame3Mod from './frame3.mjs';
import { soleira } from './v3.mjs';

/** V3: every street facade gets the darker soleira band where the wall meets the sidewalk. */
const withBase = (fn) => async (ctx) => {
  const parts = await fn(ctx);
  for (const p of parts) if (p.img && !String(p.key ?? '').endsWith('_lit')) soleira(p.img);
  return parts;
};

import * as wallsMod from './walls.mjs';
import * as padariaMod from './padaria.mjs';
import * as kitnetMod from './kitnet.mjs';
import * as gymMod from './gym.mjs';
import * as v2Mod from './v2.mjs';

export const PREP = v2Mod.PREP;

export const DERIVE = {
  ...(v2Mod.DERIVE_V2 ?? {}),
  ...padariaMod.DERIVE_PADARIA,
  ...kitnetMod.DERIVE_KITNET,
  ...gymMod.DERIVE_GYM,
  wallSet: wallsMod.wallSet,
  wallDecor: wallsMod.wallDecor,
  doorPart: wallsMod.doorPart,
  orelhao: props.orelhao,
  lixeira: props.lixeira,
  quiosque: props.quiosque,
  placaRua: props.placaRua,
  posteFios: wires.posteFios,
  fios: wires.fios,
  barracaChapeus: stall.barracaChapeus,
  poleiro: critters.poleiro,
  parrotCompanion: critters.parrotCompanion,
  viraLata: critters.viraLata,
  onibus: vehicles.onibus,
  kombi: vauth.kombi,
  padaria: withBase(facades.padaria),
  edificio: withBase(edificio.edificio),
  academia: withBase(academia.academia),
  fusca: vauth.fusca,
  moto: vauth.moto,
  feira: feiraMod.feira,
  guideArrow: uiMod.guideArrow,
  casas: vilaMod.casas,
  telhados: telhadosMod.telhados,
  fundos: fundosMod.fundos,
  frameSet: frame3Mod.frameSet,
  frameExterior: frame3Mod.exteriorPart,
  edicula: telhadosMod.edicula_part,
  skyline: backdropMod.skyline,
  pontoOnibus: vilaMod.pontoOnibusPart,
  emBreve: vilaMod.emBrevePart,
};

/** Standalone images for the DOM (`images` in import-map.json): generators return [{ key, img, meta? }]. */
export const IMAGES = {
  portraits: portraits.portraitParts,
  icons: iconsMod.iconParts,
  ui: uiMod.uiParts,
  uiicons: uiIconsMod.uiIconParts,
  parrot: critters.parrotStrip,
};
