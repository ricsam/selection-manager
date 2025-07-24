import { SelectionManager } from "../src/selection-manager";
import { expect, describe, it, beforeEach, mock } from "bun:test";

describe("SelectionManager", () => {
  let selectionManager: SelectionManager;
  let updateCallback: ReturnType<typeof mock>;

  beforeEach(() => {
    updateCallback = mock();
    selectionManager = new SelectionManager(
      () => 10, // getNumRows
      () => 5, // getNumCols
      () => [], // getGroups
    );
    selectionManager.onNextState(updateCallback);
  });

  describe("Basic Selection", () => {
    it("should start with no selections", () => {
      expect(selectionManager.selections).toEqual([]);
      expect(selectionManager.hasSelection()).toBe(false);
    });

    it("should select a single cell", () => {
      selectionManager.cellMouseDown(2, 3, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 2, col: 3 },
        end: { row: 2, col: 3 },
      });
      expect(selectionManager.isSelected({ row: 2, col: 3 })).toBe(true);
      expect(selectionManager.hasSelection()).toBe(true);
    });

    it("should select a range by dragging", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(3, 4);
      selectionManager.mouseUp();

      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 1, col: 1 },
        end: { row: 3, col: 4 },
      });

      // Check that cells in the range are selected
      expect(selectionManager.isSelected({ row: 1, col: 1 })).toBe(true);
      expect(selectionManager.isSelected({ row: 2, col: 3 })).toBe(true);
      expect(selectionManager.isSelected({ row: 3, col: 4 })).toBe(true);
      // Check that cells outside the range are not selected
      expect(selectionManager.isSelected({ row: 0, col: 0 })).toBe(false);
      expect(selectionManager.isSelected({ row: 4, col: 5 })).toBe(false);
    });
  });

  describe("Multi-Selection", () => {
    it("should add selections with Ctrl+click", () => {
      // First selection
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      // Second selection with Ctrl
      selectionManager.cellMouseDown(3, 3, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.selections).toHaveLength(2);
      expect(selectionManager.isSelected({ row: 1, col: 1 })).toBe(true);
      expect(selectionManager.isSelected({ row: 3, col: 3 })).toBe(true);
      expect(selectionManager.isSelected({ row: 2, col: 2 })).toBe(false);
    });

    it("should remove selections with Ctrl+click on selected cell", () => {
      // Create initial selection
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      expect(selectionManager.isSelected({ row: 1, col: 1 })).toBe(true);
      expect(selectionManager.isSelected({ row: 2, col: 2 })).toBe(true);

      // Remove part of the selection with Ctrl+click
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.isSelected({ row: 1, col: 1 })).toBe(false);
      expect(selectionManager.isSelected({ row: 2, col: 2 })).toBe(true);
    });

    it("should extend selection with Shift+click", () => {
      // First selection
      selectionManager.cellMouseDown(2, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      // Extend with Shift+click
      selectionManager.cellMouseDown(4, 4, {
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 2, col: 2 },
        end: { row: 4, col: 4 },
      });
      expect(selectionManager.isSelected({ row: 3, col: 3 })).toBe(true);
    });
  });

  describe("Header Selection", () => {
    it("should select entire row when clicking row header", () => {
      selectionManager.headerMouseDown(2, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 2, col: 0 },
        end: { row: 2, col: 4 }, // numCols - 1
      });
      expect(selectionManager.isWholeRowSelected(2)).toBe(true);
      expect(selectionManager.isSelected({ row: 2, col: 0 })).toBe(true);
      expect(selectionManager.isSelected({ row: 2, col: 4 })).toBe(true);
      expect(selectionManager.isSelected({ row: 1, col: 0 })).toBe(false);
    });

    it("should select entire column when clicking column header", () => {
      selectionManager.headerMouseDown(3, "col", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 0, col: 3 },
        end: { row: 9, col: 3 }, // numRows - 1
      });
      expect(selectionManager.isWholeColSelected(3)).toBe(true);
      expect(selectionManager.isSelected({ row: 0, col: 3 })).toBe(true);
      expect(selectionManager.isSelected({ row: 9, col: 3 })).toBe(true);
      expect(selectionManager.isSelected({ row: 0, col: 2 })).toBe(false);
    });

    it("should select multiple rows with Ctrl+click on headers", () => {
      // Select first row
      selectionManager.headerMouseDown(1, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      // Add another row with Ctrl
      selectionManager.headerMouseDown(3, "row", {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.selections).toHaveLength(2);
      expect(selectionManager.isWholeRowSelected(1)).toBe(true);
      expect(selectionManager.isWholeRowSelected(3)).toBe(true);
      expect(selectionManager.isWholeRowSelected(2)).toBe(false);
    });

    it("should remove row selection with Ctrl+click on selected row header", () => {
      // Select row
      selectionManager.headerMouseDown(2, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.isWholeRowSelected(2)).toBe(true);

      // Remove with Ctrl+click
      selectionManager.headerMouseDown(2, "row", {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      });
      selectionManager.mouseUp();

      expect(selectionManager.isWholeRowSelected(2)).toBe(false);
      expect(selectionManager.hasSelection()).toBe(false);
    });
  });

  describe("Keyboard Navigation", () => {
    it("should handle arrow key navigation", () => {
      // Start with a selection
      selectionManager.cellMouseDown(2, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      // Move right
      selectionManager.handleKeyDown({
        key: "ArrowRight",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 2, col: 3 },
        end: { row: 2, col: 3 },
      });
    });

    it("should extend selection with Shift+arrow keys", () => {
      // Start with a selection
      selectionManager.cellMouseDown(2, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
        selectionManager.mouseUp();

      // Extend selection right
      selectionManager.handleKeyDown({
        key: "ArrowRight",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 2, col: 2 },
        end: { row: 2, col: 3 },
      });
    });

    it("should select all with Ctrl+A", () => {
      const preventDefault = mock();
      selectionManager.handleKeyDown({
        key: "a",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(selectionManager.selections).toHaveLength(1);
      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 0, col: 0 },
        end: { row: 9, col: 4 }, // numRows-1, numCols-1
      });
    });

    it("should clear selection with Escape", () => {
      // Create a selection
      selectionManager.cellMouseDown(2, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();
      selectionManager.focus();

      expect(selectionManager.hasSelection()).toBe(true);
      expect(selectionManager.hasFocus).toBe(true);

      // Clear with Escape
      selectionManager.handleKeyDown({
        key: "Escape",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(selectionManager.hasSelection()).toBe(false);
      expect(selectionManager.hasFocus).toBe(false);
    });

    it("should extend selection to edge with Ctrl+Shift+arrow", () => {
      // Start with a selection
      selectionManager.cellMouseDown(2, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      // Extend to top edge
      selectionManager.handleKeyDown({
        key: "ArrowUp",
        shiftKey: true,
        ctrlKey: true,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 2, col: 2 },
        end: { row: 0, col: 2 },
      });
    });
  });

  describe("Focus Management", () => {
    it("should handle focus and blur", () => {
      expect(selectionManager.hasFocus).toBe(false);

      selectionManager.focus();
      expect(selectionManager.hasFocus).toBe(true);
      expect(updateCallback).toHaveBeenCalled();

      selectionManager.blur();
      expect(selectionManager.hasFocus).toBe(false);
    });
  });

  describe("Selection Queries", () => {
    beforeEach(() => {
      // Create a test selection
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(3, 3);
      selectionManager.mouseUp();
    });

    it("should correctly identify selected cells", () => {
      expect(selectionManager.isSelected({ row: 1, col: 1 })).toBe(true);
      expect(selectionManager.isSelected({ row: 2, col: 2 })).toBe(true);
      expect(selectionManager.isSelected({ row: 3, col: 3 })).toBe(true);
      expect(selectionManager.isSelected({ row: 0, col: 0 })).toBe(false);
      expect(selectionManager.isSelected({ row: 4, col: 4 })).toBe(false);
    });

    it("should provide selection borders", () => {
      const borders = selectionManager.selectionBorders({ row: 1, col: 1 });
      expect(borders).toContain("top");
      expect(borders).toContain("left");

      const centerBorders = selectionManager.selectionBorders({
        row: 2,
        col: 2,
      });
      expect(centerBorders).toEqual([]);

      const bottomRightBorders = selectionManager.selectionBorders({
        row: 3,
        col: 3,
      });
      expect(bottomRightBorders).toContain("bottom");
      expect(bottomRightBorders).toContain("right");
    });

    it("should provide box shadow styling", () => {
      const boxShadow = selectionManager.getCellBoxShadow({ row: 1, col: 1 });
      expect(boxShadow).toContain("#2196F3");
      expect(boxShadow).toContain("inset");

      const noBoxShadow = selectionManager.getCellBoxShadow({ row: 0, col: 0 });
      expect(noBoxShadow).toBeUndefined();
    });
  });

  describe("Data Export", () => {
    it("should export selection as TSV", () => {
      // Select a 2x2 area
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      // Create test data
      const dataMap = new Map<string, unknown>();
      dataMap.set("1,1", "A1");
      dataMap.set("1,2", "B1");
      dataMap.set("2,1", "A2");
      dataMap.set("2,2", "B2");
      dataMap.set("0,0", "Outside"); // Should not be included

      const tsv = selectionManager.selectionToTsv(dataMap);
      expect(tsv).toBe("A1\tB1\nA2\tB2");
    });

    it("should handle empty selections in export", () => {
      const dataMap = new Map<string, unknown>();
      dataMap.set("1,1", "Test");

      const tsv = selectionManager.selectionToTsv(dataMap);
      expect(tsv).toBe("");
    });
  });

  describe("Infinite Grid Support", () => {
    let infiniteSelectionManager: SelectionManager;

    beforeEach(() => {
      infiniteSelectionManager = new SelectionManager(
        () => Infinity, // getNumRows
        () => Infinity, // getNumCols
        () => [], // getGroups
      );
    });

    it("should handle infinite dimensions in row selection", () => {
      infiniteSelectionManager.headerMouseDown(2, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      infiniteSelectionManager.mouseUp();

      expect(infiniteSelectionManager.selections[0]).toMatchObject({
        start: { row: 2, col: 0 },
        end: { row: 2, col: Infinity },
      });
      expect(infiniteSelectionManager.isWholeRowSelected(2)).toBe(true);
    });

    it("should handle infinite dimensions in column selection", () => {
      infiniteSelectionManager.headerMouseDown(3, "col", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      infiniteSelectionManager.mouseUp();

      expect(infiniteSelectionManager.selections[0]).toMatchObject({
        start: { row: 0, col: 3 },
        end: { row: Infinity, col: 3 },
      });
      expect(infiniteSelectionManager.isWholeColSelected(3)).toBe(true);
    });

    it("should handle Ctrl+A with infinite grid", () => {
      infiniteSelectionManager.handleKeyDown({
        key: "a",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(infiniteSelectionManager.selections[0]).toMatchObject({
        start: { row: 0, col: 0 },
        end: { row: Infinity, col: Infinity },
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle selection outside grid bounds", () => {
      expect(selectionManager.isSelected({ row: -1, col: 0 })).toBe(false);
      expect(selectionManager.isSelected({ row: 0, col: -1 })).toBe(false);
      expect(selectionManager.isSelected({ row: 10, col: 0 })).toBe(false);
      expect(selectionManager.isSelected({ row: 0, col: 5 })).toBe(false);
    });

    it("should handle arrow navigation at boundaries", () => {
      // Start at top-left
      selectionManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      // Try to move up (should stay at 0)
      selectionManager.handleKeyDown({
        key: "ArrowUp",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
      });

      // Try to move left (should stay at 0)
      selectionManager.handleKeyDown({
        key: "ArrowLeft",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(selectionManager.selections[0]).toMatchObject({
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
      });
    });

    it("should cancel selection properly", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(2, 2);

      expect(selectionManager.isSelecting.type).not.toBe("none");

      selectionManager.cancelSelection();

      expect(selectionManager.isSelecting.type).toBe("none");
    });
  });

  describe("Union of Selections for Whole Row/Column", () => {
    it("should detect whole row selected from union of multiple selections", () => {
      // Select left part of row 2 (cols 0-2)
      selectionManager.cellMouseDown(2, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      // Add right part of row 2 (cols 3-4) with Ctrl
      selectionManager.cellMouseDown(2, 3, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(2, 4);
      selectionManager.mouseUp();

      expect(selectionManager.isWholeRowSelected(2)).toBe(true);
    });

    it("should detect whole column selected from union of multiple selections", () => {
      // Select top part of column 3 (rows 0-4)
      selectionManager.cellMouseDown(0, 3, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(4, 3);
      selectionManager.mouseUp();

      // Add bottom part of column 3 (rows 5-9) with Ctrl
      selectionManager.cellMouseDown(5, 3, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(9, 3);
      selectionManager.mouseUp();

      expect(selectionManager.isWholeColSelected(3)).toBe(true);
    });

    it("should not detect whole row if union has gaps", () => {
      // Select left part of row 2 (cols 0-1)
      selectionManager.cellMouseDown(2, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(2, 1);
      selectionManager.mouseUp();

      // Add right part of row 2 (cols 3-4) with Ctrl - leaving gap at col 2
      selectionManager.cellMouseDown(2, 3, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
      });
      selectionManager.cellMouseEnter(2, 4);
      selectionManager.mouseUp();

      expect(selectionManager.isWholeRowSelected(2)).toBe(false);
    });
  });
});
