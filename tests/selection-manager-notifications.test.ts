import { describe, expect, mock, test } from "bun:test";
import { SelectionManager } from "../src/selection-manager";

const finite = (value: number) => ({ type: "number" as const, value });
const manager = () =>
  new SelectionManager(
    () => finite(10),
    () => finite(10),
    () => [],
  );
const pointer = {
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  isFillHandle: false,
};
const key = (name: string) => ({
  key: name,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  preventDefault: mock(),
});

describe("state publication counts", () => {
  test("idle operations neither publish nor clone state", () => {
    const sm = manager();
    const publish = mock();
    sm.onNextState(publish);
    const previous = sm.prevState;
    for (let i = 0; i < 100; i++) {
      sm.mouseUp();
      sm.cancelSelection();
      sm.clearSelections();
      sm.cancelHovering();
      sm.blur();
    }
    expect(publish).toHaveBeenCalledTimes(0);
    expect(sm.prevState).toBe(previous);
  });

  test("focus transitions publish once and retain primary selection", () => {
    const sm = manager();
    sm.cellMouseDown(2, 3, pointer);
    sm.mouseUp();
    const selection = structuredClone(sm.selections);
    sm.blur();
    const publish = mock();
    sm.onNextState(publish);
    sm.focus();
    const previous = sm.prevState;
    sm.focus();
    expect(sm.prevState).toBe(previous);
    expect(sm.hasFocus).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    sm.blur();
    sm.blur();
    expect(sm.hasFocus).toBe(false);
    expect(sm.selections).toEqual(selection);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  test("drag commit, cancellation, clear and hover changes still publish", () => {
    const sm = manager();
    const publish = mock();
    sm.onNextState(publish);
    sm.cellMouseDown(1, 1, pointer);
    sm.cellMouseEnter(2, 3);
    sm.mouseUp();
    expect(publish).toHaveBeenCalledTimes(3);
    expect(sm.selections).toEqual([
      { start: { row: 1, col: 1 }, end: { row: finite(2), col: finite(3) } },
    ]);
    sm.mouseUp();
    expect(publish).toHaveBeenCalledTimes(3);
    sm.cancelHovering();
    sm.cancelHovering();
    expect(publish).toHaveBeenCalledTimes(4);
    sm.clearSelections();
    sm.clearSelections();
    expect(publish).toHaveBeenCalledTimes(5);
    sm.cellMouseDown(4, 4, pointer);
    sm.cancelSelection();
    sm.cancelSelection();
    expect(sm.isSelecting.type).toBe("none");
    expect(publish).toHaveBeenCalledTimes(7);
  });

  test("arrow moves publish once; boundary moves still request viewport reveal", () => {
    const sm = manager();
    sm.cellMouseDown(0, 0, pointer);
    sm.mouseUp();
    const publish = mock();
    const reveal = mock();
    sm.onNextState(publish);
    sm.listenToViewportRequest(reveal);
    sm.handleKeyDown(key("ArrowRight"));
    sm.handleKeyDown(key("ArrowLeft"));
    const boundary = key("ArrowLeft");
    sm.handleKeyDown(boundary);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(reveal).toHaveBeenCalledTimes(3);
    expect(boundary.preventDefault).toHaveBeenCalledTimes(1);
    sm.editCell(0, 0);
    sm.handleKeyDown(key("ArrowRight"));
    expect(sm.isEditing.type).toBe("cell");
    expect(publish).toHaveBeenCalledTimes(3);
    expect(reveal).toHaveBeenCalledTimes(3);
  });

  test("controlled no-ops do not request states, but drag commit still does", () => {
    const sm = manager();
    sm.controlled = true;
    const requested = mock((state) => {
      sm.setState(state);
      sm.patches = [];
    });
    sm.onNewRequestedState(requested);
    sm.mouseUp();
    sm.clearSelections();
    sm.cancelSelection();
    sm.cancelHovering();
    expect(requested).toHaveBeenCalledTimes(0);
    sm.cellMouseDown(1, 1, pointer);
    sm.mouseUp();
    sm.mouseUp();
    expect(requested).toHaveBeenCalledTimes(2);
    expect(sm.selections).toHaveLength(1);
  });

  test("reference pointer gesture commits once, without changing primary selection", () => {
    const sm = manager();
    sm.cellMouseDown(1, 1, pointer);
    sm.mouseUp();
    const selection = structuredClone(sm.selections);
    sm.beginReferenceSelection();
    const publish = mock();
    const reference = mock();
    sm.onNextState(publish);
    sm.listenToReferenceSelection(reference);
    sm.mouseUp();
    expect(publish).toHaveBeenCalledTimes(0);
    sm.cellMouseDown(3, 3, pointer);
    sm.cellMouseEnter(4, 4);
    sm.mouseUp();
    sm.mouseUp();
    expect(publish).toHaveBeenCalledTimes(3);
    expect(reference.mock.calls.map(([event]) => event.phase)).toEqual([
      "start",
      "change",
      "commit",
    ]);
    expect(sm.referenceSelection.type).toBe("selected");
    expect(sm.selections).toEqual(selection);
  });
});
