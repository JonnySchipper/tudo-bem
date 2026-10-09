/**
 * Bundled per-room prop layouts. The client and the server both load these; a saved override on the server replaces one room at runtime.
 * Positions used to live inline in `rooms.ts`. The JSON is the placement source now (design mode commits it back in a pull request).
 */
import type { PropDef } from './rooms.js';
import type { RoomId } from './types.js';
import praca from '../layouts/praca.json';
import rua from '../layouts/rua.json';
import ruaLeste from '../layouts/rua_leste.json';
import feira from '../layouts/feira.json';
import padaria from '../layouts/padaria.json';
import kitnet from '../layouts/kitnet.json';
import academia from '../layouts/academia.json';
import escola from '../layouts/escola.json';
import andar from '../layouts/andar.json';
import aeroporto from '../layouts/aeroporto.json';
import desembarque from '../layouts/desembarque.json';

const FILES: Record<RoomId, { objects: PropDef[] }> = {
  praca: praca as { objects: PropDef[] },
  rua: rua as { objects: PropDef[] },
  rua_leste: ruaLeste as { objects: PropDef[] },
  feira: feira as { objects: PropDef[] },
  padaria: padaria as { objects: PropDef[] },
  kitnet: kitnet as { objects: PropDef[] },
  academia: academia as { objects: PropDef[] },
  escola: escola as { objects: PropDef[] },
  andar: andar as { objects: PropDef[] },
  aeroporto: aeroporto as { objects: PropDef[] },
  desembarque: desembarque as { objects: PropDef[] },
};

/** A fresh copy of the layout shipped in the repo. Edits must not mutate the module's JSON. */
export function bundledObjects(room: RoomId): PropDef[] {
  return JSON.parse(JSON.stringify(FILES[room].objects)) as PropDef[];
}
