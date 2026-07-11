export function parseCsv(text = "") {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(current);
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((value) => String(value || "").trim() !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += character;
  }

  row.push(current);
  if (row.some((value) => String(value || "").trim() !== "")) {
    rows.push(row);
  }

  if (!rows.length) {
    return {
      headers: [],
      records: [],
    };
  }

  const [firstRow, ...dataRows] = rows;
  const headers = firstRow.map((item) => String(item || "").trim().toLowerCase());
  const records = dataRows.map((items) =>
    headers.reduce((accumulator, header, columnIndex) => {
      accumulator[header || `column_${columnIndex + 1}`] = String(items[columnIndex] || "").trim();
      return accumulator;
    }, {}),
  );

  return { headers, records };
}
