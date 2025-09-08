import { describe, test, expect } from "bun:test";

// Test that all exports are available from the main lib entry point
import {
  // Core class
  SelectionManager,
  
  // Patch system
  createPatches,
  applyPatches,
  buildPatch,
  createPatch,
  
  // React hooks
  useInitializeSelectionManager,
  useSelectionManager,
  
  // Utils
  parseCSVContent,
} from "../src/lib";

import type {
  // Types
  SelectionManagerState,
  SMArea,
  StatePatch,
  IsSelecting,
  IsEditing,
  IsHovering,
  FillDirection,
  FillEvent,
  RealNumber,
  InfinityNumber,
  MaybeInfNumber,
} from "../src/lib";

describe("lib exports", () => {
  test("should export all types", () => {
    // Just check that the types are available - TypeScript will catch if they're missing
    expect(typeof SelectionManager).toBe("function");
    expect(typeof createPatches).toBe("function");
    expect(typeof applyPatches).toBe("function");
    expect(typeof buildPatch).toBe("function");
    expect(typeof createPatch).toBe("object");
    expect(typeof useInitializeSelectionManager).toBe("function");
    expect(typeof useSelectionManager).toBe("function");
    expect(typeof parseCSVContent).toBe("function");
  });

  test("should be able to create and use SelectionManager", () => {
    const sm = new SelectionManager(
      () => ({ type: "number", value: 10 }), // getNumRows
      () => ({ type: "number", value: 10 }), // getNumCols
      () => [] // getGroups
    );
    expect(sm.hasFocus).toBe(false);
    expect(sm.selections).toEqual([]);
    expect(sm.isSelecting.type).toBe("none");
    expect(sm.isEditing.type).toBe("none");
    expect(sm.isHovering.type).toBe("none");
  });

  test("should be able to use patch system", () => {
    const initialState: SelectionManagerState = {
      hasFocus: false,
      selections: [],
      isSelecting: { type: "none" },
      isEditing: { type: "none" },
      isHovering: { type: "none" },
    };

    const modifiedState: SelectionManagerState = {
      ...initialState,
      hasFocus: true,
    };

    const patches = createPatches(initialState, modifiedState);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({
      op: "replace",
      path: "hasFocus",
      value: true,
    });

    const result = applyPatches(initialState, patches);
    expect(result.hasFocus).toBe(true);
  });

  test("should be able to use createPatch helpers", () => {
    const patch = createPatch.setHasFocus(true);
    expect(patch).toEqual({
      op: "replace",
      path: "hasFocus",
      value: true,
    });

    const selection: SMArea = {
      start: { row: 0, col: 0 },
      end: { row: { type: "number", value: 5 }, col: { type: "number", value: 3 } },
    };

    const addPatch = createPatch.addSelection(selection);
    expect(addPatch).toEqual({
      op: "add",
      path: "selections/-",
      value: selection,
    });
  });
});
