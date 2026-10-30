export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
}
