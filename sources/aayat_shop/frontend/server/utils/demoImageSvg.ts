function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h % 360} ${s}% ${l}%)`;
}

/** SVG محلی — بدون اینترنت، همیشه 200. */
export function buildDemoImageSvg(key: string, width: number, height: number): string {
  const h = hashString(key);
  const h1 = h % 360;
  const h2 = (h1 + 47 + (h % 90)) % 360;
  const h3 = (h2 + 38 + (h % 60)) % 360;
  const bg = hsl(h1, 22, 88);
  const a = hsl(h2, 45, 62);
  const b = hsl(h3, 38, 72);
  const accent = hsl((h1 + 180) % 360, 30, 45);
  const label = key.replace(/-/g, ' ').slice(0, 28);
  const cx = width * 0.5;
  const cy = height * 0.42;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${hsl(h2, 18, 82)}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <ellipse cx="${cx}" cy="${cy + height * 0.08}" rx="${width * 0.32}" ry="${height * 0.22}" fill="${a}" opacity="0.85"/>
  <rect x="${width * 0.28}" y="${height * 0.18}" width="${width * 0.44}" height="${height * 0.38}" rx="12" fill="${b}" opacity="0.9"/>
  <circle cx="${width * 0.72}" cy="${height * 0.28}" r="${width * 0.08}" fill="${accent}" opacity="0.35"/>
  <text x="${cx}" y="${height * 0.78}" text-anchor="middle" fill="${accent}" font-family="Tahoma,sans-serif" font-size="${Math.max(14, width * 0.028)}" opacity="0.55">${escapeXml(label)}</text>
</svg>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
