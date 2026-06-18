/**
 * 极简 RFC4180 风格 CSV 解析 —— 正确处理引号字段（字段内可含逗号、换行、转义的双引号 ""）。
 * 之前用 `text.split('\n')` + `line.split(',')` 会在 story 里带逗号/换行时串列，这里彻底解决。
 */

/** 把整段 CSV 文本切成二维单元格（按引号状态正确处理逗号/换行）。 */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // 转义的双引号
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); field = '';
        rows.push(row); row = [];
      } else if (ch === '\r') {
        // \r\n 交给随后的 \n 处理；落单的 \r（老 Mac 行尾）当作换行
        if (text[i + 1] !== '\n') {
          row.push(field); field = '';
          rows.push(row); row = [];
        }
      } else {
        field += ch;
      }
    }
  }
  // 收尾：最后一个字段 / 行（文件末尾可能没有换行）
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 解析成对象数组：第一行作表头，跳过全空行；所有值 trim。 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim() !== '')) // 跳过空行
    .map((cells) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
      return obj;
    });
}
