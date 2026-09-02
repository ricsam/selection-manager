import { describe, expect, mock, test } from "bun:test";
import { SelectionManager } from "../src/selection-manager";
import type {
  NavigationRequest,
  ReferenceSelectionEvent,
  SMArea,
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

const selectCell = (manager: SelectionManager, row: number, col: number) => {
  manager.cellMouseDown(row, col, {
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    isFillHandle: false,
  });
  manager.mouseUp();
};

const keyEvent = (
  key: string,
  options: Partial<{
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  }> = {},
) => ({
  key,
  shiftKey: options.shiftKey ?? false,
  ctrlKey: options.ctrlKey ?? false,
  metaKey: options.metaKey ?? false,
  preventDefault: mock(),
});

describe("grid bounds and semantic navigation", () => {
  test("reports finite, infinite, and empty grid bounds", () => {
    const finiteManager = new SelectionManager(
      () => finite(12),
      () => finite(5),
      () => [],
    );
    expect(finiteManager.getGridBounds()).toEqual(area(0, 0, 11, 4));

    const infiniteManager = new SelectionManager(
      () => ({ type: "infinity" }),
      () => finite(5),
      () => [],
    );
    expect(infiniteManager.getGridBounds()).toEqual({
      start: { row: 0, col: 0 },
      end: { row: { type: "infinity" }, col: finite(4) },
    });

    const emptyManager = new SelectionManager(
      () => finite(0),
      () => finite(5),
      () => [],
    );
    expect(emptyManager.getGridBounds()).toBeUndefined();
  });

  test("delegates data and table bounds and lets a host resolve Cmd+Arrow", () => {
    const usedRange = area(1, 2, 15, 8);
    const table = {
      id: "orders",
      bounds: area(2, 2, 10, 6),
      dataBounds: area(3, 2, 9, 6),
    };
    let received: NavigationRequest | undefined;
    const manager = new SelectionManager(
      () => finite(100),
      () => finite(20),
      () => [],
      {
        navigation: {
          getUsedRange: () => usedRange,
          getTableAt: (cell) => (cell.row <= 10 ? table : undefined),
          resolveTarget: (request) => {
            received = request;
            return { row: 9, col: request.origin.col };
          },
        },
      },
    );
    selectCell(manager, 4, 3);
    const viewportRequests: ViewportRequest[] = [];
    manager.listenToViewportRequest((request) =>
      viewportRequests.push(request),
    );

    const event = keyEvent("ArrowDown", { metaKey: true });
    manager.handleKeyDown(event);

    expect(received).toEqual({
      origin: { row: 4, col: 3 },
      direction: "down",
      kind: "jump",
      extend: false,
      gridBounds: area(0, 0, 99, 19),
      usedRange,
      table,
    });
    expect(manager.selections).toEqual([area(9, 3, 9, 3)]);
    expect(viewportRequests).toEqual([
      {
        type: "reveal-cell",
        cell: { row: 9, col: 3 },
        direction: "down",
        align: "end",
        reason: "keyboard-navigation",
        kind: "jump",
      },
    ]);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(manager.getUsedRange()).toBe(usedRange);
    expect(manager.getTableAt({ row: 4, col: 3 })).toBe(table);
  });

  test("Ctrl+Shift+Arrow extends to the resolved semantic target", () => {
    const manager = new SelectionManager(
      () => finite(50),
      () => finite(10),
      () => [],
      {
        navigation: {
          resolveTarget: (request) =>
            request.direction === "down" ? { row: 12, col: 2 } : undefined,
        },
      },
    );
    selectCell(manager, 3, 2);

    manager.handleKeyDown(
      keyEvent("ArrowDown", { ctrlKey: true, shiftKey: true }),
    );

    expect(manager.selections).toEqual([area(3, 2, 12, 2)]);
  });

  test("jump fallback prefers table data bounds, then used range", () => {
    const table = {
      id: "table",
      bounds: area(2, 2, 10, 6),
      dataBounds: area(3, 2, 8, 6),
    };
    const tableManager = new SelectionManager(
      () => finite(100),
      () => finite(20),
      () => [],
      { navigation: { getTableAt: () => table } },
    );
    selectCell(tableManager, 4, 3);
    tableManager.handleKeyDown(keyEvent("ArrowDown", { ctrlKey: true }));
    expect(tableManager.selections).toEqual([area(8, 3, 8, 3)]);

    const usedManager = new SelectionManager(
      () => finite(100),
      () => finite(20),
      () => [],
      { navigation: { getUsedRange: () => area(1, 1, 17, 7) } },
    );
    selectCell(usedManager, 4, 3);
    usedManager.handleKeyDown(keyEvent("ArrowRight", { metaKey: true }));
    expect(usedManager.selections).toEqual([area(4, 7, 4, 7)]);
  });

  test("emits a viewport request for an unchanged jump target", () => {
    const manager = new SelectionManager(
      () => ({ type: "infinity" }),
      () => ({ type: "infinity" }),
      () => [],
    );
    selectCell(manager, 0, 2);
    const requests: ViewportRequest[] = [];
    manager.listenToViewportRequest((request) => requests.push(request));

    const event = keyEvent("ArrowUp", { metaKey: true });
    manager.handleKeyDown(event);

    expect(manager.selections).toEqual([area(0, 2, 0, 2)]);
    expect(requests[0]).toMatchObject({
      cell: { row: 0, col: 2 },
      align: "start",
      kind: "jump",
    });
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe("formula reference selection", () => {
  test("keeps reference dragging separate from selection and editing state", () => {
    const manager = new SelectionManager(
      () => finite(20),
      () => finite(10),
      () => [],
    );
    selectCell(manager, 1, 1);
    manager.setState({ isEditing: { type: "cell", row: 1, col: 1 } });
    const primarySelection = structuredClone(manager.selections);
    const events: ReferenceSelectionEvent[] = [];
    manager.listenToReferenceSelection((event) => events.push(event));

    manager.beginReferenceSelection({
      id: "formula-token-1",
      editedRange: area(1, 1, 1, 1),
    });
    manager.cellMouseDown(4, 5, {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      isFillHandle: false,
    });
    manager.cellMouseEnter(2, 3);

    expect(manager.selectionMode).toBe("reference");
    expect(manager.selections).toEqual(primarySelection);
    expect(manager.isSelecting).toEqual({ type: "none" });
    expect(manager.isEditing).toEqual({ type: "cell", row: 1, col: 1 });
    expect(manager.getReferenceSelection()).toEqual(area(4, 5, 2, 3));
    expect(manager.isCellInReferenceSelection({ row: 3, col: 4 })).toBe(true);
    expect(manager.isCellInReferenceSelection({ row: 1, col: 4 })).toBe(false);
    expect(manager.referenceSelectionBorders({ row: 2, col: 3 })).toEqual([
      "top",
      "left",
    ]);
    expect(manager.referenceSelectionBorders({ row: 4, col: 5 })).toEqual([
      "bottom",
      "right",
    ]);
    expect(manager.referenceSelectionBorders({ row: 3, col: 4 })).toEqual([]);

    manager.mouseUp();

    expect(manager.referenceSelection).toMatchObject({
      type: "selected",
      id: "formula-token-1",
      range: area(4, 5, 2, 3),
    });
    expect(events.map((event) => event.phase)).toEqual([
      "start",
      "change",
      "commit",
    ]);
    expect(manager.selections).toEqual(primarySelection);
  });

  test("supports whole row/column references and explicit end/cancel", () => {
    const manager = new SelectionManager(
      () => finite(12),
      () => finite(6),
      () => [],
    );
    const events: ReferenceSelectionEvent[] = [];
    manager.listenToReferenceSelection((event) => events.push(event));
    manager.beginReferenceSelection();
    manager.headerMouseDown(2, "col", {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    });
    manager.mouseUp();

    expect(manager.getReferenceSelection()).toEqual(area(0, 2, 11, 2));
    manager.endReferenceSelection({ clear: false });
    expect(manager.selectionMode).toBe("primary");
    expect(manager.getReferenceSelection()).toEqual(area(0, 2, 11, 2));

    manager.beginReferenceSelection({ initialRange: area(3, 1, 4, 2) });
    manager.cancelReferenceSelection();
    expect(manager.selectionMode).toBe("primary");
    expect(manager.referenceSelection).toEqual({ type: "none" });
    expect(events.at(-1)).toMatchObject({
      phase: "cancel",
      range: area(3, 1, 4, 2),
    });
  });

  test("produces complete requested state in controlled mode", () => {
    const manager = new SelectionManager(
      () => finite(10),
      () => finite(10),
      () => [],
    );
    selectCell(manager, 2, 2);
    manager.setState({ isEditing: { type: "cell", row: 2, col: 2 } });
    manager.controlled = true;
    let requested = manager.getState();
    manager.onNewRequestedState((state) => {
      requested = state;
    });

    manager.beginReferenceSelection({ editedRange: area(2, 2, 2, 2) });

    expect(requested.selectionMode).toBe("reference");
    expect(requested.referenceSelection).toEqual({ type: "none" });
    expect(requested.isEditing).toEqual({ type: "cell", row: 2, col: 2 });
    expect(requested.selections).toEqual([area(2, 2, 2, 2)]);

    manager.setState(requested);
    manager.cellMouseDown(5, 4, {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      isFillHandle: false,
    });

    expect(requested.referenceSelection).toMatchObject({
      type: "selecting",
      range: area(5, 4, 5, 4),
    });
    expect(requested.isEditing).toEqual({ type: "cell", row: 2, col: 2 });
    expect(requested.selections).toEqual([area(2, 2, 2, 2)]);
  });
});
