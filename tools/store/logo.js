// The Papercut logotype: stencil letters on a cream sticker with an ink edge, cut in two along a slant;
// the top half has slipped along the cut, and the red inside of the paper shows in the gap.
// Used for the store art and the menu title; the font is Big Shoulders Stencil (OFL, in fonts/), loaded as 'BSS'.
export function logo({ text = 'PAPERCUT', size = 200, angle = -8, slip = 0.07, gap = 0.11, letter = '#18171C', sticker = '#FBFAF6', edge = '#18171C', red = '#D7262E', shadow = true } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const probe = document.createElementNS(NS, 'svg'); probe.style.cssText = 'position:absolute;left:-9999px';
  const t = document.createElementNS(NS, 'text'); t.textContent = text;
  t.setAttribute('style', `font: 800 ${size}px 'BSS'; letter-spacing:${size * 0.03}px`);
  probe.appendChild(t); document.body.appendChild(probe);
  const bb = t.getBBox(); probe.remove();
  const sw = size * 0.2, pad = sw + size * 0.12;
  const W = bb.width + pad * 2, H = bb.height + pad * 2;
  const cx = W / 2, cy = H / 2 + size * 0.02;
  const a = angle * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux; // along / across the cut
  const L = W * 2;
  const half = (s) => { // polygon on one side of the cut line (s = -1 above, 1 below)
    const p1 = [cx - ux * L, cy - uy * L], p2 = [cx + ux * L, cy + uy * L];
    const p3 = [p2[0] + nx * L * s, p2[1] + ny * L * s], p4 = [p1[0] + nx * L * s, p1[1] + ny * L * s];
    return [p1, p2, p3, p4].map((p) => p.join(',')).join(' ');
  };
  // The top half slips along the cut and lifts off it a little, opening the red gap.
  const dxs = ux * size * slip - nx * size * gap * 0.5, dys = uy * size * slip - ny * size * gap * 0.5;
  const tx = cx - bb.width / 2 - bb.x, ty = cy - bb.height / 2 - bb.y;
  const word = (fill, strokeW, stroke) => `<text x="${tx}" y="${ty}" style="font: 800 ${size}px 'BSS'; letter-spacing:${size * 0.03}px" fill="${fill}" ${strokeW ? `stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="miter" stroke-miterlimit="2"` : ''}>${text}</text>`;
  const sticker3 = `${word(edge, sw + size * 0.06, edge)}${word(sticker, sw, sticker)}${word(letter, 0)}`;
  const id = 'l' + Math.random().toString(36).slice(2, 7);
  // The red inside of the paper: a band along the cut, only where the sticker is, with a darker core line.
  const band = size * gap * 0.75;
  const bandPoly = [[cx - ux * L - nx * band, cy - uy * L - ny * band], [cx + ux * L - nx * band, cy + uy * L - ny * band], [cx + ux * L + nx * band, cy + uy * L + ny * band], [cx - ux * L + nx * band, cy - uy * L + ny * band]].map((p) => p.join(',')).join(' ');
  return `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="overflow:visible">
  <defs>
    <clipPath id="${id}t"><polygon points="${half(-1)}"/></clipPath>
    <clipPath id="${id}b"><polygon points="${half(1)}"/></clipPath>
    <mask id="${id}m"><rect width="${W}" height="${H}" fill="#000"/>${word('#fff', sw + size * 0.06, '#fff')}</mask>
    ${shadow ? `<filter id="${id}s" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="${size * 0.03}" dy="${size * 0.045}" stdDeviation="${size * 0.012}" flood-color="#18171C" flood-opacity=".35"/></filter>` : ''}
  </defs>
  <g ${shadow ? `filter="url(#${id}s)"` : ''}>
    <g mask="url(#${id}m)"><polygon points="${bandPoly}" fill="${red}"/><line x1="${cx - ux * L}" y1="${cy - uy * L}" x2="${cx + ux * L}" y2="${cy + uy * L}" stroke="#8F1219" stroke-width="${size * 0.018}" transform="translate(${-nx * size * gap * 0.12},${-ny * size * gap * 0.12})"/></g>
    <g clip-path="url(#${id}b)">${sticker3}</g>
    <g transform="translate(${dxs},${dys})"><g clip-path="url(#${id}t)">${sticker3}</g></g>
  </g>
</svg>`;
}
