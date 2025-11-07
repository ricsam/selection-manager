export type CellData = {
  rowIndex: number;
  colIndex: number;
  value: string;
};

export type Format = 'csv' | 'tsv';

// CSV/TSV parsing utilities
export const parseCSVLine = (line: string, delimiter?: string): string[] => {
  // Auto-detect delimiter: if line contains tabs, use tab; otherwise use comma
  // Or use provided delimiter if specified
  const actualDelimiter = delimiter ?? (line.includes('\t') ? '\t' : ',');
  
  // First, identify all quote-protected ranges
  const protectedRanges: Array<{start: number, end: number}> = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      const start = i;
      i++; // Skip opening quote
      
      // Find the closing quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // Escaped quote, skip both
            i += 2;
          } else {
            // Found closing quote
            protectedRanges.push({start, end: i});
            i++;
            break;
          }
        } else {
          i++;
        }
      }
    } else {
      i++;
    }
  }

  // Now split on delimiters, but skip any that are in protected ranges
  const result: string[] = [];
  let fieldStart = 0;
  
  for (let pos = 0; pos < line.length; pos++) {
    const char = line[pos];
    
    if (char === actualDelimiter) {
      // Check if this delimiter is protected
      const isProtected = protectedRanges.some(range => 
        pos > range.start && pos < range.end
      );
      
      if (!isProtected) {
        // This is a real delimiter
        const field = line.substring(fieldStart, pos);
        result.push(processCSVField(field));
        fieldStart = pos + 1;
      }
    }
  }
  
  // Add the last field
  const lastField = line.substring(fieldStart);
  result.push(processCSVField(lastField));
  
  return result;
};

// Helper function to process individual CSV fields
const processCSVField = (field: string): string => {
  // If field is entirely surrounded by quotes, remove them and handle escapes
  if (field.length >= 2 && field[0] === '"' && field[field.length - 1] === '"') {
    // Check if this looks like a properly quoted CSV field by ensuring all quotes are properly escaped
    let hasUnpairedQuotes = false;
    
    for (let i = 1; i < field.length - 1; i++) {
      if (field[i] === '"') {
        if (i + 1 < field.length - 1 && field[i + 1] === '"') {
          // Escaped quote, skip both
          i++;
        } else {
          // Unpaired quote in the middle
          hasUnpairedQuotes = true;
          break;
        }
      }
    }
    
    if (!hasUnpairedQuotes) {
      // Remove outer quotes and unescape inner quotes
      return field.slice(1, -1).replace(/""/g, '"');
    }
  }
  
  // Return field as-is (may contain quotes in the middle)
  return field;
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
const parseDelimitedLine = (line: string, formats?: Format[]): string[] => {
  // If formats are specified, use them to guide parsing
  if (formats && formats.length > 0) {
    // Prefer TSV over CSV if both are present
    if (formats.includes('tsv')) {
      return parseCSVLine(line, '\t');
    } else if (formats.includes('csv')) {
      // When CSV format is explicitly specified, parse as CSV (don't treat as formatted numbers)
      return parseCSVLine(line, ',');
    }
  }
  
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

export const parseCSVContent = (content: string, formats: Format[] = []): CellData[] => {
  const lines = content.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim());

  const cellData: CellData[] = [];

  // Special case: if entire content is a single formatted number, treat as one cell
  // Skip this if formats are explicitly specified (user wants CSV/TSV parsing)
  if (!formats || formats.length === 0) {
    if (isSingleFormattedNumber(content)) {
      cellData.push({
        rowIndex: 0,
        colIndex: 0,
        value: content.trim(),
      });
      return cellData;
    }
  }

  // Check if all non-empty lines look like numbers with comma separators
  // Skip this if formats are explicitly specified (user wants CSV/TSV parsing)
  const allLookLikeNumbers =
    (!formats || formats.length === 0) &&
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every(isNumberWithCommas);

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
      const parsedLine = parseDelimitedLine(line, formats);
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
