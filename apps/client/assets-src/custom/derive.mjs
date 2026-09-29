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

export const DERIVE = {
  orelhao: props.orelhao,
  lixeira: props.lixeira,
  quiosque: props.quiosque,
  placaRua: props.placaRua,
  posteFios: wires.posteFios,
  fios: wires.fios,
  barracaChapeus: stall.barracaChapeus,
  poleiro: critters.poleiro,
  viraLata: critters.viraLata,
  onibus: vehicles.onibus,
  kombi: vauth.kombi,
  padaria: facades.padaria,
  edificio: edificio.edificio,
  academia: academia.academia,
  fusca: vauth.fusca,
  moto: vauth.moto,
  feira: feiraMod.feira,
  guideArrow: uiMod.guideArrow,
};

/** Standalone images for the DOM (`images` in import-map.json): generators return [{ key, img, meta? }]. */
export const IMAGES = {
  portraits: portraits.portraitParts,
  icons: iconsMod.iconParts,
  ui: uiMod.uiParts,
};
