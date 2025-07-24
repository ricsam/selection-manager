import { describe, test, expect } from "bun:test";
import { parseCSVContent, parseCSVLine } from "../src/utils";

describe("parseCSVLine", () => {
  test("should parse basic CSV line", () => {
    const result = parseCSVLine("a,b,c");
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("should parse basic TSV line", () => {
    const result = parseCSVLine("a\tb\tc");
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("should prefer tabs over commas when both are present", () => {
    const result = parseCSVLine("0,0\t0,1\t0,2");
    expect(result).toEqual(["0,0", "0,1", "0,2"]);
  });

  test("should handle quoted values with commas in CSV", () => {
    const result = parseCSVLine('"hello, world",test');
    expect(result).toEqual(["hello, world", "test"]);
  });

  test("should handle quoted values with tabs in CSV", () => {
    // When tabs are present, the parser uses tab as delimiter
    // The quotes are still processed, so they get removed
    const result = parseCSVLine('"hello\tworld",test');
    expect(result).toEqual(["hello\tworld,test"]);
  });

  test("should handle escaped quotes", () => {
    const result = parseCSVLine('"say ""hello""",test');
    expect(result).toEqual(['say "hello"', "test"]);
  });

  test("should handle empty cells", () => {
    const result = parseCSVLine("a,,c");
    expect(result).toEqual(["a", "", "c"]);
  });

  test("should handle empty cells with tabs", () => {
    const result = parseCSVLine("a\t\tc");
    expect(result).toEqual(["a", "", "c"]);
  });
});

describe("parseCSVContent", () => {
  test("should parse basic CSV content", () => {
    const content = "a,b,c\n1,2,3";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "a" },
      { rowIndex: 0, colIndex: 1, value: "b" },
      { rowIndex: 0, colIndex: 2, value: "c" },
      { rowIndex: 1, colIndex: 0, value: "1" },
      { rowIndex: 1, colIndex: 1, value: "2" },
      { rowIndex: 1, colIndex: 2, value: "3" },
    ]);
  });

  test("should parse basic TSV content", () => {
    const content = "a\tb\tc\n1\t2\t3";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "a" },
      { rowIndex: 0, colIndex: 1, value: "b" },
      { rowIndex: 0, colIndex: 2, value: "c" },
      { rowIndex: 1, colIndex: 0, value: "1" },
      { rowIndex: 1, colIndex: 1, value: "2" },
      { rowIndex: 1, colIndex: 2, value: "3" },
    ]);
  });

  test("should handle mixed comma-tab content (prefer tabs)", () => {
    const content = "0,0\t0,1\t0,2\n1,0\t1,1\t1,2";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "0,0" },
      { rowIndex: 0, colIndex: 1, value: "0,1" },
      { rowIndex: 0, colIndex: 2, value: "0,2" },
      { rowIndex: 1, colIndex: 0, value: "1,0" },
      { rowIndex: 1, colIndex: 1, value: "1,1" },
      { rowIndex: 1, colIndex: 2, value: "1,2" },
    ]);
  });

  test("should preserve row indices with empty rows", () => {
    const content = "1\t\t\n2\t\t\n\t\t\n\t\t3\n\t\t4";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "1" },
      { rowIndex: 0, colIndex: 1, value: "" },
      { rowIndex: 0, colIndex: 2, value: "" },
      { rowIndex: 1, colIndex: 0, value: "2" },
      { rowIndex: 1, colIndex: 1, value: "" },
      { rowIndex: 1, colIndex: 2, value: "" },
      { rowIndex: 3, colIndex: 0, value: "" },
      { rowIndex: 3, colIndex: 1, value: "" },
      { rowIndex: 3, colIndex: 2, value: "3" },
      { rowIndex: 4, colIndex: 0, value: "" },
      { rowIndex: 4, colIndex: 1, value: "" },
      { rowIndex: 4, colIndex: 2, value: "4" },
    ]);
  });

  test("should handle numbers with comma separators as single cells", () => {
    const content = "1,234\n5,678\n12,345";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "1,234" },
      { rowIndex: 1, colIndex: 0, value: "5,678" },
      { rowIndex: 2, colIndex: 0, value: "12,345" },
    ]);
  });

  test("should handle numbers with comma separators and decimals", () => {
    const content = "1,234.56\n5,678.90";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "1,234.56" },
      { rowIndex: 1, colIndex: 0, value: "5,678.90" },
    ]);
  });

  test("should treat simple numbers as regular CSV (not comma-separated numbers)", () => {
    const content = "1\t\t\n2\t\t\n\t\t3\n\t\t4";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "1" },
      { rowIndex: 0, colIndex: 1, value: "" },
      { rowIndex: 0, colIndex: 2, value: "" },
      { rowIndex: 1, colIndex: 0, value: "2" },
      { rowIndex: 1, colIndex: 1, value: "" },
      { rowIndex: 1, colIndex: 2, value: "" },
      { rowIndex: 2, colIndex: 0, value: "" },
      { rowIndex: 2, colIndex: 1, value: "" },
      { rowIndex: 2, colIndex: 2, value: "3" },
      { rowIndex: 3, colIndex: 0, value: "" },
      { rowIndex: 3, colIndex: 1, value: "" },
      { rowIndex: 3, colIndex: 2, value: "4" },
    ]);
  });

  test("should skip completely empty rows", () => {
    const content = "a,b\n\n\nc,d\n\n";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "a" },
      { rowIndex: 0, colIndex: 1, value: "b" },
      { rowIndex: 3, colIndex: 0, value: "c" },
      { rowIndex: 3, colIndex: 1, value: "d" },
    ]);
  });

  test("should handle Windows line endings", () => {
    const content = "a,b\r\nc,d";
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "a" },
      { rowIndex: 0, colIndex: 1, value: "b" },
      { rowIndex: 1, colIndex: 0, value: "c" },
      { rowIndex: 1, colIndex: 1, value: "d" },
    ]);
  });

  test("should handle quoted values", () => {
    // Note: Multi-line quoted values are not currently supported
    // because the parser splits on line breaks first
    const content = '"hello, world",test\n"simple",another';
    const result = parseCSVContent(content);
    expect(result).toEqual([
      { rowIndex: 0, colIndex: 0, value: "hello, world" },
      { rowIndex: 0, colIndex: 1, value: "test" },
      { rowIndex: 1, colIndex: 0, value: "simple" },
      { rowIndex: 1, colIndex: 1, value: "another" },
    ]);
  });

  test("should handle empty content", () => {
    const result = parseCSVContent("");
    expect(result).toEqual([]);
  });

  test("should handle content with only whitespace", () => {
    const result = parseCSVContent("   \n  \n  ");
    expect(result).toEqual([]);
  });

  test("should handle mixed empty and non-empty cells in TSV", () => {
    const content = "\t\t\n5\t\t\n1\t\t\n17\t\t\n11\t\t\n\t\t\n\t\t\n\t\t\n\t\t5\n\t\t1\n\t\t17\n\t\t11";
    const result = parseCSVContent(content);
    
    // Should include rows with content, skip completely empty rows
    const expected = [
      { rowIndex: 1, colIndex: 0, value: "5" },
      { rowIndex: 1, colIndex: 1, value: "" },
      { rowIndex: 1, colIndex: 2, value: "" },
      { rowIndex: 2, colIndex: 0, value: "1" },
      { rowIndex: 2, colIndex: 1, value: "" },
      { rowIndex: 2, colIndex: 2, value: "" },
      { rowIndex: 3, colIndex: 0, value: "17" },
      { rowIndex: 3, colIndex: 1, value: "" },
      { rowIndex: 3, colIndex: 2, value: "" },
      { rowIndex: 4, colIndex: 0, value: "11" },
      { rowIndex: 4, colIndex: 1, value: "" },
      { rowIndex: 4, colIndex: 2, value: "" },
      { rowIndex: 8, colIndex: 0, value: "" },
      { rowIndex: 8, colIndex: 1, value: "" },
      { rowIndex: 8, colIndex: 2, value: "5" },
      { rowIndex: 9, colIndex: 0, value: "" },
      { rowIndex: 9, colIndex: 1, value: "" },
      { rowIndex: 9, colIndex: 2, value: "1" },
      { rowIndex: 10, colIndex: 0, value: "" },
      { rowIndex: 10, colIndex: 1, value: "" },
      { rowIndex: 10, colIndex: 2, value: "17" },
      { rowIndex: 11, colIndex: 0, value: "" },
      { rowIndex: 11, colIndex: 1, value: "" },
      { rowIndex: 11, colIndex: 2, value: "11" },
    ];
    
    expect(result).toEqual(expected);
  });

  describe("single number handling", () => {
    test("should handle single number with commas as one cell", () => {
      const content = "1,234.56";
      const result = parseCSVContent(content);
      expect(result).toEqual([
        { rowIndex: 0, colIndex: 0, value: "1,234.56" },
      ]);
    });

    test("should handle single large number with multiple comma groups", () => {
      const content = "1,234,567.89";
      const result = parseCSVContent(content);
      expect(result).toEqual([
        { rowIndex: 0, colIndex: 0, value: "1,234,567.89" },
      ]);
    });

    test("should handle single number with spaces as one cell", () => {
      const content = "1 234.56";
      const result = parseCSVContent(content);
      expect(result).toEqual([
        { rowIndex: 0, colIndex: 0, value: "1 234.56" },
      ]);
    });

    test("should handle single number with multiple spaces as one cell", () => {
      const content = "1 234 567.89";
      const result = parseCSVContent(content);
      expect(result).toEqual([
        { rowIndex: 0, colIndex: 0, value: "1 234 567.89" },
      ]);
    });

    test("should handle comma-separated numbers when there are multiple values", () => {
      const content = "1,234.56,7,890.12";
      const result = parseCSVContent(content);
      expect(result).toEqual([
        { rowIndex: 0, colIndex: 0, value: "1,234.56" },
        { rowIndex: 0, colIndex: 1, value: "7,890.12" },
      ]);
    });

    test("should handle space-separated numbers when there are multiple values", () => {
      const content = "1 234.56   7 890.12";
      const result = parseCSVContent(content);
      expect(result).toEqual([
        { rowIndex: 0, colIndex: 0, value: "1 234.56" },
        { rowIndex: 0, colIndex: 1, value: "7 890.12" },
      ]);
    });

    test("should distinguish between comma-separated numbers and CSV data", () => {
      // "123,456" is a valid thousands-separated number, so it should be one cell
      const content = "123,456";
      const result = parseCSVContent(content);
      expect(result).toEqual([
        { rowIndex: 0, colIndex: 0, value: "123,456" },
      ]);
    });
  });
});
