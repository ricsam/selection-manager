import { SelectionManager } from "../src/selection-manager";
import { expect, describe, it, beforeEach, mock } from "bun:test";

describe("SelectionManager Extended Tests", () => {
  let selectionManager: SelectionManager;

  beforeEach(() => {
    selectionManager = new SelectionManager(
      () => ({ type: "number" as const, value: 10 }), // getNumRows
      () => ({ type: "number" as const, value: 5 }), // getNumCols
      () => [], // getGroups
    );
  });

  describe("Drag Area Detection", () => {
    it("should detect cells in drag area during selection", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(3, 3);

      expect(selectionManager.isCellInDragArea({ row: 1, col: 1 })).toBe(true);
      expect(selectionManager.isCellInDragArea({ row: 2, col: 2 })).toBe(true);
      expect(selectionManager.isCellInDragArea({ row: 3, col: 3 })).toBe(true);
      expect(selectionManager.isCellInDragArea({ row: 0, col: 0 })).toBe(false);
      expect(selectionManager.isCellInDragArea({ row: 4, col: 4 })).toBe(false);
    });

    it("should not detect cells in drag area for remove selection", () => {
      // First select some cells
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      // Start a remove selection
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        isFillHandle: false,
      });

      expect(selectionManager.isCellInDragArea({ row: 1, col: 1 })).toBe(false);
    });

    it("should handle infinite selections in drag area", () => {
      const infiniteManager = new SelectionManager(
        () => ({ type: "infinity" as const }),
        () => ({ type: "infinity" as const }),
        () => [],
      );

      infiniteManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      infiniteManager.cellMouseEnter(3, 3);

      expect(infiniteManager.isCellInDragArea({ row: 2, col: 2 })).toBe(true);
      expect(infiniteManager.isCellInDragArea({ row: 100, col: 100 })).toBe(false);
    });
  });

  describe("Fill Handle Functionality", () => {
    it("should detect fill handle on bottom-right cell", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      expect(selectionManager.canCellHaveFillHandle({ row: 2, col: 2 })).toBe(true);
      expect(selectionManager.canCellHaveFillHandle({ row: 1, col: 1 })).toBe(false);
      expect(selectionManager.canCellHaveFillHandle({ row: 3, col: 3 })).toBe(false);
    });

    it("should not show fill handle for non-rectangular selections", () => {
      // Create multiple separate selections
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

      expect(selectionManager.canCellHaveFillHandle({ row: 1, col: 1 })).toBe(false);
      expect(selectionManager.canCellHaveFillHandle({ row: 3, col: 3 })).toBe(false);
    });

    it("should handle fill selection and trigger callbacks", () => {
      // First create a base selection
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      const fillCallback = mock();
      selectionManager.listenToFill(fillCallback);

      // Now do a fill operation
      selectionManager.cellMouseDown(2, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: true,
      });
      selectionManager.cellMouseEnter(2, 4);
      selectionManager.mouseUp();

      expect(fillCallback).toHaveBeenCalled();
    });

    it("should handle fill direction logic", () => {
      // Test horizontal fill
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      // Start fill handle and move more horizontally
      selectionManager.cellMouseDown(2, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: true,
      });
      
      const endCoords = selectionManager.getFillHandleSelection(
        { row: 2, col: 2 },
        { row: 2, col: 5 } // More horizontal movement
      );

      expect(endCoords).toBeDefined();
      expect(endCoords?.type).not.toBe("none");
      if (endCoords && endCoords.type !== "none") {
        expect(endCoords.end.col.type).toBe("number");
        if (endCoords.end.col.type === "number") {
          expect(endCoords.end.col.value).toBe(5);
        }
      }
    });
  });

  describe("Group Functionality", () => {
    it("should find groups containing cells", () => {
      const group = {
        start: { row: 1, col: 1 },
        end: { row: { type: "number" as const, value: 3 }, col: { type: "number" as const, value: 3 } },
      };

      const groupManager = new SelectionManager(
        () => ({ type: "number" as const, value: 10 }),
        () => ({ type: "number" as const, value: 10 }),
        () => [group],
      );

      expect(groupManager.findGroupContainingCell({ row: 2, col: 2 })).toEqual(group);
      expect(groupManager.findGroupContainingCell({ row: 5, col: 5 })).toBeUndefined();
    });

    it("should detect hovering over groups", () => {
      const group = {
        start: { row: 1, col: 1 },
        end: { row: { type: "number" as const, value: 3 }, col: { type: "number" as const, value: 3 } },
      };

      const groupManager = new SelectionManager(
        () => ({ type: "number" as const, value: 10 }),
        () => ({ type: "number" as const, value: 10 }),
        () => [group],
      );

      groupManager.cellMouseEnter(2, 2);
      expect(groupManager.isHoveringGroup(group)).toBe(true);
    });
  });

  describe("State Management", () => {
    it("should handle controlled state", () => {
      selectionManager.controlled = true;
      const requestCallback = mock();
      selectionManager.onNewRequestedState(requestCallback);

      // Make a change
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });

      expect(requestCallback).toHaveBeenCalled();
    });

    it("should observe state changes with cleanup", () => {
      const observer = mock();
      const cleanup = selectionManager.observeStateChange(
        (state) => state.selections.length,
        observer,
        true,
      );

      expect(observer).toHaveBeenCalledWith(0);

      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      expect(observer).toHaveBeenCalledWith(1);

      cleanup();
    });

    it("should handle setState with function", () => {
      const initialState = selectionManager.getState();
      
      selectionManager.setState((state) => ({
        hasFocus: !state.hasFocus,
      }));

      expect(selectionManager.hasFocus).toBe(!initialState.hasFocus);
    });
  });

  describe("Editing", () => {
    it("should enter edit mode on double click", () => {
      selectionManager.cellDoubleClick(2, 3);

      expect(selectionManager.isEditingCell(2, 3)).toBe(true);
      expect(selectionManager.isEditing.type).toBe("cell");
    });

    it("should cancel editing", () => {
      selectionManager.cellDoubleClick(2, 3);
      expect(selectionManager.isEditingCell(2, 3)).toBe(true);

      selectionManager.cancelEditing();
      expect(selectionManager.isEditing.type).toBe("none");
    });

    it("should handle F2 key for editing", () => {
      selectionManager.cellMouseDown(2, 3, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      selectionManager.handleKeyDown({
        key: "F2",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: () => {},
      });

      expect(selectionManager.isEditingCell(2, 3)).toBe(true);
    });

    it("should not handle other keys when editing", () => {
      selectionManager.cellDoubleClick(2, 3);
      
      const preventDefault = mock();
      selectionManager.handleKeyDown({
        key: "c",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        preventDefault,
      });

      // Should not prevent default since we're editing
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("Copy, Cut and Delete", () => {
    it("should trigger copy listeners", () => {
      const copyCallback = mock();
      selectionManager.listenToCopy(copyCallback);

      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const preventDefault = mock();
      selectionManager.handleKeyDown({
        key: "c",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        preventDefault,
      });

      expect(copyCallback).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("should handle cut operation", () => {
      const copyCallback = mock();
      const updateCallback = mock();
      selectionManager.listenToCopy(copyCallback);
      selectionManager.listenToUpdateData(updateCallback);

      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const preventDefault = mock();
      selectionManager.handleKeyDown({
        key: "x",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        preventDefault,
      });

      expect(copyCallback).toHaveBeenCalled();
      expect(updateCallback).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("should clear cells on delete", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);

      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const preventDefault = mock();
      selectionManager.handleKeyDown({
        key: "Delete",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault,
      });

      expect(updateCallback).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });

    it("should clear cells on backspace", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);

      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const preventDefault = mock();
      selectionManager.handleKeyDown({
        key: "Backspace",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault,
      });

      expect(updateCallback).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });
  });
});
