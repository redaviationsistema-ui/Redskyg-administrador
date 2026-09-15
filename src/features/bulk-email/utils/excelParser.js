import * as XLSX from "xlsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeHeader(value, index) {
  const header = String(value || "").trim().toLowerCase();
  return header || `column_${index + 1}`;
}

function hasEmailHeader(headers = []) {
  return headers.some((header) => ["email", "correo"].includes(String(header || "").toLowerCase()));
}

function recordsFromEmailCells(rows = []) {
  return rows
    .flatMap((items) => items.map((value) => String(value || "").trim()))
    .filter((value) => EMAIL_PATTERN.test(value))
    .map((email) => ({ email }));
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
  if (!hasEmailHeader(headers)) {
    return {
      headers: ["email"],
      records: recordsFromEmailCells(rows),
    };
  }

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
