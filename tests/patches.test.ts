import { describe, test, expect } from "bun:test";
import { createPatches, applyPatches, buildPatch, createPatch } from "../src/patches";
import type { SelectionManagerState, SMArea, IsSelecting, IsEditing, IsHovering } from "../src/types";

describe("patches", () => {
  const createInitialState = (): SelectionManagerState => ({
    hasFocus: false,
    selections: [],
    isSelecting: { type: "none" },
    isEditing: { type: "none" },
    isHovering: { type: "none" },
  });

  describe("createPatches", () => {
    test("should create no patches when states are identical", () => {
      const state = createInitialState();
      const patches = createPatches(state, state);
      expect(patches).toEqual([]);
    });

    test("should create hasFocus patch", () => {
      const prevState = createInitialState();
      const nextState = { ...prevState, hasFocus: true };
      const patches = createPatches(prevState, nextState);
      
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({ op: "replace", path: "hasFocus", value: true });
    });

    test("should create selections add patch", () => {
      const prevState = createInitialState();
      const selection: SMArea = {
        start: { row: 0, col: 0 },
        end: { row: { type: "number", value: 5 }, col: { type: "number", value: 3 } },
      };
      const nextState = { ...prevState, selections: [selection] };
      const patches = createPatches(prevState, nextState);
      
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({ op: "add", path: "selections/-", value: selection });
    });

    test("should create isSelecting patch", () => {
      const prevState = createInitialState();
      const selecting: IsSelecting = {
        type: "drag",
        start: { row: 1, col: 1 },
        end: { row: { type: "number", value: 3 }, col: { type: "number", value: 3 } },
      };
      const nextState = { ...prevState, isSelecting: selecting };
      const patches = createPatches(prevState, nextState);
      
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({ op: "replace", path: "isSelecting", value: selecting });
    });

    test("should create isEditing patch", () => {
      const prevState = createInitialState();
      const editing: IsEditing = { type: "cell", row: 2, col: 3, initialValue: "test" };
      const nextState = { ...prevState, isEditing: editing };
      const patches = createPatches(prevState, nextState);
      
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({ op: "replace", path: "isEditing", value: editing });
    });

    test("should create isHovering patch", () => {
      const prevState = createInitialState();
      const hovering: IsHovering = { type: "cell", row: 4, col: 5 };
      const nextState = { ...prevState, isHovering: hovering };
      const patches = createPatches(prevState, nextState);
      
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({ op: "replace", path: "isHovering", value: hovering });
    });

    test("should create multiple patches for multiple changes", () => {
      const prevState = createInitialState();
      const nextState: SelectionManagerState = {
        hasFocus: true,
        selections: [{
          start: { row: 0, col: 0 },
          end: { row: { type: "number", value: 2 }, col: { type: "number", value: 2 } },
        }],
        isSelecting: { type: "shift", start: { row: 1, col: 1 }, end: { row: { type: "number", value: 3 }, col: { type: "number", value: 3 } } },
        isEditing: { type: "cell", row: 0, col: 0 },
        isHovering: { type: "header", index: 5, headerType: "row" },
      };
      const patches = createPatches(prevState, nextState);
      
      expect(patches).toHaveLength(5);
      expect(patches.map(p => p.path).sort()).toEqual([
        "hasFocus", "isEditing", "isHovering", "isSelecting", "selections/-"
      ]);
    });
  });

  describe("applyPatches", () => {
    test("should apply hasFocus patch", () => {
      const state = createInitialState();
      const patches = [createPatch.setHasFocus(true)];
      const newState = applyPatches(state, patches);
      
      expect(newState.hasFocus).toBe(true);
      expect(newState).not.toBe(state); // Should be a new object
    });

    test("should apply add selection patch", () => {
      const state = createInitialState();
      const selection: SMArea = {
        start: { row: 0, col: 0 },
        end: { row: { type: "number", value: 5 }, col: { type: "number", value: 3 } },
      };
      const patches = [createPatch.addSelection(selection)];
      const newState = applyPatches(state, patches);
      
      expect(newState.selections).toEqual([selection]);
    });

    test("should apply multiple patches", () => {
      const state = createInitialState();
      const patches = [
        createPatch.setHasFocus(true),
        createPatch.setIsEditing({ type: "cell", row: 1, col: 2 }),
      ];
      const newState = applyPatches(state, patches);
      
      expect(newState.hasFocus).toBe(true);
      expect(newState.isEditing).toEqual({ type: "cell", row: 1, col: 2 });
    });

    test("should apply remove selection patch", () => {
      const selection1: SMArea = {
        start: { row: 0, col: 0 },
        end: { row: { type: "number", value: 2 }, col: { type: "number", value: 2 } },
      };
      const selection2: SMArea = {
        start: { row: 5, col: 5 },
        end: { row: { type: "number", value: 7 }, col: { type: "number", value: 7 } },
      };
      const state = { ...createInitialState(), selections: [selection1, selection2] };
      const patches = [createPatch.removeSelection(0)];
      const newState = applyPatches(state, patches);
      
      expect(newState.selections).toEqual([selection2]);
    });

    test("should handle empty patches array", () => {
      const state = createInitialState();
      const newState = applyPatches(state, []);
      
      // Should return a new object with same values
      expect(newState).toEqual(state);
      expect(newState).not.toBe(state);
    });
  });

  describe("buildPatch", () => {
    test("should return single patch when only one change", () => {
      const prevState = createInitialState();
      const nextState = { ...prevState, hasFocus: true };
      const patch = buildPatch(prevState, nextState);
      
      expect(patch).toEqual({ op: "replace", path: "hasFocus", value: true });
    });

    test("should return first patch when multiple changes", () => {
      const prevState = createInitialState();
      const nextState: SelectionManagerState = {
        ...prevState,
        hasFocus: true,
        isEditing: { type: "cell", row: 1, col: 1 },
      };
      const patch = buildPatch(prevState, nextState);
      
      expect(patch.op).toBe("replace");
      expect(patch.path).toBe("hasFocus");
      if (patch.op === "replace" || patch.op === "test") {
        expect(patch.value).toBe(true);
      }
    });

    test("should return test patch when no changes", () => {
      const state = createInitialState();
      const patch = buildPatch(state, state);
      
      // Should return a no-op test patch
      expect(patch).toEqual({ op: "test", path: "hasFocus", value: false });
    });
  });

  describe("createPatch helpers", () => {
    test("should create typed patches using helper functions", () => {
      expect(createPatch.setHasFocus(true)).toEqual({
        op: "replace",
        path: "hasFocus", 
        value: true,
      });

      const selection: SMArea = {
        start: { row: 0, col: 0 },
        end: { row: { type: "number", value: 5 }, col: { type: "number", value: 3 } },
      };
      
      expect(createPatch.addSelection(selection)).toEqual({
        op: "add",
        path: "selections/-",
        value: selection,
      });

      expect(createPatch.addSelection(selection, 2)).toEqual({
        op: "add", 
        path: "selections/2",
        value: selection,
      });

      expect(createPatch.removeSelection(1)).toEqual({
        op: "remove",
        path: "selections/1",
      });

      expect(createPatch.clearSelections()).toEqual({
        op: "replace",
        path: "selections",
        value: [],
      });
    });
  });

  describe("granular selection operations", () => {
    test("should detect selection removal correctly", () => {
      const selection1: SMArea = {
        start: { row: 0, col: 0 },
        end: { row: { type: "number", value: 2 }, col: { type: "number", value: 2 } },
      };
      const selection2: SMArea = {
        start: { row: 5, col: 5 },
        end: { row: { type: "number", value: 7 }, col: { type: "number", value: 7 } },
      };
      const selection3: SMArea = {
        start: { row: 10, col: 10 },
        end: { row: { type: "number", value: 12 }, col: { type: "number", value: 12 } },
      };
      
      const prevState = { ...createInitialState(), selections: [selection1, selection2, selection3] };
      const nextState = { ...prevState, selections: [selection1, selection3] }; // Remove middle selection
      
      const patches = createPatches(prevState, nextState);
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        op: "remove",
        path: "selections/1",
      });
    });

    test("should detect selection clearing", () => {
      const selection: SMArea = {
        start: { row: 0, col: 0 },
        end: { row: { type: "number", value: 5 }, col: { type: "number", value: 3 } },
      };
      const prevState = { ...createInitialState(), selections: [selection] };
      const nextState = { ...prevState, selections: [] };
      
      const patches = createPatches(prevState, nextState);
      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        op: "replace",
        path: "selections",
        value: [],
      });
    });
  });

  describe("round-trip test", () => {
    test("should correctly round-trip state changes", () => {
      const initialState = createInitialState();
      const modifiedState: SelectionManagerState = {
        hasFocus: true,
        selections: [
          {
            start: { row: 0, col: 0 },
            end: { row: { type: "number", value: 10 }, col: { type: "number", value: 5 } },
          },
          {
            start: { row: 20, col: 3 },
            end: { row: { type: "infinity" }, col: { type: "number", value: 8 } },
          },
        ],
        isSelecting: {
          type: "fill",
          direction: "down",
          eventType: "extend",
          start: { row: 0, col: 0 },
          end: { row: { type: "number", value: 5 }, col: { type: "number", value: 0 } },
        },
        isEditing: { type: "cell", row: 3, col: 4, initialValue: "original" },
        isHovering: { type: "header", index: 2, headerType: "col" },
      };

      // Create patches
      const patches = createPatches(initialState, modifiedState);
      
      // Apply patches to get new state
      const resultState = applyPatches(initialState, patches);
      
      // Should match the modified state
      expect(resultState).toEqual(modifiedState);
    });
  });
});
