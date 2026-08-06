export type CsvRow = Record<string, string>;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
    ? ";"
    : ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

export function parseCsv(text: string): CsvRow[] {
  const cleanText = text.replace(/^\uFEFF/, "").trim();
  if (!cleanText) {
    return [];
  }

  const delimiter = detectDelimiter(cleanText);
  const lines = cleanText.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

export function parseCsvNumber(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) {
    return Number.NaN;
  }

  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(",", ".");

  return Number(normalized);
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function csvTemplate(headers: string[]) {
  return `${headers.join(",")}\n`;
}
