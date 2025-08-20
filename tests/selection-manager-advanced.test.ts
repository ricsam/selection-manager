import { SelectionManager } from "../src/selection-manager";
import { expect, describe, it, beforeEach, mock } from "bun:test";

describe("SelectionManager Advanced Tests", () => {
  let selectionManager: SelectionManager;

  beforeEach(() => {
    selectionManager = new SelectionManager(
      () => ({ type: "number" as const, value: 10 }),
      () => ({ type: "number" as const, value: 5 }),
      () => [],
    );
  });

  describe("Border and Styling", () => {
    it("should provide correct box shadow for selected cells", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      const boxShadow = selectionManager.getCellBoxShadow({ row: 1, col: 1 });
      expect(boxShadow).toBeDefined();
      expect(typeof boxShadow).toBe("string");
      expect(boxShadow).toContain("#2196F3");
    });

    it("should provide header box shadow for selected rows", () => {
      selectionManager.headerMouseDown(1, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      const boxShadow = selectionManager.getHeaderBoxShadow(1, "row");
      expect(boxShadow).toBeDefined();
      expect(typeof boxShadow).toBe("string");
    });

    it("should provide container box shadow when focused", () => {
      selectionManager.focus();
      const boxShadow = selectionManager.getContainerBoxShadow();
      expect(boxShadow).toBe("0 0 0 1px #2196F3");

      selectionManager.blur();
      expect(selectionManager.getContainerBoxShadow()).toBeUndefined();
    });

    it("should generate custom box shadow", () => {
      const boxShadow = selectionManager.getBoxShadow({
        color: "#ff0000",
        position: ["top", "left"],
      });
      expect(boxShadow).toContain("#ff0000");
      expect(boxShadow).toContain("inset 0 2px 0 0");
      expect(boxShadow).toContain("inset 2px 0 0 0");
    });

    it("should handle hovering over cells", () => {
      selectionManager.cellMouseEnter(2, 3);
      expect(selectionManager.isHoveringCell(2, 3)).toBe(true);
      expect(selectionManager.isHoveringCell(1, 1)).toBe(false);
    });

    it("should cancel hovering", () => {
      selectionManager.cellMouseEnter(2, 3);
      expect(selectionManager.isHoveringCell(2, 3)).toBe(true);
      
      selectionManager.cancelHovering();
      expect(selectionManager.isHovering.type).toBe("none");
    });
  });

  describe("Data Operations", () => {
    it("should export selection as TSV with proper format", () => {
      const data = new Map([
        ["0,0", "A"],
        ["0,1", "B"],
        ["1,0", "C"],
        ["1,1", "D"],
        ["2,2", "E"], // Outside selection
      ]);

      selectionManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(1, 1);
      selectionManager.mouseUp();

      const tsv = selectionManager.selectionToTsv(data);
      expect(tsv).toBe("A\tB\nC\tD");
    });

    it("should handle empty TSV export", () => {
      const data = new Map([["5,5", "Outside"]]);

      selectionManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const tsv = selectionManager.selectionToTsv(data);
      expect(tsv).toBe("");
    });

    it("should save single cell value", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);

      selectionManager.saveCellValue({ rowIndex: 1, colIndex: 2 }, "test");
      expect(updateCallback).toHaveBeenCalledWith([
        { rowIndex: 1, colIndex: 2, value: "test" },
      ]);
    });

    it("should save multiple cell values", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);

      const updates = [
        { rowIndex: 1, colIndex: 2, value: "A" },
        { rowIndex: 2, colIndex: 3, value: "B" },
      ];

      selectionManager.saveCellValues(updates);
      expect(updateCallback).toHaveBeenCalledWith(updates);
    });

    it("should iterate over selected cells", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      const cells: Array<{ absolute: { row: number; col: number }; relative: { row: number; col: number } }> = [];
      selectionManager.forEachSelectedCell((cell) => {
        cells.push(cell);
      });

      expect(cells).toHaveLength(4);
      expect(cells[0]).toEqual({
        absolute: { row: 1, col: 1 },
        relative: { row: 0, col: 0 },
      });
    });

    it("should throw error for infinite selection iteration", () => {
      const infiniteManager = new SelectionManager(
        () => ({ type: "infinity" as const }),
        () => ({ type: "infinity" as const }),
        () => [],
      );

      // Create an infinite selection by selecting a row header
      infiniteManager.headerMouseDown(0, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      infiniteManager.mouseUp();

      expect(() => {
        infiniteManager.forEachSelectedCell(() => {});
      }).toThrow("Cannot iterate over infinite selections");
    });
  });

  describe("Element Setup", () => {
    it("should setup cell element with event handlers", () => {
      const mockElement = {
        addEventListener: mock(),
        removeEventListener: mock(),
        style: { boxShadow: "" },
      } as any;

      const cleanup = selectionManager.setupCellElement(mockElement, { row: 1, col: 2 });

      expect(mockElement.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("dblclick", expect.any(Function));

      cleanup();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("dblclick", expect.any(Function));
    });

    it("should setup header element with event handlers", () => {
      const mockElement = {
        addEventListener: mock(),
        removeEventListener: mock(),
        style: { boxShadow: "" },
      } as any;

      const cleanup = selectionManager.setupHeaderElement(mockElement, 1, "row");

      expect(mockElement.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));

      cleanup();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));
    });

    it("should setup container element with comprehensive event handlers", () => {
      // Mock global objects for browser environment
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      
      globalThis.window = {
        addEventListener: mock(),
        removeEventListener: mock(),
      } as any;
      
      globalThis.document = {
        addEventListener: mock(),
        removeEventListener: mock(),
        getSelection: mock(() => ({ empty: mock() })),
      } as any;

      const mockElement = {
        addEventListener: mock(),
        removeEventListener: mock(),
        contains: mock(() => true),
        style: { boxShadow: "" },
      } as any;

      const cleanup = selectionManager.setupContainerElement(mockElement);

      // Check element event listeners
      expect(mockElement.addEventListener).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("drop", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("mouseleave", expect.any(Function));

      cleanup();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("drop", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mouseleave", expect.any(Function));

      // Restore global objects
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    });
  });

  describe("Utility Functions and Edge Cases", () => {
    it("should test sort function with various combinations", () => {
      // Create manager that will use coordinate compression
      const manager = new SelectionManager(
        () => ({ type: "infinity" as const }),
        () => ({ type: "infinity" as const }),
        () => [],
      );

      // Create multiple selections to trigger coordinate compression
      manager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      manager.cellMouseEnter(2, 2);
      manager.mouseUp();

      manager.cellMouseDown(5, 5, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        isFillHandle: false,
      });
      manager.mouseUp();

      // This should exercise the sort function with INF values
      const overlapping = manager.getNonOverlappingSelections();
      expect(overlapping.length).toBeGreaterThan(0);
    });

    it("should handle negative selection detection", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      // Start a remove selection
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        isFillHandle: false,
      });

      expect(selectionManager.inNegativeSelection({ row: 1, col: 1 })).toBe(true);
      expect(selectionManager.inNegativeSelection({ row: 2, col: 2 })).toBe(false);
    });

    it("should get top-left cell in selection", () => {
      selectionManager.cellMouseDown(2, 3, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(1, 1);
      selectionManager.mouseUp();

      const topLeft = selectionManager.getTopLeftCellInSelection();
      expect(topLeft).toEqual({ row: 1, col: 1 });
    });

    it("should return undefined for top-left cell when no selections", () => {
      const topLeft = selectionManager.getTopLeftCellInSelection();
      expect(topLeft).toBeUndefined();
    });

    it("should get selections bounding rect", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      selectionManager.cellMouseDown(3, 3, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const boundingRect = selectionManager.getSelectionsBoundingRect();
      expect(boundingRect).toEqual({
        start: { row: 1, col: 1 },
        end: { row: { type: "number", value: 3 }, col: { type: "number", value: 3 } },
      });
    });

    it("should handle selection cancellation", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);

      expect(selectionManager.isSelecting.type).not.toBe("none");

      selectionManager.cancelSelection();
      expect(selectionManager.isSelecting.type).toBe("none");
    });

    it("should normalize selections properly", () => {
      const infiniteSelection = {
        start: { row: 1, col: 1 },
        end: { row: { type: "infinity" } as const, col: { type: "infinity" } as const },
      };

      const normalized = selectionManager.normalizeSelection(infiniteSelection);
      
      expect(normalized.end.row).toEqual({ type: "number" as const, value: 9 }); // numRows - 1
      expect(normalized.end.col).toEqual({ type: "number" as const, value: 4 }); // numCols - 1
    });

    it("should handle paste and drop operations", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);
      
      selectionManager.focus();
      selectionManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      // Mock clipboard event
      const mockClipboardEvent = {
        preventDefault: mock(),
        clipboardData: {
          getData: mock(() => "A\tB\nC\tD"),
        },
      } as any;

      selectionManager.handlePaste(mockClipboardEvent);

      expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
      expect(updateCallback).toHaveBeenCalled();
    });

    it("should handle drag and drop files", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);
      
      selectionManager.focus();

      // Mock drag event with CSV file
      const mockFile = new File(["A,B\nC,D"], "test.csv", { type: "text/csv" });
      const mockDragEvent = {
        preventDefault: mock(),
        dataTransfer: {
          files: [mockFile],
        },
      } as any;

      // Mock FileReader
      const originalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        onload: ((event: any) => void) | null = null;
        readAsText() {
          setTimeout(() => {
            this.onload?.({ target: { result: "A,B\nC,D" } });
          }, 0);
        }
      } as any;

      selectionManager.handleDrop(mockDragEvent);

      // Restore original FileReader
      globalThis.FileReader = originalFileReader;

      expect(mockDragEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe("Comparison Methods", () => {
    it("should test equals method", () => {
      expect(selectionManager.equals(
        { type: "number" as const, value: 5 },
        { type: "number" as const, value: 5 }
      )).toBe(true);

      expect(selectionManager.equals(
        { type: "infinity" as const },
        { type: "infinity" as const }
      )).toBe(true);

      expect(selectionManager.equals(
        { type: "number" as const, value: 5 },
        { type: "infinity" as const }
      )).toBe(false);
    });

    it("should test lt method", () => {
      expect(selectionManager.lt(
        { type: "number" as const, value: 3 },
        { type: "number" as const, value: 5 }
      )).toBe(true);

      expect(selectionManager.lt(
        { type: "number" as const, value: 5 },
        { type: "infinity" as const }
      )).toBe(true);

      expect(selectionManager.lt(
        { type: "infinity" as const },
        { type: "number" as const, value: 5 }
      )).toBe(false);
    });

    it("should test gt method", () => {
      expect(selectionManager.gt(
        { type: "number" as const, value: 5 },
        { type: "number" as const, value: 3 }
      )).toBe(true);

      expect(selectionManager.gt(
        { type: "infinity" as const },
        { type: "number" as const, value: 5 }
      )).toBe(true);

      expect(selectionManager.gt(
        { type: "number" as const, value: 3 },
        { type: "infinity" as const }
      )).toBe(false);
    });

    it("should test lte and gte methods", () => {
      expect(selectionManager.lte(
        { type: "number" as const, value: 3 },
        { type: "number" as const, value: 3 }
      )).toBe(true);

      expect(selectionManager.gte(
        { type: "number" as const, value: 5 },
        { type: "number" as const, value: 5 }
      )).toBe(true);
    });
  });
});
