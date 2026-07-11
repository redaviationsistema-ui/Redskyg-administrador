import * as XLSX from "xlsx";

function normalizeHeader(value, index) {
  const header = String(value || "").trim().toLowerCase();
  return header || `column_${index + 1}`;
}

export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      headers: [],
      records: [],
    };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) {
    return {
      headers: [],
      records: [],
    };
  }

  const [firstRow, ...dataRows] = rows;
  const headers = firstRow.map((value, index) => normalizeHeader(value, index));
  const records = dataRows
    .filter((items) => items.some((value) => String(value || "").trim() !== ""))
    .map((items) =>
      headers.reduce((accumulator, header, columnIndex) => {
        accumulator[header] = String(items[columnIndex] || "").trim();
        return accumulator;
      }, {}),
    );

  return { headers, records };
}
