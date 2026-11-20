import { describe, expect, mock, test } from "bun:test";
import { act, createElement, memo, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { Window } from "happy-dom";
import { SelectionManager } from "../src/selection-manager";
import { useInitializeSelectionManager } from "../src/use-initialize-selection-manager";
import { useSelectionManager } from "../src/use-selection-manager";
import type {
  FillEvent,
  NavigationKind,
  NavigationRequest,
  PasteEvent,
  SelectionManagerOptions,
  SelectionManagerState,
  SMArea,
  SMCell,
  SMDirection,
  ViewportRequest,
} from "../src/types";

const finite = (value: number) => ({ type: "number" as const, value });

const area = (
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): SMArea => ({
  start: { row: startRow, col: startCol },
  end: { row: finite(endRow), col: finite(endCol) },
});

const manager = (
  options: {
    rows?: number | "infinity";
    cols?: number | "infinity";
    hiddenRows?: Iterable<number>;
    navigation?: SelectionManagerOptions["navigation"];
  } = {},
) =>
  new SelectionManager(
    () =>
      options.rows === "infinity"
        ? { type: "infinity" }
        : finite(options.rows ?? 20),
    () =>
      options.cols === "infinity"
        ? { type: "infinity" }
        : finite(options.cols ?? 5),
    () => [],
    { hiddenRows: options.hiddenRows, navigation: options.navigation },
  );

const pointer = {
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  isFillHandle: false,
};
const headerKeys = { shiftKey: false, ctrlKey: false, metaKey: false };

/** Click (and optionally drag) a range of cells. */
const select = (
  sm: SelectionManager,
  startRow: number,
  startCol: number,
  endRow = startRow,
  endCol = startCol,
) => {
  sm.cellMouseDown(startRow, startCol, pointer);
  if (endRow !== startRow || endCol !== startCol) {
    sm.cellMouseEnter(endRow, endCol);
  }
  sm.mouseUp();
};

const press = (
  sm: SelectionManager,
  key: string,
  modifiers: Partial<{
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  }> = {},
) => {
  const event = {
    key,
    shiftKey: modifiers.shiftKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    preventDefault: mock(),
  };
  sm.handleKeyDown(event);
  return event;
};

const mockElement = () =>
  ({
    addEventListener: mock(),
    removeEventListener: mock(),
    style: { boxShadow: "" },
  }) as unknown as HTMLElement;

const BLUE_TOP = "inset 0 2px 0 0 #2196F3";
const BLUE_BOTTOM = "inset 0 -2px 0 0 #2196F3";
const GRAY_TOP = "inset 0 2px 0 0 #c5b4b3";
const GRAY_BOTTOM = "inset 0 -2px 0 0 #c5b4b3";

describe("hidden rows API", () => {
  test("the constructor option copies any iterable of rows", () => {
    const rows = [3, 1, 3];
    const sm = manager({ hiddenRows: rows });
    rows.push(7);

    expect([...sm.getHiddenRows()].sort((a, b) => a - b)).toEqual([1, 3]);
    expect(sm.isRowHidden(1)).toBe(true);
    expect(sm.isRowHidden(2)).toBe(false);
    expect(sm.isRowHidden(7)).toBe(false);

    function* generated() {
      yield 4;
      yield 5;
    }
    expect([...manager({ hiddenRows: generated() }).getHiddenRows()]).toEqual([
      4, 5,
    ]);

    // A formats array is still accepted as the fourth argument.
    const legacy = new SelectionManager(
      () => finite(5),
      () => finite(5),
      () => [],
      ["tsv"],
    );
    expect(legacy.getHiddenRows().size).toBe(0);
  });

  test("setHiddenRows replaces the set and ignores values that are not rows", () => {
    const sm = manager({ hiddenRows: [1, 2] });

    sm.setHiddenRows(new Set([5, 6]));
    expect([...sm.getHiddenRows()]).toEqual([5, 6]);
    expect(sm.isRowHidden(1)).toBe(false);

    sm.setHiddenRows([-1, 2.5, Number.NaN, Infinity, 7]);
    expect([...sm.getHiddenRows()]).toEqual([7]);

    sm.setHiddenRows([]);
    expect(sm.getHiddenRows().size).toBe(0);
  });

  test("findVisibleRow starts at the row itself and stays within the grid", () => {
    const sm = manager({ rows: 10, hiddenRows: [0, 1, 4, 5, 9] });

    expect(sm.findVisibleRow(3, "down")).toBe(3);
    expect(sm.findVisibleRow(3, "up")).toBe(3);
    expect(sm.findVisibleRow(4, "down")).toBe(6);
    expect(sm.findVisibleRow(5, "up")).toBe(3);
    expect(sm.findVisibleRow(0, "down")).toBe(2);
    expect(sm.findVisibleRow(1, "up")).toBeUndefined();
    expect(sm.findVisibleRow(9, "down")).toBeUndefined();
    expect(sm.findVisibleRow(9, "up")).toBe(8);
    // A start outside the grid is moved into it.
    expect(sm.findVisibleRow(-5, "down")).toBe(2);
    expect(sm.findVisibleRow(42, "up")).toBe(8);
    expect(sm.findVisibleRow(-1, "up")).toBeUndefined();
    expect(sm.findVisibleRow(10, "down")).toBeUndefined();
  });

  test("findVisibleRow is unbounded downward in an infinite grid", () => {
    const sm = manager({
      rows: "infinity",
      hiddenRows: [0, 100, 101, 102, 1_000_000],
    });

    expect(sm.findVisibleRow(100, "down")).toBe(103);
    expect(sm.findVisibleRow(1_000_000, "down")).toBe(1_000_001);
    expect(sm.findVisibleRow(0, "down")).toBe(1);
    expect(sm.findVisibleRow(0, "up")).toBeUndefined();
    expect(sm.findVisibleRow(102, "up")).toBe(99);
  });

  test("findVisibleRow finds nothing in an empty grid", () => {
    const sm = manager({ rows: 0 });
    expect(sm.findVisibleRow(0, "down")).toBeUndefined();
    expect(sm.findVisibleRow(0, "up")).toBeUndefined();
  });

  test("long runs of hidden rows resolve to their visible neighbours", () => {
    const hidden = Array.from({ length: 100_000 }, (_, index) => index + 1);
    const sm = manager({ rows: 200_000, hiddenRows: hidden });
    select(sm, 0, 0);

    expect(sm.findVisibleRow(1, "down")).toBe(100_001);
    expect(sm.findVisibleRow(100_000, "up")).toBe(0);
    press(sm, "ArrowDown");
    expect(sm.selections).toEqual([area(100_001, 0, 100_001, 0)]);
    expect(sm.selectionBorders({ row: 100_001, col: 0 })).toEqual([
      "top",
      "bottom",
      "left",
      "right",
    ]);
  });
});

describe("publishing hidden-row changes", () => {
  test("notifies onNextState listeners only when the set changes", () => {
    const sm = manager();
    select(sm, 2, 1, 6, 2);
    const publish = mock();
    sm.onNextState(publish);

    sm.setHiddenRows([3, 2]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenLastCalledWith(sm.getState());

    sm.setHiddenRows(new Set([2, 3]));
    sm.setHiddenRows([3, 3, 2, -1]);
    expect(publish).toHaveBeenCalledTimes(1);

    sm.setHiddenRows([2]);
    expect(publish).toHaveBeenCalledTimes(2);
    sm.setHiddenRows([]);
    sm.setHiddenRows([]);
    expect(publish).toHaveBeenCalledTimes(3);
  });

  test("uncontrolled: publishes the unchanged state without a state update", () => {
    const sm = manager();
    select(sm, 2, 1, 6, 2);
    const published = mock();
    sm.onNextState(published);
    const selections = sm.selections;
    const prevState = sm.prevState;

    sm.setHiddenRows([4]);

    expect(published).toHaveBeenCalledTimes(1);
    expect(published.mock.calls[0]![0].selections).toBe(selections);
    expect(sm.selections).toBe(selections);
    expect(sm.prevState).toBe(prevState);
  });

  test("controlled: publishes the current state and requests no new state", () => {
    const sm = manager();
    select(sm, 2, 1, 6, 2);
    sm.controlled = true;
    const requested = mock();
    const published = mock();
    sm.onNewRequestedState(requested);
    sm.onNextState(published);
    const selections = sm.selections;
    const prevState = sm.prevState;

    sm.setHiddenRows([4]);

    expect(requested).not.toHaveBeenCalled();
    expect(sm.patches).toEqual([]);
    expect(sm.prevState).toBe(prevState);
    expect(sm.selections).toBe(selections);
    expect(published).toHaveBeenCalledTimes(1);
    expect(published.mock.calls[0]![0].selections).toBe(selections);
  });

  test("mounted cells, headers and observers recompute their decorations", () => {
    const sm = manager({ rows: 10, cols: 5 });
    sm.headerMouseDown(2, "row", headerKeys);
    sm.headerMouseEnter(6, "row");
    sm.mouseUp();
    const cell = mockElement();
    const header = mockElement();
    const cleanupCell = sm.setupCellElement(cell, { row: 5, col: 1 });
    const cleanupHeader = sm.setupHeaderElement(header, 5, "row");
    const fillHandle = mock();
    const stopObserving = sm.observeStateChange(
      () => sm.canCellHaveFillHandle({ row: 5, col: 4 }),
      fillHandle,
      true,
    );
    expect(cell.style.boxShadow).not.toContain(BLUE_BOTTOM);
    expect(header.style.boxShadow).not.toContain(BLUE_BOTTOM);
    expect(fillHandle).toHaveBeenLastCalledWith(false);

    sm.setHiddenRows([6]);

    expect(cell.style.boxShadow).toContain(BLUE_BOTTOM);
    expect(header.style.boxShadow).toContain(BLUE_BOTTOM);
    expect(fillHandle).toHaveBeenLastCalledWith(true);
    cleanupCell();
    cleanupHeader();
    stopObserving();
  });
});

describe("step navigation skips hidden rows", () => {
  test("arrows, Enter and Shift+Enter move to the nearest visible row", () => {
    const sm = manager({ hiddenRows: [3, 4, 6] });
    select(sm, 2, 1);
    const requests: ViewportRequest[] = [];
    sm.listenToViewportRequest((request) => requests.push(request));

    press(sm, "ArrowDown");
    expect(sm.selections).toEqual([area(5, 1, 5, 1)]);
    press(sm, "Enter");
    expect(sm.selections).toEqual([area(7, 1, 7, 1)]);
    press(sm, "Enter", { shiftKey: true });
    expect(sm.selections).toEqual([area(5, 1, 5, 1)]);
    press(sm, "ArrowUp");
    expect(sm.selections).toEqual([area(2, 1, 2, 1)]);
    expect(
      requests.map((request) =>
        request.type === "reveal-cell" ? request.cell : undefined,
      ),
    ).toEqual([
      { row: 5, col: 1 },
      { row: 7, col: 1 },
      { row: 5, col: 1 },
      { row: 2, col: 1 },
    ]);
  });

  test("Shift+Arrow extends the active end past hidden rows", () => {
    const sm = manager({ hiddenRows: [3, 4] });
    select(sm, 2, 1);

    press(sm, "ArrowDown", { shiftKey: true });
    expect(sm.selections).toEqual([area(2, 1, 5, 1)]);
    press(sm, "ArrowDown", { shiftKey: true });
    expect(sm.selections).toEqual([area(2, 1, 6, 1)]);
    press(sm, "ArrowUp", { shiftKey: true });
    press(sm, "ArrowUp", { shiftKey: true });
    expect(sm.selections).toEqual([area(2, 1, 2, 1)]);
  });

  test("stays put when no visible row exists in that direction", () => {
    const sm = manager({ rows: 10, hiddenRows: [0, 1, 7, 8, 9] });
    select(sm, 6, 2);
    const publish = mock();
    const requests: ViewportRequest[] = [];
    sm.onNextState(publish);
    sm.listenToViewportRequest((request) => requests.push(request));

    const down = press(sm, "ArrowDown");
    press(sm, "Enter");
    press(sm, "ArrowDown", { shiftKey: true });

    expect(sm.selections).toEqual([area(6, 2, 6, 2)]);
    expect(publish).not.toHaveBeenCalled();
    expect(down.preventDefault).toHaveBeenCalled();
    expect(requests).toHaveLength(3);
    expect(
      requests.every(
        (request) => request.type === "reveal-cell" && request.cell.row === 6,
      ),
    ).toBe(true);

    select(sm, 2, 2);
    press(sm, "ArrowUp");
    press(sm, "Enter", { shiftKey: true });
    press(sm, "ArrowUp", { shiftKey: true });
    expect(sm.selections).toEqual([area(2, 2, 2, 2)]);
  });

  test("skips hidden rows in an infinite grid", () => {
    const sm = manager({
      rows: "infinity",
      cols: "infinity",
      hiddenRows: [1, 2, 3, 50],
    });
    select(sm, 0, 4);

    press(sm, "ArrowDown");
    expect(sm.selections).toEqual([area(4, 4, 4, 4)]);
    press(sm, "ArrowUp");
    expect(sm.selections).toEqual([area(0, 4, 0, 4)]);
  });

  test("moves off a hidden row vertically and leaves horizontal moves alone", () => {
    const sm = manager({ hiddenRows: [3, 4, 5] });
    // e.g. a cell selected before a filter hid its row
    select(sm, 4, 1);

    press(sm, "ArrowRight");
    expect(sm.selections).toEqual([area(4, 2, 4, 2)]);
    press(sm, "Tab");
    expect(sm.selections).toEqual([area(4, 3, 4, 3)]);
    press(sm, "ArrowLeft", { metaKey: true });
    expect(sm.selections).toEqual([area(4, 0, 4, 0)]);
    press(sm, "ArrowDown");
    expect(sm.selections).toEqual([area(6, 0, 6, 0)]);

    select(sm, 4, 1);
    press(sm, "ArrowUp");
    expect(sm.selections).toEqual([area(2, 1, 2, 1)]);
  });

  test("host-resolved steps skip hidden rows like built-in steps", () => {
    const sm = manager({
      rows: 10,
      hiddenRows: [3, 4, 8, 9],
      navigation: {
        resolveTarget: (request) =>
          request.kind === "step" && request.direction === "down"
            ? { row: request.origin.row + 1, col: request.origin.col }
            : undefined,
      },
    });

    select(sm, 2, 0);
    press(sm, "ArrowDown");
    expect(sm.selections).toEqual([area(5, 0, 5, 0)]);

    select(sm, 7, 0);
    press(sm, "ArrowDown");
    expect(sm.selections).toEqual([area(7, 0, 7, 0)]);
  });
});

describe("jump navigation snaps back from hidden rows", () => {
  const table = {
    id: "orders",
    bounds: area(0, 0, 10, 3),
    dataBounds: area(1, 0, 10, 3),
  };

  test("Ctrl+Down stops on the last visible data row of a filtered table", () => {
    const sm = manager({
      hiddenRows: [8, 9, 10],
      navigation: { getTableAt: () => table },
    });
    select(sm, 2, 1);
    const requests: ViewportRequest[] = [];
    sm.listenToViewportRequest((request) => requests.push(request));

    press(sm, "ArrowDown", { ctrlKey: true });

    expect(sm.selections).toEqual([area(7, 1, 7, 1)]);
    expect(requests[0]).toMatchObject({
      cell: { row: 7, col: 1 },
      kind: "jump",
      align: "end",
    });
  });

  test("Cmd+Up stops on the first visible row", () => {
    const sm = manager({ hiddenRows: [0, 1, 2] });
    select(sm, 9, 3);

    press(sm, "ArrowUp", { metaKey: true });

    expect(sm.selections).toEqual([area(3, 3, 3, 3)]);
  });

  test("Ctrl+Shift+Arrow extends to the snapped target", () => {
    const sm = manager({
      hiddenRows: [9, 10],
      navigation: { getTableAt: () => table },
    });
    select(sm, 2, 1);

    press(sm, "ArrowDown", { ctrlKey: true, shiftKey: true });

    expect(sm.selections).toEqual([area(2, 1, 8, 1)]);
  });

  test("keeps the origin when every row up to the target is hidden", () => {
    const sm = manager({
      hiddenRows: [6, 7, 8, 9, 10],
      navigation: { getTableAt: () => table },
    });
    select(sm, 5, 1);
    const publish = mock();
    sm.onNextState(publish);

    const event = press(sm, "ArrowDown", { ctrlKey: true });

    expect(sm.selections).toEqual([area(5, 1, 5, 1)]);
    expect(publish).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("host-resolved jump targets on hidden rows snap back toward the origin", () => {
    const received: NavigationRequest[] = [];
    const sm = manager({
      rows: 30,
      hiddenRows: [2, 3, 11, 12, 13],
      navigation: {
        resolveTarget: (request) => {
          received.push(request);
          if (request.kind !== "jump") return undefined;
          return {
            row: request.direction === "down" ? 13 : 2,
            col: request.origin.col,
          };
        },
      },
    });
    select(sm, 6, 0);

    press(sm, "ArrowDown", { metaKey: true });
    expect(sm.selections).toEqual([area(10, 0, 10, 0)]);
    press(sm, "ArrowUp", { metaKey: true });
    expect(sm.selections).toEqual([area(4, 0, 4, 0)]);
    // The host still receives the plain sheet coordinates.
    expect(received.map((request) => request.origin.row)).toEqual([6, 10]);
  });

  test("getNavigationTarget applies the same rules for hosts and tests", () => {
    const sm = manager({ rows: 20, hiddenRows: [5, 6, 7] });
    const gridBounds = sm.getGridBounds()!;
    const request = (
      origin: SMCell,
      direction: SMDirection,
      kind: NavigationKind,
    ): NavigationRequest => ({
      origin,
      direction,
      kind,
      extend: false,
      gridBounds,
    });

    expect(
      sm.getNavigationTarget(request({ row: 4, col: 1 }, "down", "step")),
    ).toEqual({ row: 8, col: 1 });
    expect(
      sm.getNavigationTarget(request({ row: 8, col: 1 }, "up", "step")),
    ).toEqual({ row: 4, col: 1 });
    expect(
      sm.getNavigationTarget({
        ...request({ row: 1, col: 1 }, "down", "jump"),
        usedRange: area(0, 0, 7, 3),
      }),
    ).toEqual({ row: 4, col: 1 });
    expect(
      sm.getNavigationTarget(request({ row: 6, col: 1 }, "right", "step")),
    ).toEqual({ row: 6, col: 2 });
  });
});

describe("borders use the nearest visible rows", () => {
  test("a selection shows its top and bottom borders on its first and last visible rows", () => {
    const sm = manager({ hiddenRows: [2, 6] });
    select(sm, 2, 1, 6, 2);

    expect(sm.selectionBorders({ row: 3, col: 1 })).toEqual(["top", "left"]);
    expect(sm.selectionBorders({ row: 4, col: 1 })).toEqual(["left"]);
    expect(sm.selectionBorders({ row: 5, col: 2 })).toEqual([
      "bottom",
      "right",
    ]);
    expect(sm.getCellBoxShadow({ row: 3, col: 1 })).toContain(BLUE_TOP);
    expect(sm.getCellBoxShadow({ row: 5, col: 2 })).toContain(BLUE_BOTTOM);
  });

  test("hidden rows inside or between selections do not split the outline", () => {
    const sm = manager({ hiddenRows: [3, 4] });
    select(sm, 1, 0, 2, 1);
    sm.cellMouseDown(5, 0, { ...pointer, metaKey: true });
    sm.cellMouseEnter(6, 1);
    sm.mouseUp();
    expect(sm.selections).toHaveLength(2);

    expect(sm.selectionBorders({ row: 2, col: 0 })).toEqual(["left"]);
    expect(sm.selectionBorders({ row: 5, col: 0 })).toEqual(["left"]);
    expect(sm.selectionBorders({ row: 6, col: 0 })).toEqual(["bottom", "left"]);
  });

  test("a whole-column selection keeps its header edge when the first rows are hidden", () => {
    const sm = manager({ rows: 10, hiddenRows: [0, 1] });
    sm.headerMouseDown(1, "col", headerKeys);
    sm.mouseUp();
    expect(sm.isWholeColSelected(1)).toBe(true);

    // Like row 0 without hidden rows, the first visible row leaves the top
    // edge to the column header.
    expect(sm.selectionBorders({ row: 2, col: 1 })).toContain("top");
    expect(sm.getCellBoxShadow({ row: 2, col: 1 })).not.toContain(BLUE_TOP);

    // A partial column still shows its top border on its first visible row.
    select(sm, 0, 1, 5, 1);
    expect(sm.getCellBoxShadow({ row: 2, col: 1 })).toContain(BLUE_TOP);
  });

  test("the selection being dragged uses its first and last visible rows", () => {
    const sm = manager({ hiddenRows: [2, 6] });
    sm.cellMouseDown(2, 1, pointer);
    sm.cellMouseEnter(6, 2);

    expect(sm.currentSelectionBorders({ row: 3, col: 1 })).toEqual([
      "top",
      "left",
    ]);
    expect(sm.currentSelectionBorders({ row: 4, col: 2 })).toEqual(["right"]);
    expect(sm.currentSelectionBorders({ row: 5, col: 2 })).toEqual([
      "bottom",
      "right",
    ]);
    expect(sm.getCellBoxShadow({ row: 3, col: 1 })).toContain(GRAY_TOP);
    expect(sm.getCellBoxShadow({ row: 5, col: 1 })).toContain(GRAY_BOTTOM);
    sm.mouseUp();
  });

  test("reference ranges use their first and last visible rows", () => {
    const sm = manager({ hiddenRows: [2, 6] });
    sm.beginReferenceSelection({ initialRange: area(2, 1, 6, 2) });

    expect(sm.referenceSelectionBorders({ row: 3, col: 1 })).toEqual([
      "top",
      "left",
    ]);
    expect(sm.referenceSelectionBorders({ row: 4, col: 1 })).toEqual(["left"]);
    expect(sm.referenceSelectionBorders({ row: 5, col: 2 })).toEqual([
      "bottom",
      "right",
    ]);
  });

  test("row headers treat the nearest visible rows as neighbours", () => {
    const sm = manager({ hiddenRows: [2, 5] });
    sm.headerMouseDown(2, "row", headerKeys);
    sm.headerMouseEnter(5, "row");

    // While dragging, the outline spans the visible rows 3 and 4.
    expect(sm.getHeaderBoxShadow(3, "row")).toContain(GRAY_TOP);
    expect(sm.getHeaderBoxShadow(3, "row")).not.toContain(GRAY_BOTTOM);
    expect(sm.getHeaderBoxShadow(4, "row")).toContain(GRAY_BOTTOM);
    expect(sm.getHeaderBoxShadow(4, "row")).not.toContain(GRAY_TOP);

    sm.mouseUp();
    expect(sm.getHeaderBoxShadow(3, "row")).toContain(BLUE_TOP);
    expect(sm.getHeaderBoxShadow(3, "row")).not.toContain(BLUE_BOTTOM);
    expect(sm.getHeaderBoxShadow(4, "row")).toContain(BLUE_BOTTOM);
    expect(sm.getHeaderBoxShadow(4, "row")).not.toContain(BLUE_TOP);
  });
});

describe("fill handle", () => {
  test("sits on the last visible row of the selection", () => {
    const sm = manager({ rows: 10, hiddenRows: [5, 6] });
    select(sm, 2, 1, 6, 2);

    expect(sm.canCellHaveFillHandle({ row: 4, col: 2 })).toBe(true);
    expect(sm.canCellHaveFillHandle({ row: 6, col: 2 })).toBe(false);
    expect(sm.canCellHaveFillHandle({ row: 4, col: 1 })).toBe(false);

    sm.setHiddenRows([2, 3, 4, 5, 6]);
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 5; col++) {
        expect(sm.canCellHaveFillHandle({ row, col })).toBe(false);
      }
    }
  });

  test("dragging sideways from the visible handle fills unmapped ranges", () => {
    const sm = manager({ hiddenRows: [5, 6] });
    select(sm, 2, 1, 6, 2);
    const events: FillEvent[] = [];
    sm.listenToFill((event) => events.push(event));

    // Pressing the handle keeps the whole base, hidden rows included.
    sm.cellMouseDown(4, 2, { ...pointer, isFillHandle: true });
    expect(sm.isSelecting).toMatchObject(area(2, 1, 6, 2));

    // One column to the right of the handle fills to the right.
    sm.cellMouseEnter(4, 3);
    expect(sm.isSelecting).toMatchObject({
      type: "fill",
      direction: "right",
      eventType: "extend",
      ...area(2, 1, 6, 3),
    });
    sm.mouseUp();

    expect(events).toEqual([
      {
        type: "extend",
        direction: "right",
        seedRange: area(2, 1, 6, 2),
        fillRange: area(2, 3, 6, 3),
        outputRange: expect.objectContaining(area(2, 1, 6, 3)),
      },
    ]);
  });

  test("vertical drags extend or shrink with hidden rows kept in the ranges", () => {
    const sm = manager({ hiddenRows: [5, 6, 8] });
    select(sm, 2, 1, 6, 2);
    const events: FillEvent[] = [];
    sm.listenToFill((event) => events.push(event));

    sm.cellMouseDown(4, 2, { ...pointer, isFillHandle: true });
    sm.cellMouseEnter(9, 2);
    sm.mouseUp();
    expect(events[0]).toMatchObject({
      type: "extend",
      direction: "down",
      seedRange: area(2, 1, 6, 2),
      fillRange: area(7, 1, 9, 2),
    });

    select(sm, 2, 1, 6, 2);
    sm.cellMouseDown(4, 2, { ...pointer, isFillHandle: true });
    sm.cellMouseEnter(3, 2);
    sm.mouseUp();
    expect(events[1]).toEqual({
      type: "shrink",
      rangeToClear: area(4, 1, 6, 2),
    });
  });
});

describe("clearing and TSV export skip hidden rows", () => {
  test("clearSelectedCells, Delete and Backspace leave hidden rows untouched", () => {
    const sm = manager({ hiddenRows: [2, 3] });
    const updates = mock();
    sm.listenToUpdateData(updates);
    select(sm, 1, 0, 4, 1);

    sm.clearSelectedCells();
    expect(updates).toHaveBeenCalledTimes(1);
    expect(updates.mock.calls[0]![0]).toEqual([
      { rowIndex: 1, colIndex: 0, value: "" },
      { rowIndex: 1, colIndex: 1, value: "" },
      { rowIndex: 4, colIndex: 0, value: "" },
      { rowIndex: 4, colIndex: 1, value: "" },
    ]);

    press(sm, "Delete");
    expect(updates).toHaveBeenCalledTimes(2);
    expect(updates.mock.calls[1]![0]).toEqual(updates.mock.calls[0]![0]);

    // A range whose rows are all hidden clears nothing.
    select(sm, 2, 0, 3, 1);
    press(sm, "Backspace");
    expect(updates).toHaveBeenCalledTimes(2);
  });

  test("cells reported by a getCellsWithData override are filtered too", () => {
    const sm = manager({
      rows: "infinity",
      cols: "infinity",
      hiddenRows: [7],
    });
    sm.getCellsWithData = () => [
      { rowIndex: 6, colIndex: 0 },
      { rowIndex: 7, colIndex: 0 },
      { rowIndex: 8, colIndex: 0 },
    ];
    const updates = mock();
    sm.listenToUpdateData(updates);
    sm.replaceSelections([
      {
        start: { row: 0, col: 0 },
        end: { row: { type: "infinity" }, col: finite(0) },
      },
    ]);

    sm.clearSelectedCells();

    expect(updates).toHaveBeenCalledWith([
      { rowIndex: 6, colIndex: 0, value: "" },
      { rowIndex: 8, colIndex: 0, value: "" },
    ]);
  });

  test("selectionToTsv leaves out hidden rows", () => {
    const sm = manager({ hiddenRows: [1] });
    const data = new Map<string, unknown>([
      ["0,0", "a"],
      ["0,1", "b"],
      ["1,0", "hidden"],
      ["1,1", "row"],
      ["2,0", "c"],
      ["2,1", "d"],
    ]);
    select(sm, 0, 0, 2, 1);

    expect(sm.selectionToTsv(data)).toBe("a\tb\nc\td");
    sm.setHiddenRows([]);
    expect(sm.selectionToTsv(data)).toBe("a\tb\nhidden\trow\nc\td");
  });
});

describe("behaviour that keeps plain sheet coordinates", () => {
  test("mouse selection, select-all and header clicks span hidden rows", () => {
    const sm = manager({ rows: 10, cols: 4, hiddenRows: [3, 4] });

    select(sm, 2, 0, 5, 1);
    expect(sm.selections).toEqual([area(2, 0, 5, 1)]);
    expect(sm.isSelected({ row: 3, col: 0 })).toBe(true);

    press(sm, "a", { metaKey: true });
    expect(sm.selections).toEqual([area(0, 0, 9, 3)]);

    sm.headerMouseDown(3, "row", headerKeys);
    sm.mouseUp();
    expect(sm.selections).toEqual([area(3, 0, 3, 3)]);
  });

  test("cell iteration and decomposition include hidden rows", () => {
    const sm = manager({ rows: 10, cols: 4, hiddenRows: [3] });
    select(sm, 2, 0, 4, 0);

    const visited: number[] = [];
    sm.forEachSelectedCell(({ absolute }) => visited.push(absolute.row));

    expect(visited).toEqual([2, 3, 4]);
    expect(sm.getNonOverlappingSelections()).toEqual([area(2, 0, 4, 0)]);
  });

  test("paste writes to consecutive sheet rows", () => {
    const sm = manager({ rows: 10, cols: 4, hiddenRows: [3] });
    select(sm, 2, 1);
    sm.focus();
    const pastes: PasteEvent[] = [];
    sm.listenToPaste((event) => pastes.push(event));

    sm.handlePaste({
      preventDefault: mock(),
      clipboardData: { getData: () => "x\ny\nz" },
    } as unknown as ClipboardEvent);

    expect(pastes[0]!.updates).toEqual([
      { rowIndex: 2, colIndex: 1, value: "x" },
      { rowIndex: 3, colIndex: 1, value: "y" },
      { rowIndex: 4, colIndex: 1, value: "z" },
    ]);
  });
});

describe("without hidden rows", () => {
  test("clearing the set restores every decoration", () => {
    const sm = manager({ rows: 8, cols: 4 });
    select(sm, 1, 1, 3, 2);
    sm.cellMouseDown(5, 0, { ...pointer, metaKey: true });
    sm.cellMouseEnter(6, 3);
    const snapshot = () => {
      const decorations: unknown[] = [];
      for (let row = 0; row < 8; row++) {
        decorations.push(sm.getHeaderBoxShadow(row, "row"));
        for (let col = 0; col < 4; col++) {
          const cell = { row, col };
          decorations.push(
            sm.getCellBoxShadow(cell),
            sm.selectionBorders(cell),
            sm.currentSelectionBorders(cell),
            sm.canCellHaveFillHandle(cell),
          );
        }
      }
      for (let col = 0; col < 4; col++) {
        decorations.push(sm.getHeaderBoxShadow(col, "col"));
      }
      return JSON.stringify(decorations);
    };
    const before = snapshot();

    sm.setHiddenRows([1, 3, 6]);
    expect(snapshot()).not.toBe(before);
    sm.setHiddenRows([]);
    expect(snapshot()).toBe(before);
  });
});

describe("useInitializeSelectionManager hiddenRows", () => {
  const getNumRows = () => finite(10);
  const getNumCols = () => finite(5);

  test("hands the initial rows to the manager before the first render", () => {
    for (const hiddenRows of [[5, 6], new Set([5, 6])]) {
      let sm: SelectionManager | undefined;
      let handleOnRow4: boolean | undefined;
      function Grid() {
        const manager = useInitializeSelectionManager({
          getNumRows,
          getNumCols,
          initialState: { selections: [area(2, 1, 6, 2)] },
          hiddenRows,
        });
        sm = manager;
        handleOnRow4 = useSelectionManager(manager, () =>
          manager.canCellHaveFillHandle({ row: 4, col: 2 }),
        );
        return null;
      }

      renderToString(createElement(Grid));

      expect([...sm!.getHiddenRows()]).toEqual([5, 6]);
      expect(handleOnRow4).toBe(true);
    }
  });

  /** Renders into a happy-dom document with react-dom's client renderer. */
  const renderInDom = async () => {
    const window = new Window();
    const globals = globalThis as Record<string, unknown>;
    const saved = {
      window: globals.window,
      document: globals.document,
      IS_REACT_ACT_ENVIRONMENT: globals.IS_REACT_ACT_ENVIRONMENT,
    };
    Object.assign(globals, {
      window,
      document: window.document,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    const { createRoot } = await import("react-dom/client");
    const container = window.document.createElement("div");
    window.document.body.appendChild(container);
    const root = createRoot(container as unknown as HTMLElement);
    return {
      render: (element: ReactElement) =>
        act(async () => {
          root.render(element);
        }),
      act: (callback: () => void) =>
        act(async () => {
          callback();
        }),
      cleanup: async () => {
        await act(async () => root.unmount());
        Object.assign(globals, saved);
        await window.happyDOM.close();
      },
    };
  };

  test("applies new rows while rendering and publishes them once after commit", async () => {
    const dom = await renderInDom();
    try {
      const log: string[] = [];
      const managers = new Set<SelectionManager>();
      const onStateChange = mock();
      const Cell = memo(function Cell(props: {
        sm: SelectionManager;
        row: number;
      }) {
        const { sm, row } = props;
        const hasHandle = useSelectionManager(sm, () =>
          sm.canCellHaveFillHandle({ row, col: 2 }),
        );
        log.push(`${row}:${hasHandle}`);
        return null;
      });
      function Grid(props: { rows: number[]; hiddenRows?: readonly number[] }) {
        const sm = useInitializeSelectionManager({
          getNumRows,
          getNumCols,
          initialState: { selections: [area(2, 1, 6, 2)] },
          onStateChange,
          hiddenRows: props.hiddenRows,
        });
        managers.add(sm);
        return props.rows.map((row) =>
          createElement(Cell, { key: row, sm, row }),
        );
      }

      await dom.render(createElement(Grid, { rows: [6] }));
      const [sm] = [...managers];
      expect(log).toEqual(["6:true"]);
      const publish = mock();
      sm!.onNextState(publish);

      // Row 4 mounts in the same commit that hides rows 5 and 6: it renders
      // with the new rows at once, and mounted row 6 is notified.
      log.length = 0;
      await dom.render(
        createElement(Grid, { rows: [4, 6], hiddenRows: [5, 6] }),
      );
      expect(log).toEqual(["4:true", "6:false"]);
      expect(publish).toHaveBeenCalledTimes(1);
      expect([...sm!.getHiddenRows()]).toEqual([5, 6]);

      // An equal set in a new array is not a change.
      const sameRows = [6, 5];
      log.length = 0;
      await dom.render(
        createElement(Grid, { rows: [4, 6], hiddenRows: sameRows }),
      );
      expect(log).toEqual([]);
      expect(publish).toHaveBeenCalledTimes(1);

      // Imperative changes stand until the prop changes again...
      await dom.act(() => sm!.setHiddenRows([6]));
      expect(log).toEqual(["4:false"]);
      await dom.render(
        createElement(Grid, { rows: [4, 6], hiddenRows: sameRows }),
      );
      expect([...sm!.getHiddenRows()]).toEqual([6]);

      // ...and removing the prop clears them.
      log.length = 0;
      await dom.render(createElement(Grid, { rows: [4, 6] }));
      expect(log).toEqual(["6:true"]);
      expect(sm!.getHiddenRows().size).toBe(0);

      expect(managers.size).toBe(1);
      // Hidden rows are not selection state.
      expect(onStateChange).not.toHaveBeenCalled();
    } finally {
      await dom.cleanup();
    }
  });

  test("consumers of a controlled manager see new rows in the same render", async () => {
    const dom = await renderInDom();
    try {
      const log: string[] = [];
      const onStateChange = mock();
      const state: SelectionManagerState = {
        hasFocus: false,
        selections: [area(2, 1, 6, 2)],
        isSelecting: { type: "none" },
        isEditing: { type: "none" },
        isHovering: { type: "none" },
        selectionMode: "primary",
        referenceSelection: { type: "none" },
      };
      function Cell(props: { sm: SelectionManager; row: number }) {
        const { sm, row } = props;
        const hasHandle = useSelectionManager(sm, () =>
          sm.canCellHaveFillHandle({ row, col: 2 }),
        );
        log.push(`${row}:${hasHandle}`);
        return null;
      }
      let sm: SelectionManager | undefined;
      function Grid(props: { hiddenRows?: ReadonlySet<number> }) {
        const manager = useInitializeSelectionManager({
          getNumRows,
          getNumCols,
          state,
          onStateChange,
          hiddenRows: props.hiddenRows,
        });
        sm = manager;
        return [4, 6].map((row) =>
          createElement(Cell, { key: row, sm: manager, row }),
        );
      }

      await dom.render(createElement(Grid, {}));
      expect(log).toEqual(["4:false", "6:true"]);

      log.length = 0;
      await dom.render(createElement(Grid, { hiddenRows: new Set([5, 6]) }));

      expect(log).toEqual(["4:true", "6:false"]);
      expect(onStateChange).not.toHaveBeenCalled();
      expect(sm!.patches).toEqual([]);
      expect(sm!.selections).toBe(state.selections);
    } finally {
      await dom.cleanup();
    }
  });
});
