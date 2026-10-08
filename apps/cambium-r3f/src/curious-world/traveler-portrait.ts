import type { TRAVELER_DESIGNS } from './character.ts';

type Design = typeof TRAVELER_DESIGNS[number];
const NS = 'http://www.w3.org/2000/svg';

/** Original vector field-kit portraits; no second renderer, texture or asset request. */
export function travelerPortrait(design: Design): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 220 248');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const p = design.colors;
  function shape(tag: 'path' | 'circle' | 'ellipse' | 'line', attrs: Record<string, string>) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node); return node;
  }
  shape('circle', { cx: '110', cy: '122', r: '83', fill: 'none', stroke: '#C59A684D', 'stroke-width': '.7' });
  shape('circle', { cx: '110', cy: '122', r: '98', fill: 'none', stroke: '#D6FFF61F', 'stroke-dasharray': '2 6' });
  shape('ellipse', { cx: '110', cy: '229', rx: '52', ry: '8', fill: '#00191D66' });
  shape('path', { d: 'M87 157L91 218Q94 224 106 220L107 167M114 167L116 219Q126 224 132 219L137 157Z', fill: p.boots });
  shape('path', { d: 'M91 214L86 223Q83 228 95 229L108 226L106 215M119 216L117 225L133 229Q140 228 135 222L132 215Z', fill: '#172B2B' });
  shape('path', { d: 'M78 102Q67 107 63 128L58 161Q58 169 64 172L72 169L84 118M139 104Q150 108 155 128L161 163Q160 172 153 173L146 167L133 118Z', fill: p.coat });
  shape('path', { d: 'M59 162Q53 176 63 178Q72 176 70 168M149 165Q144 177 154 180Q165 177 161 168Z', fill: p.skin });
  shape('path', { d: 'M86 94Q99 87 112 91L137 101L140 162L130 180L113 171L97 181L77 167L79 115Z', fill: p.coat, stroke: p.trim, 'stroke-width': '1.2' });
  shape('path', { d: 'M96 96L109 103L123 96L127 144L112 165L94 146Z', fill: design.id === 'gardener' ? p.trim : p.lining });
  shape('path', { d: 'M86 95L98 94L108 109L96 121L91 108M124 96L137 103L121 122L112 108Z', fill: p.coat, stroke: p.trim, 'stroke-width': '1.2' });
  if (design.id === 'courier') shape('path', { d: 'M87 95Q66 99 68 122L96 129L108 109L127 128L152 119L138 101L118 93Z', fill: p.coat, stroke: p.trim, 'stroke-width': '1.3' });
  shape('path', { d: 'M102 81L101 97Q110 108 120 96L117 81Z', fill: p.skin });
  shape('path', { d: 'M87 58Q88 37 111 36Q135 40 135 62L130 81Q122 97 110 97Q94 90 89 77Z', fill: p.skin });
  shape('ellipse', { cx: '88', cy: '69', rx: '4', ry: '7', fill: p.skin });
  shape('path', { d: 'M88 61Q82 36 104 30Q128 25 136 51L132 73L126 62L123 43Q110 54 91 51L92 72Z', fill: p.hair });
  shape('path', { d: 'M98 66L105 65M119 65L125 67', stroke: p.hair, 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none' });
  shape('circle', { cx: '102', cy: '69', r: '1.6', fill: '#172B2B' });
  shape('circle', { cx: '121', cy: '69', r: '1.6', fill: '#172B2B' });
  shape('path', { d: 'M111 69L108 77L112 78M105 84Q112 87 119 83', fill: 'none', stroke: '#76513F', 'stroke-width': '1.1', 'stroke-linecap': 'round' });
  const cloche = design.id === 'gardener';
  shape('path', { d: cloche ? 'M87 50Q88 27 107 27Q129 27 134 50L138 58L83 58Z' : 'M88 44L92 22Q111 17 129 25L135 47Z', fill: p.hat });
  shape('path', { d: cloche ? 'M74 56Q108 48 147 58L145 64Q111 63 78 64Z' : 'M76 48Q107 41 145 49L151 56L75 57Z', fill: p.hat, stroke: p.trim, 'stroke-width': '1' });
  shape('path', { d: cloche ? 'M90 47L132 49' : 'M91 39L133 43', fill: 'none', stroke: p.trim, 'stroke-width': '5' });
  shape('path', { d: 'M102 95L110 105L122 94L123 102L112 115L100 107Z', fill: design.id === 'courier' ? '#FFC7A1' : p.trim });
  shape('path', { d: 'M84 113L139 152', stroke: p.leather, 'stroke-width': '5', fill: 'none' });
  shape('path', { d: 'M126 143L147 148L145 168Q131 177 120 166L120 150Z', fill: p.leather, stroke: p.trim, 'stroke-width': '1' });
  shape('path', { d: 'M120 148L132 158L147 150', fill: 'none', stroke: p.trim, 'stroke-width': '1.3' });
  if (design.id === 'cartographer') {
    shape('path', { d: 'M137 145L141 119Q145 117 149 121L145 148Z', fill: '#E0EEE4', stroke: p.trim, 'stroke-width': '1' });
    shape('ellipse', { cx: '145', cy: '120', rx: '4', ry: '2', fill: '#A8B5A0' });
  }
  if (cloche) {
    shape('path', { d: 'M129 52Q129 40 142 41Q138 53 129 52Z', fill: '#3E5C40' });
    shape('path', { d: 'M140 146L145 127', stroke: p.trim, 'stroke-width': '3' });
    shape('path', { d: 'M143 128Q145 119 150 120L153 127L145 131Z', fill: '#627C73' });
  }
  return svg;
}
