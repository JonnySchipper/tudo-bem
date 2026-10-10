import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '../../../../..');
const jobs: Record<string, { scale: number; keys: string[] }> = JSON.parse(fs.readFileSync(path.join(ROOT, '.scratch/jobs.json'), 'utf8'));
it('previews', async () => {
  for (const [out, { scale: s, keys }] of Object.entries(jobs)) {
    const imgs: { f: string; w: number; h: number }[] = [];
    for (const k of keys) {
      const f = fs.existsSync(path.join(ROOT, k)) ? path.join(ROOT, k) : path.join(ROOT, `apps/client/assets-src/custom/png/${k.replaceAll('/', '_')}.png`);
      const m = await sharp(f).metadata();
      imgs.push({ f, w: m.width! * s, h: m.height! * s });
    }
    const W = imgs.reduce((a, i) => a + i.w + 8, 8);
    const H = Math.max(...imgs.map((i) => i.h)) + 16;
    const comps = [];
    let x = 8;
    for (const i of imgs) {
      comps.push({ input: await sharp(i.f).resize(i.w, i.h, { kernel: 'nearest' }).toBuffer(), left: x, top: 8 });
      x += i.w + 8;
    }
    await sharp({ create: { width: W, height: H, channels: 4, background: { r: 120, g: 160, b: 150, alpha: 1 } } }).composite(comps).png().toFile(path.join(ROOT, '.scratch', out));
  }
}, 60000);
