import { buildDemoImageSvg } from '../../utils/demoImageSvg';

export default defineEventHandler((event) => {
  const key = getRouterParam(event, 'key') || 'default';
  const query = getQuery(event);
  const w = Math.min(2400, Math.max(120, Number(query.w) || 534));
  const h = Math.min(3600, Math.max(120, Number(query.h) || 800));

  const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '-');
  const svg = buildDemoImageSvg(safeKey, w, h);

  setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
  return svg;
});
