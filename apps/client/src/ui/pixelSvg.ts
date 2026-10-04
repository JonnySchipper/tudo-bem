/** A pixel picture as SVG: one `<rect>` per art pixel, `rows` one character per pixel, `ink` maps a character to a colour (others are empty). */
export function pixelSvg(rows: readonly string[], ink: Record<string, string>, cls: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${Math.max(...rows.map((r) => r.length))} ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = ink[row[x]!];
      if (!c) continue;
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1');
      r.setAttribute('height', '1');
      r.setAttribute('fill', c);
      svg.append(r);
    }
  });
  return svg;
}
