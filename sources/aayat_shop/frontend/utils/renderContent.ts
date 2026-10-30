/** Simple markdown-ish renderer for CMS pages (headings, lists, tables, paragraphs). */
export function renderContentHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const html: string[] = [];
  let listItems: string[] = [];
  let tableRows: string[] = [];

  function flushList() {
    if (!listItems.length) return;
    html.push(
      `<ul class="list-disc ms-5 my-2 space-y-1 leading-7">${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`
    );
    listItems = [];
  }

  function parseCells(row: string) {
    return row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  function isSeparator(cells: string[]) {
    return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, '')));
  }

  function flushTable() {
    if (!tableRows.length) return;

    if (tableRows.length === 1) {
      html.push(`<p class="mb-2 leading-7">${tableRows[0]}</p>`);
      tableRows = [];
      return;
    }

    const parsed = tableRows.map(parseCells);
    const header = parsed[0] || [];
    const body = parsed.slice(1).filter((row) => !isSeparator(row));

    const head = header
      .map((cell) => `<th>${cell}</th>`)
      .join('');
    const rows = body
      .map((row) => `<tr>${row.map((cell) => `<td>${cell || '—'}</td>`).join('')}</tr>`)
      .join('');

    html.push(
      `<div class="overflow-x-auto my-3"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
    );
    tableRows = [];
  }

  function headingOrParagraph(line: string) {
    if (/^### /.test(line)) {
      html.push(`<h3 class="text-base font-bold mt-5 mb-2">${line.slice(4)}</h3>`);
      return;
    }
    if (/^## /.test(line)) {
      html.push(`<h2 class="text-lg font-bold mt-5 mb-2">${line.slice(3)}</h2>`);
      return;
    }
    if (/^# /.test(line)) {
      html.push(`<h1 class="text-xl font-bold mb-3">${line.slice(2)}</h1>`);
      return;
    }
    if (!line.trim()) return;
    html.push(`<p class="mb-2 leading-7">${line}</p>`);
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      flushList();
      tableRows.push(trimmed);
      continue;
    }

    flushTable();

    if (/^[-*] /.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*] /, ''));
      continue;
    }

    flushList();
    headingOrParagraph(line);
  }

  flushList();
  flushTable();
  return html.join('');
}
