export type CellData = {
  rowIndex: number;
  colIndex: number;
  value: string;
};

// CSV/TSV parsing utilities
export const parseCSVLine = (line: string): string[] => {
  // Auto-detect delimiter: prefer tabs over commas if tabs are present
  const delimiter = line.includes("\t") ? "\t" : ",";

  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

// Parse comma-separated formatted numbers intelligently
const parseFormattedNumbers = (line: string): string[] => {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // Pattern to match formatted numbers: 1-3 digits, comma, exactly 3 digits, optional decimal
  const formattedNumberPattern = /\d{1,3}(?:,\d{3})+(?:\.\d+)?/g;
  const matches = trimmed.match(formattedNumberPattern);

  if (!matches || matches.length === 0) {
    // No formatted numbers found, use regular CSV parsing
    return parseCSVLine(line);
  }

  // Check if the entire string is just formatted numbers separated by commas
  const reconstructed = matches.join(",");
  if (reconstructed === trimmed) {
    // The entire string is formatted numbers separated by commas
    return matches;
  }

  // Check if all comma-separated parts are valid formatted numbers
  const parts = trimmed.split(",");
  const allPartsAreFormattedNumbers = parts.every((part) => {
    const partTrimmed = part.trim();
    return (
      /^\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(partTrimmed) &&
      partTrimmed.includes(",")
    ); // Must actually have comma formatting
  });

  if (allPartsAreFormattedNumbers) {
    return parts;
  }

  // Fall back to regular CSV parsing
  return parseCSVLine(line);
};

// Enhanced parsing that handles CSV, TSV, and space-separated values
const parseDelimitedLine = (line: string): string[] => {
  // Auto-detect delimiter: prefer tabs > commas > spaces

  if (line.includes("\t")) {
    // Tab-separated - use tab delimiter
    return parseCSVLine(line);
  } else if (line.includes(",")) {
    // Could be CSV or formatted numbers - try smart parsing
    return parseFormattedNumbers(line);
  } else {
    // Check if this looks like space-separated formatted numbers
    const spaceSeparatedPattern =
      /\d+(\s\d{3})*(\.\d+)?\s+\d+(\s\d{3})*(\.\d+)?/;
    if (spaceSeparatedPattern.test(line.trim())) {
      // Split on multiple spaces (2 or more), preserving single spaces within numbers
      return line
        .trim()
        .split(/\s{2,}/)
        .filter((part) => part.trim() !== "");
    } else {
      // Single value or simple comma-separated
      return line.trim() ? [line.trim()] : [];
    }
  }
};

// Helper function to detect if a string looks like a number with comma separators
const isNumberWithCommas = (str: string): boolean => {
  const trimmed = str.trim();
  if (!trimmed) return false;

  // Match numbers with thousands separators: 1,234 or 1,234.56 or 12,345.67
  // Must start with 1-3 digits, then comma, then groups of exactly 3 digits, optionally ending with decimal
  // IMPORTANT: Must actually contain commas to be considered a "number with commas"
  const pattern = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
  return pattern.test(trimmed);
};

// Helper function to detect if a string looks like a number with space separators
const isNumberWithSpaces = (str: string): boolean => {
  const trimmed = str.trim();
  if (!trimmed) return false;

  // Match numbers with space separators: 1 234 or 1 234.56 or 12 345.67
  // Must start with 1-3 digits, then space, then groups of exactly 3 digits, optionally ending with decimal
  const pattern = /^\d{1,3}( \d{3})+(\.\d+)?$/;
  return pattern.test(trimmed);
};

// Helper function to detect if content is a single formatted number
const isSingleFormattedNumber = (content: string): boolean => {
  const trimmed = content.trim();
  const lines = trimmed.split(/\r?\n/);

  // Must be exactly one non-empty line
  if (lines.length !== 1) return false;

  const line = lines[0]?.trim();
  if (!line) return false;

  return isNumberWithCommas(line) || isNumberWithSpaces(line);
};

export const parseCSVContent = (content: string): CellData[] => {
  const lines = content.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim());

  const cellData: CellData[] = [];

  // Special case: if entire content is a single formatted number, treat as one cell
  if (isSingleFormattedNumber(content)) {
    cellData.push({
      rowIndex: 0,
      colIndex: 0,
      value: content.trim(),
    });
    return cellData;
  }

  // Check if all non-empty lines look like numbers with comma separators
  const allLookLikeNumbers =
    nonEmptyLines.length > 0 && nonEmptyLines.every(isNumberWithCommas);

  if (allLookLikeNumbers) {
    // Treat each line as a single cell (number with commas)
    // But preserve original row indices
    lines.forEach((line, rowIndex) => {
      const trimmed = line.trim();
      if (trimmed) {
        cellData.push({
          rowIndex,
          colIndex: 0,
          value: trimmed,
        });
      }
    });
  } else {
    // Use normal CSV/TSV/space-separated parsing, preserving original row structure
    lines.forEach((line, rowIndex) => {
      const parsedLine = parseDelimitedLine(line);
      // Only process rows that have at least one non-empty cell
      if (parsedLine.some((cell) => cell.trim() !== "")) {
        parsedLine.forEach((cellValue, colIndex) => {
          cellData.push({
            rowIndex,
            colIndex,
            value: cellValue,
          });
        });
      }
    });
  }

  return cellData;
};

export function writeToClipboard(data: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data).catch(console.error);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = data;
    document.body.appendChild(textArea);
    textArea.select();
  }
}
