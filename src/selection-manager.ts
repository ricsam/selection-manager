import { applyPatches, createPatches } from "./patches";
import type {
  FillEvent,
  IsEditing,
  IsHovering,
  IsSelecting,
  MaybeInfNumber,
  RealNumber,
  SelectionManagerState,
  SMArea,
  StatePatch,
} from "./types";
import { parseCSVContent } from "./utils";

type KeyboardEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
};
const sort = (a: number | "INF", b: number | "INF"): number => {
  if (a === b) {
    return 0;
  }
  if (a === "INF") {
    return 1;
  }
  if (b === "INF") {
    return -1;
  }
  return a - b;
};

export class SelectionManager {
  hasFocus = false;
  selections: SMArea[] = [];
  isSelecting: IsSelecting = { type: "none" };
  isEditing: IsEditing = { type: "none" };
  isHovering: IsHovering = { type: "none" };
  controlled = false;

  key = String(Math.random());

  constructor(
    public getNumRows: () => MaybeInfNumber,
    public getNumCols: () => MaybeInfNumber,
    public getGroups: () => SMArea[],
  ) {}

  getState(): SelectionManagerState {
    return {
      hasFocus: this.hasFocus,
      selections: this.selections,
      isSelecting: this.isSelecting,
      isEditing: this.isEditing,
      isHovering: this.isHovering,
    };
  }

  setState(
    _state:
      | Partial<SelectionManagerState>
      | ((state: SelectionManagerState) => Partial<SelectionManagerState>),
  ) {
    const state =
      typeof _state === "function" ? _state(this.getState()) : _state;
    this.hasFocus = state.hasFocus ?? this.hasFocus;
    this.selections = state.selections ?? this.selections;
    this.isSelecting = state.isSelecting ?? this.isSelecting;
    this.isHovering = state.isHovering ?? this.isHovering;
  }

  nextStateListeners: ((state: SelectionManagerState) => void)[] = [];
  onNextState(callback: (state: SelectionManagerState) => void) {
    this.nextStateListeners.push(callback);
    return () => {
      this.nextStateListeners.splice(
        this.nextStateListeners.indexOf(callback),
        1,
      );
    };
  }

  /**
   * Callbacks used to update the state when the state is controlled
   * These are triggered when a new state has been computed but not yet applied
   * (i.e. when the state is controlled)
   */
  requestedStateListeners: ((state: SelectionManagerState) => void)[] = [];
  onNewRequestedState(callback: (state: SelectionManagerState) => void) {
    this.requestedStateListeners.push(callback);
    return () => {
      this.requestedStateListeners.splice(
        this.requestedStateListeners.indexOf(callback),
        1,
      );
    };
  }

  patches: StatePatch[] = [];

  onUpdate() {
    const nextState = this.getState();

    if (this.controlled) {
      // revert the state if it is controlled
      this.setState(this.prevState);
      const patch = createPatches(this.prevState, nextState);
      this.patches.push(...patch);

      const batchedNextState = applyPatches(this.prevState, this.patches);
      this.requestedStateListeners.forEach((listener) =>
        listener(batchedNextState),
      );
    } else {
      this.nextStateListeners.forEach((listener) => listener(nextState));
    }
  }

  prevState: SelectionManagerState = structuredClone(this.getState());
  willMaybeUpdate() {
    const state = structuredClone(this.getState());
    this.prevState = state;
  }

  cellMouseDown(
    row: number,
    col: number,
    options: {
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      isFillHandle: boolean;
    },
  ) {
    const cmdKey = options.metaKey || options.ctrlKey;
    this.willMaybeUpdate();
    const lastSelection = this.selections[this.selections.length - 1];
    if (options.isFillHandle) {
      const fillHandleSelection = this.getFillHandleSelection(
        { row, col },
        {
          row,
          col,
        },
      );
      if (fillHandleSelection) {
        this.isSelecting = fillHandleSelection;
        this.onUpdate();
        return;
      }
    }
    if (options.shiftKey && lastSelection) {
      this.selections.splice(this.selections.length - 1, 1);
      this.isSelecting = { ...lastSelection, type: "shift" };
      this.isSelecting.end = {
        row: { type: "number", value: row },
        col: { type: "number", value: col },
      };
    } else if (cmdKey) {
      const type: "add" | "remove" = this.isSelected({ row, col })
        ? "remove"
        : "add";
      this.isSelecting = {
        start: { row, col },
        end: {
          row: { type: "number", value: row },
          col: { type: "number", value: col },
        },
        type,
      };
    } else {
      this.isSelecting = {
        start: { row, col },
        end: {
          row: { type: "number", value: row },
          col: { type: "number", value: col },
        },
        type: "drag",
      };
      this.selections.length = 0;
    }
    this.onUpdate();
  }

  isCellInDragArea(cell: { row: number; col: number }) {
    const { row, col } = cell;
    if (this.isSelecting.type === "none") {
      return false;
    }
    if (this.isSelecting.type === "remove") {
      return false;
    }
    const startRow = this.min(
      this.isSelecting.start.row,
      this.isSelecting.end.row,
    );
    const endRow = this.max(
      this.isSelecting.start.row,
      this.isSelecting.end.row,
    );
    const startCol = this.min(
      this.isSelecting.start.col,
      this.isSelecting.end.col,
    );
    const endCol = this.max(
      this.isSelecting.start.col,
      this.isSelecting.end.col,
    );

    if (endRow.type === "infinity" && endCol.type === "infinity") {
      return row >= startRow && col >= startCol;
    }

    if (endRow.type === "number" && endCol.type === "number") {
      return (
        row >= startRow &&
        row <= endRow.value &&
        col >= startCol &&
        col <= endCol.value
      );
    }

    if (endRow.type === "infinity" && endCol.type === "number") {
      return row >= startRow && col >= startCol && col <= endCol.value;
    }
    if (endCol.type === "infinity" && endRow.type === "number") {
      return row >= startRow && row <= endRow.value && col >= startCol;
    }

    throw new Error("Invalid selection");
  }

  findGroupContainingCell(cell: { row: number; col: number }) {
    return this.getGroups().find((group) => this.cellInSelection(cell, group));
  }

  getFillHandleSelection(
    start: { row: number; col: number },
    currentCell: { row: number; col: number },
  ): IsSelecting | undefined {
    const baseSelection = this.getFillHandleBaseSelection();
    if (!baseSelection) {
      return;
    }
    const minCol = Math.min(
      currentCell.col,
      this.min(baseSelection.start.col, baseSelection.end.col),
    );
    const minRow = Math.min(
      currentCell.row,
      this.min(baseSelection.start.row, baseSelection.end.row),
    );
    const maxRow = this.max(
      currentCell.row,
      this.max(baseSelection.start.row, baseSelection.end.row),
    );
    const maxCol = this.max(
      currentCell.col,
      this.max(baseSelection.start.col, baseSelection.end.col),
    );

    if (baseSelection.end.row.type === "infinity") {
      return {
        type: "fill",
        direction: minCol < baseSelection.start.col ? "left" : "right",
        eventType: "extend",
        start: {
          row: baseSelection.start.row,
          col: minCol,
        },
        end: {
          row: maxRow,
          col: baseSelection.end.col,
        },
      };
    }
    if (baseSelection.end.col.type === "infinity") {
      return {
        type: "fill",
        direction: minRow < baseSelection.start.row ? "up" : "down",
        eventType: "extend",
        start: {
          row: minRow,
          col: baseSelection.start.col,
        },
        end: {
          row: maxRow,
          col: baseSelection.end.col,
        },
      };
    }

    const rowDiff = Math.abs(currentCell.row - baseSelection.end.row.value);
    const colDiff = Math.abs(currentCell.col - baseSelection.end.col.value);

    if (rowDiff >= colDiff) {
      if (this.cellInSelection(currentCell, baseSelection)) {
        return {
          type: "fill",
          direction: "up",
          eventType: "shrink",
          start: {
            row: minRow,
            col: baseSelection.start.col,
          },
          end: {
            row: { type: "number", value: currentCell.row },
            col: baseSelection.end.col,
          },
        };
      }
      return {
        type: "fill",
        direction: minRow < baseSelection.start.row ? "up" : "down",
        eventType: "extend",
        start: {
          row: minRow,
          col: baseSelection.start.col,
        },
        end: {
          row: maxRow,
          col: baseSelection.end.col,
        },
      };
    }

    if (this.cellInSelection(currentCell, baseSelection)) {
      return {
        type: "fill",
        direction: "left",
        eventType: "shrink",
        start: {
          row: baseSelection.start.row,
          col: minCol,
        },
        end: {
          row: baseSelection.end.row,
          col: { type: "number", value: currentCell.col },
        },
      };
    }

    return {
      type: "fill",
      direction: minCol < baseSelection.start.col ? "left" : "right",
      eventType: "extend",
      start: {
        row: baseSelection.start.row,
        col: minCol,
      },
      end: {
        row: baseSelection.end.row,
        col: maxCol,
      },
    };
  }

  cellMouseEnter(row: number, col: number) {
    this.willMaybeUpdate();
    if (this.isSelecting.type !== "none") {
      if (this.isSelecting.type === "fill") {
        const fillHandleSelection = this.getFillHandleSelection(
          this.isSelecting.start,
          {
            row,
            col,
          },
        );
        if (fillHandleSelection) {
          this.isSelecting = fillHandleSelection;
        }
      } else {
        this.isSelecting.end = {
          row: { type: "number", value: row },
          col: { type: "number", value: col },
        };
      }
    }
    const group = this.findGroupContainingCell({ row, col });
    if (group) {
      this.isHovering = { type: "group", group };
    } else {
      this.isHovering = { type: "cell", row, col };
    }
    this.onUpdate();
  }

  editCell(row: number, col: number, initialValue?: string) {
    this.willMaybeUpdate();
    const shouldUpdate =
      this.isEditing.type !== "cell" ||
      this.isEditing.row !== row ||
      this.isEditing.col !== col ||
      this.isEditing.initialValue !== initialValue;

    if (shouldUpdate) {
      this.isEditing = {
        type: "cell",
        row,
        col,
        initialValue,
      };
      this.onUpdate();
    }
  }

  cancelEditing() {
    this.willMaybeUpdate();
    if (this.isEditing.type === "cell") {
      this.isEditing = { type: "none" };
      this.onUpdate();
    }
  }

  isEditingCell(row: number, col: number) {
    return (
      this.isEditing.type === "cell" &&
      this.isEditing.row === row &&
      this.isEditing.col === col
    );
  }

  canCellHaveFillHandle(cell: { row: number; col: number }) {
    if (!this.isSelected(cell)) {
      return false;
    }
    if (this.isEditing.type !== "none") {
      return false;
    }

    const baseSelection = this.getFillHandleBaseSelection();
    if (!baseSelection) {
      return false;
    }

    const bottomRight = this.bottomRightOfSelection(baseSelection);
    if (
      bottomRight.row.type === "infinity" ||
      bottomRight.col.type === "infinity"
    ) {
      return false;
    }
    return (
      bottomRight.row.value === cell.row && bottomRight.col.value === cell.col
    );
  }

  bottomRightOfSelection(selection: SMArea) {
    return {
      row: this.max(selection.start.row, selection.end.row),
      col: this.max(selection.start.col, selection.end.col),
    };
  }

  headerMouseDown(
    index: number,
    type: "row" | "col",
    options: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) {
    this.willMaybeUpdate();
    const lastSelection = this.selections[this.selections.length - 1];

    const actualEndRow = this.getActualEndRow();
    const actualEndCol = this.getActualEndCol();

    const cmdKey = options.metaKey || options.ctrlKey;

    const defaultIsSelecting = () => {
      if (type === "row") {
        this.isSelecting = {
          start: { row: index, col: 0 },
          end: { row: { type: "number", value: index }, col: actualEndCol },
          type: "drag",
        };
      } else {
        this.isSelecting = {
          start: { row: 0, col: index },
          end: { row: actualEndRow, col: { type: "number", value: index } },
          type: "drag",
        };
      }
    };
    if (options.shiftKey && lastSelection) {
      this.selections.splice(this.selections.length - 1, 1);
      this.isSelecting = { ...lastSelection, type: "shift" };
      if (type === "row") {
        this.isSelecting.end = {
          row: { type: "number", value: index },
          col: actualEndCol,
        };
      } else {
        this.isSelecting.end = {
          row: actualEndRow,
          col: { type: "number", value: index },
        };
      }
    } else if (cmdKey) {
      let newType: "add" | "remove" = "add";

      if (type === "row") {
        if (this.isWholeRowSelected(index)) {
          newType = "remove";
        }
      } else {
        if (this.isWholeColSelected(index)) {
          newType = "remove";
        }
      }
      defaultIsSelecting();
      this.isSelecting.type = newType;
    } else {
      defaultIsSelecting();
      this.selections.length = 0;
    }
    this.onUpdate();
  }

  headerMouseEnter(index: number, type: "row" | "col") {
    this.willMaybeUpdate();
    const actualEndCol = this.getActualEndCol();
    const actualEndRow = this.getActualEndRow();
    const fillHandleBaseSelection = this.getFillHandleBaseSelection();
    if (this.isSelecting.type !== "none") {
      this.isSelecting.start = fillHandleBaseSelection
        ? fillHandleBaseSelection.start
        : this.isSelecting.start;
      if (type === "row") {
        this.isSelecting.end = {
          row: fillHandleBaseSelection
            ? fillHandleBaseSelection.end.row
            : { type: "number", value: index },
          col: actualEndCol,
        };
      } else {
        this.isSelecting.end = {
          row: actualEndRow,
          col: fillHandleBaseSelection
            ? fillHandleBaseSelection.end.col
            : { type: "number", value: index },
        };
      }
    }
    this.isHovering = { type: "header", index, headerType: type };
    this.onUpdate();
  }

  cancelSelection() {
    this.willMaybeUpdate();
    this.isSelecting = { type: "none" };
    this.onUpdate();
  }

  getActualEndRow(): MaybeInfNumber {
    const numRows = this.getNumRows();
    return numRows.type === "infinity"
      ? { type: "infinity" }
      : { type: "number", value: numRows.value - 1 };
  }
  getActualEndCol(): MaybeInfNumber {
    const numCols = this.getNumCols();
    return numCols.type === "infinity"
      ? { type: "infinity" }
      : { type: "number", value: numCols.value - 1 };
  }

  /**
   * Normalizes a selection end bound to actual table bounds if it's infinite
   */
  private normalizeEndBound(
    endBound: MaybeInfNumber,
    tableSize: MaybeInfNumber,
  ): MaybeInfNumber {
    return endBound.type === "infinity"
      ? tableSize.type === "infinity"
        ? { type: "infinity" }
        : { type: "number", value: tableSize.value - 1 }
      : endBound;
  }

  normalizeSelection(selection: SMArea) {
    return {
      start: {
        row: selection.start.row,
        col: selection.start.col,
      },
      end: {
        row:
          selection.end.row.type === "infinity"
            ? this.getActualEndRow()
            : selection.end.row,
        col:
          selection.end.col.type === "infinity"
            ? this.getActualEndCol()
            : selection.end.col,
      },
    };
  }

  min(a: number, b: MaybeInfNumber): number {
    return b.type === "infinity" ? a : Math.min(a, b.value);
  }
  max(a: number, b: MaybeInfNumber): MaybeInfNumber {
    return b.type === "infinity"
      ? { type: "infinity" }
      : { type: "number", value: Math.max(a, b.value) };
  }

  minMaybeInf(a: MaybeInfNumber, b: MaybeInfNumber): MaybeInfNumber {
    if (a.type === "infinity" && b.type === "infinity") {
      return a;
    }
    if (b.type === "infinity") {
      return a;
    }
    if (a.type === "infinity") {
      return b;
    }
    return { type: "number", value: Math.min(a.value, b.value) };
  }

  maxMaybeInf(a: MaybeInfNumber, b: MaybeInfNumber): MaybeInfNumber {
    return a.type === "infinity"
      ? a
      : b.type === "infinity"
        ? b
        : { type: "number", value: Math.max(a.value, b.value) };
  }

  /**
   * a === b
   */
  equals(a: MaybeInfNumber, b: MaybeInfNumber): boolean {
    if (a.type !== b.type) {
      return false;
    }
    if (a.type === "number" && b.type === "number") {
      return a.value === b.value;
    }
    return true;
  }

  /**
   * a < b
   */
  lt(a: MaybeInfNumber, b: MaybeInfNumber): boolean {
    if (a.type === "infinity") {
      return false;
    }
    if (b.type === "infinity") {
      return true;
    }
    return a.value < b.value;
  }

  lte(a: MaybeInfNumber, b: MaybeInfNumber): boolean {
    return this.lt(a, b) || this.equals(a, b);
  }
  gte(a: MaybeInfNumber, b: MaybeInfNumber): boolean {
    return this.gt(a, b) || this.equals(a, b);
  }

  /**
   * a > b
   */
  gt(a: MaybeInfNumber, b: MaybeInfNumber): boolean {
    return !this.equals(a, b) && !this.lt(a, b);
  }

  cellInSelection(
    cell: { row: number; col: number },
    selection: SMArea,
  ): boolean {
    const { start, end } = selection;
    const startRow = this.min(start.row, end.row);
    const startCol = this.min(start.col, end.col);
    const endRow = this.max(start.row, end.row);
    const endCol = this.max(start.col, end.col);

    const numRows = this.getNumRows();
    const numCols = this.getNumCols();

    // Handle infinite selections by normalizing to actual table bounds
    const actualEndRow = this.normalizeEndBound(endRow, numRows);
    const actualEndCol = this.normalizeEndBound(endCol, numCols);

    return (
      cell.row >= startRow &&
      (actualEndRow.type === "infinity" || cell.row <= actualEndRow.value) &&
      cell.col >= startCol &&
      (actualEndCol.type === "infinity" || cell.col <= actualEndCol.value)
    );
  }

  deselectArea(areaToDeselect: SMArea) {
    const newSelections: SMArea[] = [];

    this.selections.forEach((selection) => {
      // Check if this selection overlaps with the area to deselect
      if (this.selectionsOverlap(selection, areaToDeselect)) {
        // Split this selection around the deselected area
        const remainingParts = this.subtractSelection(
          selection,
          areaToDeselect,
        );
        newSelections.push(...remainingParts);
      } else {
        // This selection doesn't overlap, keep it as is
        newSelections.push(selection);
      }
    });

    this.selections = newSelections;
  }

  private selectionsOverlap(a: SMArea, b: SMArea): boolean {
    const aMinRow = this.min(a.start.row, a.end.row);
    const aMaxRow = this.max(a.start.row, a.end.row);
    const aMinCol = this.min(a.start.col, a.end.col);
    const aMaxCol = this.max(a.start.col, a.end.col);

    const bMinRow = this.min(b.start.row, b.end.row);
    const bMaxRow = this.max(b.start.row, b.end.row);
    const bMinCol = this.min(b.start.col, b.end.col);
    const bMaxCol = this.max(b.start.col, b.end.col);

    return !(
      this.lt(aMaxRow, { type: "number", value: bMinRow }) ||
      this.gt({ type: "number", value: aMinRow }, bMaxRow) ||
      this.lt(aMaxCol, { type: "number", value: bMinCol }) ||
      this.gt({ type: "number", value: aMinCol }, bMaxCol)
    );
  }

  private subtractSelection(original: SMArea, toRemove: SMArea): SMArea[] {
    const origMinRow = this.min(original.start.row, original.end.row);
    const origMaxRow = this.max(original.start.row, original.end.row);
    const origMinCol = this.min(original.start.col, original.end.col);
    const origMaxCol = this.max(original.start.col, original.end.col);

    const removeMinRow = this.min(toRemove.start.row, toRemove.end.row);
    const removeMaxRow = this.max(toRemove.start.row, toRemove.end.row);
    const removeMinCol = this.min(toRemove.start.col, toRemove.end.col);
    const removeMaxCol = this.max(toRemove.start.col, toRemove.end.col);

    const remaining: SMArea[] = [];

    // Top rectangle (above the removed area)
    if (origMinRow < removeMinRow) {
      remaining.push({
        start: { row: origMinRow, col: origMinCol },
        end: {
          row: {
            type: "number",
            value: this.min(removeMinRow - 1, origMaxRow),
          },
          col: origMaxCol,
        },
      });
    }

    // Bottom rectangle (below the removed area)
    if (this.gt(origMaxRow, removeMaxRow)) {
      if (removeMaxRow.type === "infinity") {
        throw new Error("Should not be possible to remove an infinite area");
      }
      remaining.push({
        start: {
          row: Math.max(origMinRow, removeMaxRow.value + 1),
          col: origMinCol,
        },
        end: { row: origMaxRow, col: origMaxCol },
      });
    }

    // Left rectangle (to the left of the removed area, within the vertical bounds of overlap)
    if (origMinCol < removeMinCol) {
      const topRow = Math.max(origMinRow, removeMinRow);
      const bottomRow = this.minMaybeInf(origMaxRow, removeMaxRow);
      if (this.lte({ type: "number", value: topRow }, bottomRow)) {
        remaining.push({
          start: { row: topRow, col: origMinCol },
          end: {
            row: bottomRow,
            col: {
              type: "number",
              value: this.min(removeMinCol - 1, origMaxCol),
            },
          },
        });
      }
    }

    // Right rectangle (to the right of the removed area, within the vertical bounds of overlap)
    if (this.gt(origMaxCol, removeMaxCol)) {
      const topRow = Math.max(origMinRow, removeMinRow);
      const bottomRow = this.minMaybeInf(origMaxRow, removeMaxRow);
      if (this.lte({ type: "number", value: topRow }, bottomRow)) {
        if (removeMaxCol.type === "infinity") {
          throw new Error("Should not be possible to remove an infinite area");
        }
        remaining.push({
          start: {
            row: topRow,
            col: Math.max(origMinCol, removeMaxCol.value + 1),
          },
          end: { row: bottomRow, col: origMaxCol },
        });
      }
    }

    return remaining;
  }

  isSelected(cell: { row: number; col: number }) {
    const { row, col } = cell;

    const numRows = this.getNumRows();
    const numCols = this.getNumCols();

    if (
      row < 0 ||
      col < 0 ||
      (numRows.type !== "infinity" && row >= numRows.value) ||
      (numCols.type !== "infinity" && col >= numCols.value)
    ) {
      return false;
    }

    return this.selections.some((selection) =>
      this.cellInSelection(cell, selection),
    );
  }

  isAllSelected() {
    if (this.selections.length === 0) {
      return false;
    }

    const numRows = this.getNumRows();
    const numCols = this.getNumCols();

    // For infinite tables, check if there's a selection covering (0,0) to (Infinity, Infinity)
    if (numRows.type === "infinity" || numCols.type === "infinity") {
      return this.selections.some((selection) => {
        const startRow = this.min(selection.start.row, selection.end.row);
        const endRow = this.max(selection.start.row, selection.end.row);
        const startCol = this.min(selection.start.col, selection.end.col);
        const endCol = this.max(selection.start.col, selection.end.col);

        return (
          startRow === 0 &&
          startCol === 0 &&
          endRow.type === "infinity" &&
          endCol.type === "infinity"
        );
      });
    }

    // For finite tables, normalize selections and handle infinity values
    const normalizedSelections = this.selections.map((selection) => {
      const startRow = this.min(selection.start.row, selection.end.row);
      const endRow = this.max(selection.start.row, selection.end.row);
      const startCol = this.min(selection.start.col, selection.end.col);
      const endCol = this.max(selection.start.col, selection.end.col);

      return {
        startRow,
        endRow: endRow.type === "infinity" ? numRows.value - 1 : endRow.value,
        startCol,
        endCol: endCol.type === "infinity" ? numCols.value - 1 : endCol.value,
      };
    });

    // Quick check: if any single selection covers the entire table
    for (const sel of normalizedSelections) {
      if (
        sel.startRow === 0 &&
        sel.startCol === 0 &&
        sel.endRow === numRows.value - 1 &&
        sel.endCol === numCols.value - 1
      ) {
        return true;
      }
    }

    // Use coordinate compression to check if union covers entire table
    const rowBoundaries = new Set<number>([0, numRows.value]);
    const colBoundaries = new Set<number>([0, numCols.value]);

    normalizedSelections.forEach((sel) => {
      rowBoundaries.add(sel.startRow);
      rowBoundaries.add(sel.endRow + 1); // +1 for exclusive end boundary
      colBoundaries.add(sel.startCol);
      colBoundaries.add(sel.endCol + 1); // +1 for exclusive end boundary
    });

    const sortedRows = Array.from(rowBoundaries).sort((a, b) => a - b);
    const sortedCols = Array.from(colBoundaries).sort((a, b) => a - b);

    // Check if every rectangular region within the table bounds is covered
    for (let i = 0; i < sortedRows.length - 1; i++) {
      for (let j = 0; j < sortedCols.length - 1; j++) {
        const regionStartRow = sortedRows[i]!;
        const regionEndRow = sortedRows[i + 1]! - 1; // Convert back to inclusive
        const regionStartCol = sortedCols[j]!;
        const regionEndCol = sortedCols[j + 1]! - 1; // Convert back to inclusive

        // Skip regions outside the table bounds
        if (
          regionStartRow >= numRows.value ||
          regionStartCol >= numCols.value
        ) {
          continue;
        }

        // Clip region to table bounds
        const clippedEndRow = Math.min(regionEndRow, numRows.value - 1);
        const clippedEndCol = Math.min(regionEndCol, numCols.value - 1);

        // Check if this region is covered by any normalized selection
        const isCovered = normalizedSelections.some((sel) => {
          return (
            sel.startRow <= regionStartRow &&
            sel.endRow >= clippedEndRow &&
            sel.startCol <= regionStartCol &&
            sel.endCol >= clippedEndCol
          );
        });

        if (!isCovered) {
          return false;
        }
      }
    }

    return true;
  }

  selectionBorders(cell: { row: number; col: number }): Border[] {
    const { row, col } = cell;
    const borders: Border[] = [];
    if (!this.isSelected(cell)) {
      return borders;
    }

    const numRows = this.getNumRows();
    const numCols = this.getNumCols();

    const surroundingCells = [
      [{ row: row - 1, col }, "top"],
      [{ row: row + 1, col }, "bottom"],
      [{ row, col: col - 1 }, "left"],
      [{ row, col: col + 1 }, "right"],
    ] as const;

    surroundingCells.forEach(([surroundingCell, border]) => {
      // Check if surrounding cell is out of bounds or not selected
      const { row: sRow, col: sCol } = surroundingCell;
      const outOfBounds =
        sRow < 0 ||
        sCol < 0 ||
        (numRows.type !== "infinity" && sRow >= numRows.value) ||
        (numCols.type !== "infinity" && sCol >= numCols.value);

      if (outOfBounds || !this.isSelected(surroundingCell)) {
        borders.push(border);
      }
    });

    return borders;
  }

  inNegativeSelection(cell: { row: number; col: number }) {
    const isSelecting = this.isSelecting;
    if (isSelecting.type === "none") {
      return false;
    }
    return (
      isSelecting.type === "remove" && this.cellInSelection(cell, isSelecting)
    );
  }

  getFillHandleBaseSelection(): SMArea | undefined {
    if (this.selections.length === 0) {
      return undefined;
    }

    // Bounding rectangle that would be the candidate rectangular union
    const bounding = this.getSelectionsBoundingRect();
    if (!bounding) {
      return undefined;
    }

    // Normalize selections similar to isAllSelected/getNonOverlappingSelections
    // so Infinity ends are mapped to table bounds (which can themselves be Infinity)
    const numRows = this.getNumRows();
    const numCols = this.getNumCols();

    type Normalized = {
      startRow: number;
      endRow: MaybeInfNumber;
      startCol: number;
      endCol: MaybeInfNumber;
    };

    const normalizedSelections: Normalized[] = this.selections.map(
      (selection): Normalized => {
        const startRow = this.min(selection.start.row, selection.end.row);
        const endRow = this.max(selection.start.row, selection.end.row);
        const startCol = this.min(selection.start.col, selection.end.col);
        const endCol = this.max(selection.start.col, selection.end.col);

        return {
          startRow,
          endRow:
            endRow.type === "infinity"
              ? numRows.type === "infinity"
                ? { type: "infinity" }
                : { type: "number", value: numRows.value - 1 }
              : endRow,
          startCol,
          endCol:
            endCol.type === "infinity"
              ? numCols.type === "infinity"
                ? { type: "infinity" }
                : { type: "number", value: numCols.value - 1 }
              : endCol,
        };
      },
    );

    // Quick accept: if any single normalized selection already equals the bounding rectangle
    const boundingStartRow = this.min(bounding.start.row, bounding.end.row);
    const boundingEndRow = this.max(bounding.start.row, bounding.end.row);
    const boundingStartCol = this.min(bounding.start.col, bounding.end.col);
    const boundingEndCol = this.max(bounding.start.col, bounding.end.col);

    for (const sel of normalizedSelections) {
      if (
        sel.startRow === boundingStartRow &&
        sel.endRow === boundingEndRow &&
        sel.startCol === boundingStartCol &&
        sel.endCol === boundingEndCol
      ) {
        return {
          start: { row: boundingStartRow, col: boundingStartCol },
          end: { row: boundingEndRow, col: boundingEndCol },
        };
      }
    }

    // Coordinate compression within the bounding rectangle.
    const rowBoundaries = new Set<number | "INF">();
    const colBoundaries = new Set<number | "INF">();

    // Always include bounding rectangle limits (using +1 exclusive boundary)
    rowBoundaries.add(boundingStartRow);
    rowBoundaries.add(
      boundingEndRow.type === "infinity" ? "INF" : boundingEndRow.value + 1,
    );
    colBoundaries.add(boundingStartCol);
    colBoundaries.add(
      boundingEndCol.type === "infinity" ? "INF" : boundingEndCol.value + 1,
    );

    // Include every selection edge
    normalizedSelections.forEach((sel) => {
      rowBoundaries.add(sel.startRow);
      rowBoundaries.add(
        sel.endRow.type === "infinity" ? "INF" : sel.endRow.value + 1,
      );
      colBoundaries.add(sel.startCol);
      colBoundaries.add(
        sel.endCol.type === "infinity" ? "INF" : sel.endCol.value + 1,
      );
    });

    const sortedRows = Array.from(rowBoundaries).sort(sort);
    const sortedCols = Array.from(colBoundaries).sort(sort);

    // For every region fully inside the bounding rectangle, ensure it is covered
    for (let i = 0; i < sortedRows.length - 1; i++) {
      const startRow = sortedRows[i]!;
      const regionStartRow: MaybeInfNumber =
        typeof startRow === "number"
          ? { type: "number", value: startRow }
          : { type: "infinity" };

      const endRow = sortedRows[i + 1]!;
      const regionEndRow: MaybeInfNumber =
        typeof endRow === "number"
          ? { type: "number", value: endRow - 1 }
          : { type: "infinity" };

      // Skip regions outside the bounding rectangle vertically
      if (this.lt(regionEndRow, { type: "number", value: boundingStartRow })) {
        continue;
      }

      if (
        boundingEndRow.type !== "infinity" &&
        this.gt(regionStartRow, boundingEndRow)
      ) {
        continue;
      }

      for (let j = 0; j < sortedCols.length - 1; j++) {
        const startCol = sortedCols[j]!;
        const endCol = sortedCols[j + 1]!;

        const regionStartCol: MaybeInfNumber =
          typeof startCol === "number"
            ? { type: "number", value: startCol }
            : { type: "infinity" };
        const regionEndCol: MaybeInfNumber =
          typeof endCol === "number"
            ? { type: "number", value: endCol - 1 }
            : { type: "infinity" };

        // Skip regions outside the bounding rectangle horizontally
        if (
          this.lt(regionEndCol, {
            type: "number",
            value: boundingStartCol,
          })
        ) {
          continue;
        }
        if (
          boundingEndCol.type !== "infinity" &&
          this.gt(regionStartCol, boundingEndCol)
        ) {
          continue;
        }

        // Clip region to bounding rectangle limits (important for Infinity ends)
        const clippedEndRow: MaybeInfNumber =
          boundingEndRow.type === "infinity"
            ? regionEndRow
            : {
                type: "number",
                value: this.min(boundingEndRow.value, regionEndRow),
              };
        const clippedEndCol: MaybeInfNumber =
          boundingEndCol.type === "infinity"
            ? regionEndCol
            : {
                type: "number",
                value: this.min(boundingEndCol.value, regionEndCol),
              };

        const clippedStartRow = this.max(boundingStartRow, regionStartRow);
        const clippedStartCol = this.max(boundingStartCol, regionStartCol);

        // Ensure the clipped region is covered by at least one selection
        const isCovered = normalizedSelections.some((sel) => {
          return (
            this.lte(
              { type: "number", value: sel.startRow },
              clippedStartRow,
            ) &&
            (sel.endRow.type === "infinity" ||
              this.gte(sel.endRow, clippedEndRow)) &&
            this.lte(
              { type: "number", value: sel.startCol },
              clippedStartCol,
            ) &&
            (sel.endCol.type === "infinity" ||
              this.gte(sel.endCol, clippedEndCol))
          );
        });

        if (!isCovered) {
          return undefined;
        }
      }
    }

    // All regions within bounding rectangle are covered → union is rectangular
    return {
      start: { row: boundingStartRow, col: boundingStartCol },
      end: { row: boundingEndRow, col: boundingEndCol },
    };
  }

  currentSelectionBorders(cell: { row: number; col: number }): Border[] {
    const borders: Border[] = [];
    const selection = this.isSelecting;
    if (selection.type !== "none" && this.cellInSelection(cell, selection)) {
      const minRow = this.min(selection.start.row, selection.end.row);
      const maxRow = this.max(selection.start.row, selection.end.row);
      const minCol = this.min(selection.start.col, selection.end.col);
      const maxCol = this.max(selection.start.col, selection.end.col);

      const numRows = this.getNumRows();
      const numCols = this.getNumCols();

      // Handle infinite selections by normalizing to actual table bounds
      const actualMaxRow = this.normalizeEndBound(maxRow, numRows);
      const actualMaxCol = this.normalizeEndBound(maxCol, numCols);

      if (cell.row === minRow) {
        borders.push("top");
      }
      if (actualMaxRow.type !== "infinity" && cell.row === actualMaxRow.value) {
        borders.push("bottom");
      }
      if (cell.col === minCol) {
        borders.push("left");
      }
      if (actualMaxCol.type !== "infinity" && cell.col === actualMaxCol.value) {
        borders.push("right");
      }
    }
    return borders;
  }

  getCellBoxShadow(cell: { row: number; col: number }): string | undefined {
    const selectionBorders = this.selectionBorders(cell);
    const currentSelectionBorders = this.currentSelectionBorders(cell);

    const selectionShadows: string[] = [];

    currentSelectionBorders.forEach((border) => {
      let color = "#c5b4b3";
      if (this.isSelecting.type === "fill") {
        color = "red";
      }
      switch (border) {
        case "top":
          if (
            cell.row !== 0 ||
            !this.currentSelectionCoversWholeIndex(cell.col, "col")
          ) {
            selectionShadows.push(`inset 0 2px 0 0 ${color}`);
          }
          break;
        case "right":
          selectionShadows.push(`inset -2px 0 0 0 ${color}`);
          break;
        case "bottom":
          selectionShadows.push(`inset 0 -2px 0 0 ${color}`);
          break;
        case "left":
          if (
            cell.col !== 0 ||
            !this.currentSelectionCoversWholeIndex(cell.row, "row")
          ) {
            selectionShadows.push(`inset 2px 0 0 0 ${color}`);
          }
          break;
      }
    });

    selectionBorders.forEach((border) => {
      switch (border) {
        case "top":
          if (cell.row !== 0 || !this.isWholeColSelected(cell.col)) {
            selectionShadows.push(`inset 0 2px 0 0 #2196F3`);
          }
          break;
        case "right":
          selectionShadows.push(`inset -2px 0 0 0 #2196F3`);
          break;
        case "bottom":
          selectionShadows.push(`inset 0 -2px 0 0 #2196F3`);
          break;
        case "left":
          if (cell.col !== 0 || !this.isWholeRowSelected(cell.row)) {
            selectionShadows.push(`inset 2px 0 0 0 #2196F3`);
          }
          break;
      }
    });

    if (
      this.isHovering.type === "cell" &&
      this.isHovering.row === cell.row &&
      this.isHovering.col === cell.col
    ) {
      if (!this.isCellInDragArea(cell)) {
        selectionShadows.push(
          `inset 0 2px 0 0 #9ec299`, // top
          `inset -2px 0 0 0 #9ec299`, // left
          `inset 2px 0 0 0 #9ec299`, // right
          `inset 0 -2px 0 0 #9ec299`, // bottom
        );
      }
    }

    const selectionBoxShadow =
      selectionShadows.length > 0 ? selectionShadows.join(", ") : undefined;
    return selectionBoxShadow;
  }

  getBoxShadow(options?: {
    color?: string;
    position?: ("top" | "right" | "bottom" | "left" | "all")[];
  }) {
    const color = options?.color ?? "#9ec299";
    const positions = options?.position ?? ["all"];
    const shadows: string[] = [];
    if (positions.includes("all") || positions.includes("top")) {
      shadows.push(`inset 0 2px 0 0 ${color}`);
    }
    if (positions.includes("all") || positions.includes("right")) {
      shadows.push(`inset -2px 0 0 0 ${color}`);
    }
    if (positions.includes("all") || positions.includes("bottom")) {
      shadows.push(`inset 0 -2px 0 0 ${color}`);
    }
    if (positions.includes("all") || positions.includes("left")) {
      shadows.push(`inset 2px 0 0 0 ${color}`);
    }
    return shadows.join(", ");
  }

  isHoveringGroup(group: SMArea) {
    return (
      this.isHovering.type === "group" &&
      this.isHovering.group.start.row >= group.start.row &&
      this.isHovering.group.end.row <= group.end.row &&
      this.isHovering.group.start.col >= group.start.col &&
      this.isHovering.group.end.col <= group.end.col
    );
  }

  private getIntervalsForIndex(
    index: number,
    type: "row" | "col",
  ): Array<{ start: number; end: MaybeInfNumber }> {
    const intervals: Array<{ start: number; end: MaybeInfNumber }> = [];

    for (const selection of this.selections) {
      const startRow = this.min(selection.start.row, selection.end.row);
      const endRow = this.max(selection.start.row, selection.end.row);
      const startCol = this.min(selection.start.col, selection.end.col);
      const endCol = this.max(selection.start.col, selection.end.col);

      // Apply the same logic as cellInSelection for handling infinity
      const normalizedEndRow = this.normalizeEndBound(
        endRow,
        this.getNumRows(),
      );
      const normalizedEndCol = this.normalizeEndBound(
        endCol,
        this.getNumCols(),
      );

      if (type === "row") {
        // Check if this selection covers the row
        if (
          startRow <= index &&
          (normalizedEndRow.type === "infinity" ||
            index <= normalizedEndRow.value)
        ) {
          intervals.push({ start: startCol, end: normalizedEndCol });
        }
      } else {
        // Check if this selection covers the column
        if (
          startCol <= index &&
          (normalizedEndCol.type === "infinity" ||
            index <= normalizedEndCol.value)
        ) {
          intervals.push({ start: startRow, end: normalizedEndRow });
        }
      }
    }

    return intervals;
  }

  private mergeIntervals(
    intervals: Array<{ start: number; end: MaybeInfNumber }>,
  ): Array<{ start: number; end: MaybeInfNumber }> {
    if (intervals.length === 0) {
      return [];
    }

    // Sort intervals by start position
    intervals.sort((a, b) => a.start - b.start);

    // Merge overlapping intervals
    const merged: Array<{ start: number; end: MaybeInfNumber }> = [
      intervals[0]!,
    ];

    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i]!;
      const last = merged[merged.length - 1]!;

      if (last.end.type === "infinity" || current.start <= last.end.value + 1) {
        // Overlapping or adjacent intervals, merge them
        last.end = this.maxMaybeInf(current.end, last.end);
      } else {
        // Non-overlapping interval, add it
        merged.push(current);
      }
    }

    return merged;
  }

  private intervalsSpanFullRange(
    intervals: Array<{ start: number; end: MaybeInfNumber }>,
    maxValue: MaybeInfNumber,
  ): boolean {
    if (intervals.length !== 1) {
      return false;
    }

    const interval = intervals[0]!;

    if (maxValue.type === "infinity") {
      // For infinite range, we need coverage from 0 to Infinity
      return interval.start === 0 && interval.end.type === "infinity";
    } else {
      // For finite range, we need coverage from 0 to maxValue-1
      const maxValueMinusOne: RealNumber = {
        type: "number",
        value: maxValue.value - 1,
      };
      return interval.start === 0 && this.gte(interval.end, maxValueMinusOne);
    }
  }

  isWholeRowSelected(index: number) {
    const intervals = this.getIntervalsForIndex(index, "row");
    const merged = this.mergeIntervals(intervals);
    return this.intervalsSpanFullRange(merged, this.getNumCols());
  }

  isWholeColSelected(index: number) {
    const intervals = this.getIntervalsForIndex(index, "col");
    const merged = this.mergeIntervals(intervals);
    return this.intervalsSpanFullRange(merged, this.getNumRows());
  }

  private currentSelectionIntersectsIndex(
    index: number,
    type: "row" | "col",
  ): boolean {
    if (this.isSelecting.type === "none") {
      return false;
    }

    const selection = this.isSelecting;
    const startRow = this.min(selection.start.row, selection.end.row);
    const endRow = this.max(selection.start.row, selection.end.row);
    const startCol = this.min(selection.start.col, selection.end.col);
    const endCol = this.max(selection.start.col, selection.end.col);

    // Apply the same logic as cellInSelection for handling infinity
    const normalizedEndRow = this.normalizeEndBound(endRow, this.getNumRows());
    const normalizedEndCol = this.normalizeEndBound(endCol, this.getNumCols());

    if (type === "row") {
      // Check if the current selection intersects with this row
      return (
        startRow <= index &&
        (normalizedEndRow.type === "infinity" ||
          index <= normalizedEndRow.value)
      );
    } else {
      // Check if the current selection intersects with this column
      return (
        startCol <= index &&
        (normalizedEndCol.type === "infinity" ||
          index <= normalizedEndCol.value)
      );
    }
  }

  getHeaderBoxShadow(index: number, type: "row" | "col"): string | undefined {
    /**
     * to be implemented
     */
    const isSelected =
      type === "row"
        ? this.isWholeRowSelected(index)
        : this.isWholeColSelected(index);

    const selectionShadows: string[] = [];
    if (isSelected) {
      // merge the selection with the cell box shadow
      if (type === "row") {
        selectionShadows.push(`inset 2px 0 0 0 #2196F3`); // border left
        if (!this.isWholeRowSelected(index - 1)) {
          selectionShadows.push(`inset 0 2px 0 0 #2196F3`); // border top
        }
        if (!this.isWholeRowSelected(index + 1)) {
          selectionShadows.push(`inset 0 -2px 0 0 #2196F3`); // border bottom
        }
      } else {
        selectionShadows.push(`inset 0 2px 0 0 #2196F3`); // border top
        if (!this.isWholeColSelected(index - 1)) {
          selectionShadows.push(`inset 2px 0 0 0 #2196F3`); // border left
        }
        if (!this.isWholeColSelected(index + 1)) {
          selectionShadows.push(`inset -2px 0 0 0 #2196F3`); // border right
        }
      }
    }

    if (this.currentSelectionCoversWholeIndex(index, type)) {
      // when selecting a whole row/col, show border around the union like blue borders
      if (type === "row") {
        selectionShadows.push(`inset 2px 0 0 0 #c5b4b3`); // border left
        if (!this.currentSelectionCoversWholeIndex(index - 1, "row")) {
          selectionShadows.push(`inset 0 2px 0 0 #c5b4b3`); // border top
        }
        if (!this.currentSelectionCoversWholeIndex(index + 1, "row")) {
          selectionShadows.push(`inset 0 -2px 0 0 #c5b4b3`); // border bottom
        }
      } else {
        selectionShadows.push(`inset 0 2px 0 0 #c5b4b3`); // border top
        if (!this.currentSelectionCoversWholeIndex(index - 1, "col")) {
          selectionShadows.push(`inset 2px 0 0 0 #c5b4b3`); // border left
        }
        if (!this.currentSelectionCoversWholeIndex(index + 1, "col")) {
          selectionShadows.push(`inset -2px 0 0 0 #c5b4b3`); // border right
        }
      }
    } else if (this.currentSelectionIntersectsIndex(index, type)) {
      // when a row or col is "active", we are just highlighting with a small border
      if (type === "row") {
        selectionShadows.push(`inset -2px 0 0 0 #9ec299`); // border right
      } else {
        selectionShadows.push(`inset 0 -2px 0 0 #9ec299`); // border bottom
      }
    }

    if (
      (this.isHovering.type === "cell" &&
        (type === "row"
          ? this.isHovering.row === index
          : this.isHovering.col === index)) ||
      (this.isHovering.type === "header" &&
        this.isHovering.headerType === type &&
        this.isHovering.index === index)
    ) {
      if (type === "row") {
        selectionShadows.push(`inset -2px 0 0 0 #9ec299`); // border right
      } else {
        selectionShadows.push(`inset 0 -2px 0 0 #9ec299`); // border bottom
      }
    } else if (
      this.isHovering.type === "header" &&
      this.isHovering.headerType !== type
    ) {
      if (type === "row") {
        selectionShadows.push(`inset -2px 0 0 0 #9ec299`); // border right
      } else {
        selectionShadows.push(`inset 0 -2px 0 0 #9ec299`); // border bottom
      }
    } else if (this.isHovering.type === "group") {
      if (type === "row") {
        const endRow = this.isHovering.group.end.row;
        if (
          index >= this.isHovering.group.start.row &&
          (endRow.type === "infinity" || index <= endRow.value)
        ) {
          selectionShadows.push(`inset -2px 0 0 0 #9ec299`); // border right
        }
      } else {
        const endCol = this.isHovering.group.end.col;
        if (
          index >= this.isHovering.group.start.col &&
          (endCol.type === "infinity" || index <= endCol.value)
        ) {
          selectionShadows.push(`inset 0 -2px 0 0 #9ec299`); // border bottom
        }
      }
    }

    const selectionBoxShadow =
      selectionShadows.length > 0 ? selectionShadows.join(", ") : undefined;
    return selectionBoxShadow;
  }

  getTopLeftCellInSelection(): { row: number; col: number } | undefined {
    if (this.selections.length === 0) {
      return undefined;
    }
    let minCell: { row: number; col: number } | undefined;
    const evaluateCell = (cell: {
      row: MaybeInfNumber;
      col: MaybeInfNumber;
    }) => {
      if (cell.row.type === "infinity" || cell.col.type === "infinity") {
        return;
      }
      if (!minCell) {
        minCell = { row: cell.row.value, col: cell.col.value };
        return;
      }
      if (cell.col.value < minCell.col) {
        minCell = { row: cell.row.value, col: cell.col.value };
      } else if (
        cell.col.value === minCell.col &&
        cell.row.value < minCell.row
      ) {
        minCell = { row: cell.row.value, col: cell.col.value };
      }
    };
    this.selections.forEach((selection) => {
      evaluateCell({
        row: { type: "number", value: selection.start.row },
        col: { type: "number", value: selection.start.col },
      });
      evaluateCell(selection.end);
    });
    return minCell;
  }

  /**
   * Returns the bounding rectangle that encompasses all current selections.
   * @returns SMSelection representing the bounding rectangle, or undefined if no selections exist
   */
  getSelectionsBoundingRect(): SMArea | undefined {
    if (this.selections.length === 0) {
      return undefined;
    }

    let minRow: number = Infinity;
    let maxRow: MaybeInfNumber = { type: "number", value: 0 };
    let minCol: number = Infinity;
    let maxCol: MaybeInfNumber = { type: "number", value: 0 };

    this.selections.forEach((selection) => {
      const startRow = this.min(selection.start.row, selection.end.row);
      const endRow = this.max(selection.start.row, selection.end.row);
      const startCol = this.min(selection.start.col, selection.end.col);
      const endCol = this.max(selection.start.col, selection.end.col);

      // Handle infinite selections by normalizing to actual table bounds
      const normalizedEndRow = this.normalizeEndBound(
        endRow,
        this.getNumRows(),
      );
      const normalizedEndCol = this.normalizeEndBound(
        endCol,
        this.getNumCols(),
      );

      minRow = Math.min(startRow, minRow);
      maxRow = this.maxMaybeInf(normalizedEndRow, maxRow);
      minCol = Math.min(startCol, minCol);
      maxCol = this.maxMaybeInf(normalizedEndCol, maxCol);
    });

    if (minRow === Infinity || minCol === Infinity) {
      return undefined;
    }

    return {
      start: { row: minRow, col: minCol },
      end: { row: maxRow, col: maxCol },
    };
  }

  /**
   * Returns a list of non-overlapping selections that cover the same cells as the current selections.
   * Uses coordinate compression to decompose overlapping rectangles.
   * @returns Array of SMSelection representing non-overlapping selections
   */
  getNonOverlappingSelections(): SMArea[] {
    if (this.selections.length === 0) {
      return [];
    }

    // Normalize all selections and handle infinite values
    const normalizedSelections = this.selections.map((selection) => {
      const startRow = this.min(selection.start.row, selection.end.row);
      const endRow = this.max(selection.start.row, selection.end.row);
      const startCol = this.min(selection.start.col, selection.end.col);
      const endCol = this.max(selection.start.col, selection.end.col);

      return {
        startRow,
        endRow: endRow.type === "infinity" ? this.getActualEndRow() : endRow,
        startCol,
        endCol: endCol.type === "infinity" ? this.getActualEndCol() : endCol,
      };
    });

    // Collect all unique row and column boundaries
    const rowBoundaries = new Set<number | "INF">();
    const colBoundaries = new Set<number | "INF">();

    normalizedSelections.forEach((sel) => {
      rowBoundaries.add(sel.startRow);
      rowBoundaries.add(
        sel.endRow.type === "infinity" ? "INF" : sel.endRow.value + 1,
      ); // +1 for exclusive end boundary
      colBoundaries.add(sel.startCol);
      colBoundaries.add(
        sel.endCol.type === "infinity" ? "INF" : sel.endCol.value + 1,
      ); // +1 for exclusive end boundary
    });

    const sortedRows = Array.from(rowBoundaries).sort(sort);
    const sortedCols = Array.from(colBoundaries).sort(sort);

    const result: SMArea[] = [];

    // For each rectangular region between boundaries
    for (let i = 0; i < sortedRows.length - 1; i++) {
      for (let j = 0; j < sortedCols.length - 1; j++) {
        const startRow = sortedRows[i]!;
        const endRow = sortedRows[i + 1]!;
        const startCol = sortedCols[j]!;
        const endCol = sortedCols[j + 1]!;

        const regionStartRow: MaybeInfNumber =
          typeof startRow === "number"
            ? { type: "number", value: startRow }
            : { type: "infinity" };
        const regionEndRow: MaybeInfNumber =
          typeof endRow === "number"
            ? { type: "number", value: endRow - 1 }
            : { type: "infinity" };
        const regionStartCol: MaybeInfNumber =
          typeof startCol === "number"
            ? { type: "number", value: startCol }
            : { type: "infinity" };
        const regionEndCol: MaybeInfNumber =
          typeof endCol === "number"
            ? { type: "number", value: endCol - 1 }
            : { type: "infinity" };

        // Check if any original selection covers this region
        const isCovered = normalizedSelections.some((sel) => {
          return (
            this.lte({ type: "number", value: sel.startRow }, regionStartRow) &&
            this.gte(sel.endRow, regionEndRow) &&
            this.lte({ type: "number", value: sel.startCol }, regionStartCol) &&
            this.gte(sel.endCol, regionEndCol)
          );
        });

        if (isCovered) {
          if (regionStartRow.type === "infinity") {
            throw new Error("Invalid regionStartRow");
          }
          if (regionStartCol.type === "infinity") {
            throw new Error("Invalid regionStartCol");
          }
          result.push({
            start: { row: regionStartRow.value, col: regionStartCol.value },
            end: { row: regionEndRow, col: regionEndCol },
          });
        }
      }
    }

    return result;
  }

  handleKeyDown(event: KeyboardEvent) {
    this.willMaybeUpdate();
    // handle escape key
    if (event.key === "Escape") {
      if (this.isEditing.type === "cell") {
        this.cancelEditing();
        return;
      }

      const current = {
        isSelecting: this.isSelecting,
        selections: this.selections,
        isEditing: this.isEditing,
      };
      this.isSelecting = { type: "none" };
      this.selections = [];
      this.isEditing = { type: "none" };

      let shouldUpdate = false;

      if (current.isSelecting.type !== "none") {
        shouldUpdate = true;
      }

      if (current.selections.length > 0) {
        shouldUpdate = true;
      }

      if (current.isEditing.type !== "none") {
        shouldUpdate = true;
      }

      if (this.hasFocus) {
        this.hasFocus = false;
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        this.onUpdate();
      }
      return;
    }

    if (this.isEditing.type === "cell") {
      return;
    }

    // handle copy (Ctrl+C/Cmd+C) and cut (Ctrl+X/Cmd+X)
    if (
      (event.metaKey || event.ctrlKey) &&
      (event.key === "c" || event.key === "C")
    ) {
      if (this.hasSelection()) {
        event.preventDefault();
        this.listenToCopyListeners.forEach((listener) => listener());
      }
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      (event.key === "x" || event.key === "X")
    ) {
      if (this.hasSelection()) {
        event.preventDefault();
        this.listenToCopyListeners.forEach((listener) => listener());
        this.clearSelectedCells();
      }
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      if (this.hasSelection()) {
        event.preventDefault();
        this.clearSelectedCells();
      }
      return;
    }

    if (event.key === "F2") {
      const cell = this.getTopLeftCellInSelection();
      if (cell) {
        this.editCell(cell.row, cell.col);
      }
      return;
    }

    // handle cmd + shift + arrow key to select all cells in the direction of the arrow key
    if (
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      (event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight")
    ) {
      let shouldUpdate = false;
      const lastSelection = this.selections[this.selections.length - 1];
      if (!lastSelection) {
        return;
      }
      if (event.key === "ArrowUp") {
        if (
          this.gt(lastSelection.end.row, {
            type: "number",
            value: 0,
          })
        ) {
          lastSelection.end.row = { type: "number", value: 0 };
          shouldUpdate = true;
        }
      }
      if (event.key === "ArrowDown") {
        const numRows = this.getNumRows();
        const maxRow: MaybeInfNumber =
          numRows.type === "infinity"
            ? { type: "infinity" }
            : { type: "number", value: numRows.value - 1 };
        if (this.lt(lastSelection.end.row, maxRow)) {
          lastSelection.end.row = maxRow;
          shouldUpdate = true;
        }
      }
      if (event.key === "ArrowLeft") {
        if (this.gt(lastSelection.end.col, { type: "number", value: 0 })) {
          lastSelection.end.col = { type: "number", value: 0 };
          shouldUpdate = true;
        }
      }
      if (event.key === "ArrowRight") {
        const numCols = this.getNumCols();
        const maxCol: MaybeInfNumber =
          numCols.type === "infinity"
            ? { type: "infinity" }
            : { type: "number", value: numCols.value - 1 };
        if (this.lt(lastSelection.end.col, maxCol)) {
          lastSelection.end.col = maxCol;
          shouldUpdate = true;
        }
      }
      if (shouldUpdate) {
        this.onUpdate();
      }
      return;
    }

    // handle cmd/ctrl + a to select all cells
    if (
      (event.metaKey || event.ctrlKey) &&
      (event.key === "a" || event.key === "A")
    ) {
      const numRows = this.getNumRows();
      const numCols = this.getNumCols();
      if (
        this.selections.some(
          (s) =>
            s.start.row === 0 &&
            s.start.col === 0 &&
            this.equals(
              s.end.row,
              numRows.type === "infinity"
                ? { type: "infinity" }
                : { type: "number", value: numRows.value - 1 },
            ) &&
            this.equals(
              s.end.col,
              numCols.type === "infinity"
                ? { type: "infinity" }
                : { type: "number", value: numCols.value - 1 },
            ),
        )
      ) {
        return;
      }
      event.preventDefault();

      this.selections = [
        {
          start: { row: 0, col: 0 },
          end: {
            row:
              numRows.type === "infinity"
                ? { type: "infinity" }
                : { type: "number", value: numRows.value - 1 },
            col:
              numCols.type === "infinity"
                ? { type: "infinity" }
                : { type: "number", value: numCols.value - 1 },
          },
        },
      ];
      this.onUpdate();
      return;
    }

    // handle arrow keys for navigation and selection
    {
      let key = event.key;
      let shiftKey = event.shiftKey;
      if (event.key === "Enter") {
        key = event.shiftKey ? "ArrowUp" : "ArrowDown";
        shiftKey = false;
      }
      if (event.key === "Tab") {
        key = event.shiftKey ? "ArrowLeft" : "ArrowRight";
        shiftKey = false;
      }
      if (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight"
      ) {
        let shouldUpdate = false;

        // Get the current active position (start of last selection, or 0,0 if no selection)
        const lastSelection = this.selections[this.selections.length - 1];
        const currentRow: MaybeInfNumber = lastSelection
          ? shiftKey
            ? lastSelection.end.row
            : { type: "number", value: lastSelection.start.row }
          : { type: "number", value: 0 };
        const currentCol: MaybeInfNumber = lastSelection
          ? shiftKey
            ? lastSelection.end.col
            : { type: "number", value: lastSelection.start.col }
          : { type: "number", value: 0 };

        // Calculate new position based on arrow key
        let newRow = currentRow;
        let newCol = currentCol;

        const numRows = this.getNumRows();
        const numCols = this.getNumCols();

        if (
          key === "ArrowUp" &&
          this.gt(newRow, { type: "number", value: 0 })
        ) {
          if (newRow.type === "number") {
            newRow = { type: "number", value: newRow.value - 1 };
          } else {
            newRow = { type: "infinity" };
          }
        } else if (
          key === "ArrowDown" &&
          this.lt(
            newRow,
            numRows.type === "infinity"
              ? { type: "infinity" }
              : { type: "number", value: numRows.value - 1 },
          )
        ) {
          if (newRow.type === "number") {
            newRow = { type: "number", value: newRow.value + 1 };
          } else {
            newRow = { type: "infinity" };
          }
        } else if (
          key === "ArrowLeft" &&
          this.gt(newCol, { type: "number", value: 0 })
        ) {
          if (newCol.type === "number") {
            newCol = { type: "number", value: newCol.value - 1 };
          } else {
            newCol = { type: "infinity" };
          }
        } else if (
          key === "ArrowRight" &&
          this.lt(
            newCol,
            numCols.type === "infinity"
              ? { type: "infinity" }
              : { type: "number", value: numCols.value - 1 },
          )
        ) {
          if (newCol.type === "number") {
            newCol = { type: "number", value: newCol.value + 1 };
          } else {
            newCol = { type: "infinity" };
          }
        }

        // If position changed
        if (newRow !== currentRow || newCol !== currentCol) {
          if (shiftKey && lastSelection) {
            // Extend current selection
            lastSelection.end = { row: newRow, col: newCol };
            shouldUpdate = true;
          } else {
            if (newRow.type === "infinity" || newCol.type === "infinity") {
              throw new Error("Invalid newRow or newCol");
            }
            // Create new single-cell selection
            this.selections = [
              {
                start: { row: newRow.value, col: newCol.value },
                end: { row: newRow, col: newCol },
              },
            ];
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          event.preventDefault();
          this.onUpdate();
        }
        return;
      }
    }
  }
  /**
   * @param data - A map of keys to values. The keys are strings of the form "row,col" where row and col are integers.
   * @returns A string in TSV format.
   */
  selectionToTsv(data: Map<string, unknown>) {
    const cellValues: Map<
      string,
      { row: number; col: number; value: unknown }
    > = new Map();

    // Iterate over actual data entries and check if they're in any selection
    data.forEach((value, key) => {
      const parts = key.split(",");
      if (parts.length !== 2 || !parts[0] || !parts[1]) return; // Skip invalid keys

      const row = parseInt(parts[0], 10);
      const col = parseInt(parts[1], 10);

      // Skip if parsing failed
      if (isNaN(row) || isNaN(col)) return;

      // Check if this cell is in any of the selections
      const isInSelection = this.selections.some((selection) => {
        const startRow = this.min(selection.start.row, selection.end.row);
        const endRow = this.max(selection.start.row, selection.end.row);
        const startCol = this.min(selection.start.col, selection.end.col);
        const endCol = this.max(selection.start.col, selection.end.col);

        return (
          this.gte(
            { type: "number", value: row },
            { type: "number", value: startRow },
          ) &&
          this.lte({ type: "number", value: row }, endRow) &&
          this.gte(
            { type: "number", value: col },
            { type: "number", value: startCol },
          ) &&
          this.lte({ type: "number", value: col }, endCol)
        );
      });

      if (isInSelection) {
        cellValues.set(key, { row, col, value });
      }
    });

    // Group cells by row
    const rowsMap = new Map<number, Map<number, unknown>>();
    cellValues.forEach((cellData) => {
      if (!rowsMap.has(cellData.row)) {
        rowsMap.set(cellData.row, new Map());
      }
      rowsMap.get(cellData.row)!.set(cellData.col, cellData.value);
    });

    // Convert to TSV format with proper row/column structure
    const sortedRows = Array.from(rowsMap.keys()).sort((a, b) => a - b);
    const tsvRows = sortedRows.map((rowIndex) => {
      const rowCells = rowsMap.get(rowIndex)!;
      const sortedCols = Array.from(rowCells.keys()).sort((a, b) => a - b);
      return sortedCols
        .map((colIndex) => rowCells.get(colIndex) ?? "")
        .join("\t");
    });

    return tsvRows.join("\n");
  }

  /**
   * @param area - The area to get the cells from.
   *
   * can be overridden by the user to return a different list of cells based on their data,
   * useful when the selectable area is infinite
   *
   * @returns A list of cells in the area.
   */
  public getCellsWithData(
    area: SMArea,
  ): { rowIndex: number; colIndex: number }[] {
    if (area.end.row.type === "infinity" || area.end.col.type === "infinity") {
      throw new Error("Cannot iterate over infinite selections");
    }
    const cells: { rowIndex: number; colIndex: number }[] = [];
    for (let row = area.start.row; row <= area.end.row.value; row++) {
      for (let col = area.start.col; col <= area.end.col.value; col++) {
        cells.push({ rowIndex: row, colIndex: col });
      }
    }
    return cells;
  }

  clearSelectedCells() {
    const updates: { rowIndex: number; colIndex: number; value: string }[] = [];
    this.getNonOverlappingSelections().forEach((selection) => {
      const cells = this.getCellsWithData(selection);
      cells.forEach((cell) => {
        updates.push({
          rowIndex: cell.rowIndex,
          colIndex: cell.colIndex,
          value: "",
        });
      });
    });
    this.saveCellValues(updates);
  }

  forEachSelectedCell(
    callback: (cell: {
      /**
       * absolute
       */
      absolute: { row: number; col: number };
      /**
       * relative to the bounding rect
       */
      relative: { row: number; col: number };
    }) => void,
  ) {
    const selections = this.getNonOverlappingSelections();
    const boundingRect = this.getSelectionsBoundingRect();
    if (!boundingRect) return;

    // Check for infinite selections
    if (
      boundingRect.end.row.type === "infinity" ||
      boundingRect.end.col.type === "infinity"
    ) {
      throw new Error("Cannot iterate over infinite selections");
    }

    for (const selection of selections) {
      if (
        selection.end.row.type === "infinity" ||
        selection.end.col.type === "infinity"
      ) {
        throw new Error("Cannot iterate over infinite selections");
      }
    }

    selections.forEach((selection) => {
      if (
        selection.end.row.type === "infinity" ||
        selection.end.col.type === "infinity"
      ) {
        throw new Error("Cannot iterate over infinite selections");
      }
      for (
        let row = selection.start.row;
        row <= selection.end.row.value;
        row++
      ) {
        for (
          let col = selection.start.col;
          col <= selection.end.col.value;
          col++
        ) {
          callback({
            absolute: { row, col },
            relative: {
              row: row - boundingRect.start.row,
              col: col - boundingRect.start.col,
            },
          });
        }
      }
    });
  }

  private listenToCopyListeners: (() => void)[] = [];
  listenToCopy(callback: () => void) {
    this.listenToCopyListeners.push(callback);
    return () => {
      this.listenToCopyListeners = this.listenToCopyListeners.filter(
        (l) => l !== callback,
      );
    };
  }

  private listenToUpdateDataListeners: ((
    updates: { rowIndex: number; colIndex: number; value: string }[],
  ) => void)[] = [];
  listenToUpdateData(
    callback: (
      data: { rowIndex: number; colIndex: number; value: string }[],
    ) => void,
  ) {
    this.listenToUpdateDataListeners.push(callback);
    return () => {
      this.listenToUpdateDataListeners =
        this.listenToUpdateDataListeners.filter((l) => l !== callback);
    };
  }

  private listenToFillListeners: ((ev: FillEvent) => void)[] = [];
  listenToFill(callback: (ev: FillEvent) => void) {
    this.listenToFillListeners.push(callback);
    return () => {
      this.listenToFillListeners = this.listenToFillListeners.filter(
        (l) => l !== callback,
      );
    };
  }

  public saveCellValue(
    cell: { rowIndex: number; colIndex: number },
    value: string,
  ) {
    this.listenToUpdateDataListeners.forEach((listener) => {
      listener([{ rowIndex: cell.rowIndex, colIndex: cell.colIndex, value }]);
      this.onUpdate();
    });
  }

  public saveCellValues(
    updates: { rowIndex: number; colIndex: number; value: string }[],
  ) {
    this.listenToUpdateDataListeners.forEach((listener) => {
      listener(updates);
    });
  }

  hasSelection() {
    return this.selections.length > 0;
  }

  focus() {
    this.willMaybeUpdate();
    const prev = this.hasFocus;
    this.hasFocus = true;
    if (prev !== this.hasFocus) {
      this.onUpdate();
    }
  }

  blur() {
    this.willMaybeUpdate();
    const prev = this.hasFocus;
    this.hasFocus = false;
    if (prev !== this.hasFocus) {
      this.onUpdate();
    }
  }

  cancelHovering() {
    this.willMaybeUpdate();
    this.isHovering = { type: "none" };
    this.onUpdate();
  }

  private currentSelectionCoversWholeIndex(
    index: number,
    type: "row" | "col",
  ): boolean {
    if (this.isSelecting.type === "none") {
      return false;
    }

    const selection = this.isSelecting;
    const startRow = this.min(selection.start.row, selection.end.row);
    const endRow = this.max(selection.start.row, selection.end.row);
    const startCol = this.min(selection.start.col, selection.end.col);
    const endCol = this.max(selection.start.col, selection.end.col);

    // Apply the same logic as cellInSelection for handling infinity
    const normalizedEndRow = this.normalizeEndBound(endRow, this.getNumRows());
    const normalizedEndCol = this.normalizeEndBound(endCol, this.getNumCols());

    if (type === "row") {
      // Check if current selection covers the entire row
      if (
        !(
          startRow <= index &&
          (normalizedEndRow.type === "infinity" ||
            index <= normalizedEndRow.value)
        )
      ) {
        return false;
      }
      // Check if the column range covers the entire width
      const numCols = this.getNumCols();
      if (numCols.type === "infinity") {
        return startCol === 0 && normalizedEndCol.type === "infinity";
      } else {
        return (
          startCol === 0 &&
          this.gte(normalizedEndCol, {
            type: "number",
            value: numCols.value - 1,
          })
        );
      }
    } else {
      // Check if current selection covers the entire column
      if (
        !(
          startCol <= index &&
          (normalizedEndCol.type === "infinity" ||
            index <= normalizedEndCol.value)
        )
      ) {
        return false;
      }
      // Check if the row range covers the entire height
      const numRows = this.getNumRows();
      if (numRows.type === "infinity") {
        return startRow === 0 && normalizedEndRow.type === "infinity";
      } else {
        return (
          startRow === 0 &&
          this.gte(normalizedEndRow, {
            type: "number",
            value: numRows.value - 1,
          })
        );
      }
    }
  }

  getContainerBoxShadow() {
    if (this.hasFocus) {
      return "0 0 0 1px #2196F3";
    }
    return undefined;
  }

  /**
   * @param el - The cell element to setup.
   * @param cell - The cell to setup.
   * @returns A function to cleanup the cell.
   */
  setupCellElement(el: HTMLElement, cell: { row: number; col: number }) {
    const onMouseDown = (e: MouseEvent) => {
      const htmlEl = e.target as HTMLElement;
      const fillHandleBaseSelection = this.getFillHandleBaseSelection();
      const isFillHandle =
        !!fillHandleBaseSelection && htmlEl.hasAttribute("data-fill-handle");
      this.cellMouseDown(cell.row, cell.col, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        isFillHandle,
      });
    };
    const onMouseEnter = (e: MouseEvent) => {
      this.cellMouseEnter(cell.row, cell.col);
    };

    const onDoubleClick = (e: MouseEvent) => {
      this.editCell(cell.row, cell.col);
    };
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("dblclick", onDoubleClick);

    const setupBoxShadow = () => {
      const boxShadow = this.getCellBoxShadow({
        row: cell.row,
        col: cell.col,
      });
      el.style.boxShadow = boxShadow ?? "";
    };
    setupBoxShadow();

    const cleanups = [
      this.onNextState(() => {
        setupBoxShadow();
      }),
      this.observeStateChange(
        () => {
          const topLeftSelectedCell = this.getTopLeftCellInSelection();
          if (topLeftSelectedCell && this.inputCaptureElement) {
            if (
              topLeftSelectedCell.col === cell.col &&
              topLeftSelectedCell.row === cell.row
            ) {
              return this.inputCaptureElement;
            }
          }
          return null;
        },
        (inputCaptureElement) => {
          if (!inputCaptureElement) {
            return;
          }

          const origStyles = {
            top: inputCaptureElement.style.top,
            left: inputCaptureElement.style.left,
            width: inputCaptureElement.style.width,
            height: inputCaptureElement.style.height,
          };
          const setupPositioning = () => {
            const myRect = el.getBoundingClientRect();
            inputCaptureElement.style.top = `${myRect.top}px`;
            inputCaptureElement.style.left = `${myRect.left}px`;
            inputCaptureElement.style.width = `${myRect.width}px`;
            inputCaptureElement.style.height = `${myRect.height}px`;
          };
          inputCaptureElement.addEventListener("keydown", setupPositioning);
          return () => {
            inputCaptureElement.style.top = origStyles.top;
            inputCaptureElement.style.left = origStyles.left;
            inputCaptureElement.style.width = origStyles.width;
            inputCaptureElement.style.height = origStyles.height;
            inputCaptureElement.removeEventListener(
              "keydown",
              setupPositioning,
            );
          };
        },
      ),
    ];
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("dblclick", onDoubleClick);
      cleanups.forEach((cleanup) => cleanup());
    };
  }

  /**
   * @param el - The header element to setup.
   * @param index - The index of the header.
   * @param type - The type of header. "row" for row headers, "col" for column headers.
   * @returns A function to cleanup the header.
   */
  setupHeaderElement(el: HTMLElement, index: number, type: "row" | "col") {
    const onMouseDown = (e: MouseEvent) => {
      this.headerMouseDown(index, type, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      });
    };
    const onMouseEnter = (e: MouseEvent) => {
      this.headerMouseEnter(index, type);
    };
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseenter", onMouseEnter);
    const setupBoxShadow = () => {
      const boxShadow = this.getHeaderBoxShadow(index, type);
      el.style.boxShadow = boxShadow ?? "";
    };
    setupBoxShadow();
    const cleanups = [
      this.onNextState(() => {
        setupBoxShadow();
      }),
    ];
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseenter", onMouseEnter);
      cleanups.forEach((cleanup) => cleanup());
    };
  }

  observeStateChange<T>(
    selector: (state: SelectionManagerState) => T,
    callback: (value: T) => void | (() => void),
    runInstant?: boolean,
  ) {
    let innerCleanup: (() => void) | undefined;
    let value: { current: T } | undefined;
    if (runInstant) {
      const initialValue = selector(this.getState());
      value = { current: initialValue };
      const maybeCleanup = callback(initialValue);
      if (typeof maybeCleanup === "function") {
        innerCleanup = maybeCleanup;
      }
    }

    const runInnerCleanup = () => {
      if (innerCleanup) {
        innerCleanup();
        innerCleanup = undefined;
      }
    };

    const cleanup = this.onNextState(function observeStateChange(state) {
      const val = selector(state);
      if (!value || value.current !== val) {
        value = { current: val };

        runInnerCleanup();

        const maybeCleanup = callback(val);
        if (typeof maybeCleanup === "function") {
          innerCleanup = maybeCleanup;
        }
      }
    });
    return () => {
      cleanup();
      runInnerCleanup();
    };
  }

  private insertParsedData(
    content: string,
    startPosition?: { row: number; col: number },
  ) {
    const data = parseCSVContent(content);
    const updates: { value: string; rowIndex: number; colIndex: number }[] = [];

    // Get starting position for paste
    const firstCell = startPosition ??
      this.getTopLeftCellInSelection() ?? { row: 0, col: 0 };
    const startRow = firstCell.row;
    const startCol = firstCell.col;

    data.forEach((cellData) => {
      const targetRow = startRow + cellData.rowIndex;
      const targetCol = startCol + cellData.colIndex;

      // Check bounds if limits are specified
      if (
        this.getNumRows() &&
        this.gt({ type: "number", value: targetRow }, this.getNumRows())
      )
        return;
      if (
        this.getNumCols() &&
        this.gt({ type: "number", value: targetCol }, this.getNumCols())
      )
        return;

      updates.push({
        value: cellData.value,
        rowIndex: targetRow,
        colIndex: targetCol,
      });
    });

    this.listenToUpdateDataListeners.forEach((listener) => listener(updates));
  }

  handleDrop(ev: DragEvent) {
    if (!this.hasFocus) return;
    ev.preventDefault();

    const files = Array.from(ev.dataTransfer?.files ?? []);
    const file = files.find(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".tsv"),
    );

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      this.insertParsedData(content);
    };

    reader.readAsText(file);
  }

  handlePaste(ev: ClipboardEvent) {
    // Only handle paste when focused and not editing
    if (!this.hasFocus || this.isEditing.type !== "none") return;

    if (!this.hasSelection()) return;

    ev.preventDefault();
    const text = ev.clipboardData?.getData("text/plain");
    if (!text) return;

    this.insertParsedData(text);
  }

  /**
   * Computes the practical difference between two areas for spreadsheet operations.
   * Returns the rectangular area that represents the "new" part when extending from b to a,
   * or the "removed" part when shrinking from a to b.
   *
   * For fill operations:
   * - extend: difference(newSelection, seedSelection) = new cells to fill
   * - shrink: difference(seedSelection, newSelection) = cells to clear
   */
  difference(a: SMArea, b: SMArea): SMArea {
    const aMinRow = this.min(a.start.row, a.end.row);
    const aMaxRow = this.max(a.start.row, a.end.row);
    const aMinCol = this.min(a.start.col, a.end.col);
    const aMaxCol = this.max(a.start.col, a.end.col);

    const bMinRow = this.min(b.start.row, b.end.row);
    const bMaxRow = this.max(b.start.row, b.end.row);
    const bMinCol = this.min(b.start.col, b.end.col);
    const bMaxCol = this.max(b.start.col, b.end.col);

    // For spreadsheet fill operations, we want the rectangular difference
    // This handles the most common cases for extend/shrink operations

    // If A extends beyond B vertically (bottom extension/shrink)
    if (
      aMaxRow.type === "number" &&
      bMaxRow.type === "number" &&
      aMaxRow.value > bMaxRow.value &&
      aMinRow <= bMaxRow.value
    ) {
      return {
        start: { row: bMaxRow.value + 1, col: Math.min(aMinCol, bMinCol) },
        end: { row: aMaxRow, col: this.maxMaybeInf(aMaxCol, bMaxCol) },
      };
    }

    // If A extends beyond B horizontally (right extension/shrink)
    if (
      aMaxCol.type === "number" &&
      bMaxCol.type === "number" &&
      aMaxCol.value > bMaxCol.value &&
      aMinCol <= bMaxCol.value
    ) {
      return {
        start: { row: Math.min(aMinRow, bMinRow), col: bMaxCol.value + 1 },
        end: { row: this.maxMaybeInf(aMaxRow, bMaxRow), col: aMaxCol },
      };
    }

    // If B extends beyond A (shrink case - return the area being removed)
    if (
      bMaxRow.type === "number" &&
      aMaxRow.type === "number" &&
      bMaxRow.value > aMaxRow.value
    ) {
      return {
        start: { row: aMaxRow.value + 1, col: Math.min(aMinCol, bMinCol) },
        end: { row: bMaxRow, col: this.maxMaybeInf(aMaxCol, bMaxCol) },
      };
    }

    if (
      bMaxCol.type === "number" &&
      aMaxCol.type === "number" &&
      bMaxCol.value > aMaxCol.value
    ) {
      return {
        start: { row: Math.min(aMinRow, bMinRow), col: aMaxCol.value + 1 },
        end: { row: this.maxMaybeInf(aMaxRow, bMaxRow), col: bMaxCol },
      };
    }

    // Fallback: return the original area A (no meaningful difference)
    return a;
  }

  inputCaptureElement: HTMLTextAreaElement | null = null;

  mouseUp() {
    this.willMaybeUpdate();
    if (this.isSelecting.type !== "none") {
      if (this.isSelecting.type === "fill") {
        const fillHandleBaseSelection = this.getFillHandleBaseSelection();
        if (fillHandleBaseSelection) {
          const triggerEvent = (ev: FillEvent) => {
            this.listenToFillListeners.forEach((listener) => listener(ev));
          };

          if (this.isSelecting.eventType === "shrink") {
            this.deselectArea(fillHandleBaseSelection);
            this.selections.push(this.isSelecting);
            const rangeToClear = this.difference(
              fillHandleBaseSelection,
              this.isSelecting,
            );
            triggerEvent({
              type: "shrink",
              rangeToClear,
            });
          } else {
            this.selections.push({
              start: this.isSelecting.start,
              end: this.isSelecting.end,
            });
            triggerEvent({
              seedRange: fillHandleBaseSelection,
              fillRange: this.difference(
                this.isSelecting,
                fillHandleBaseSelection,
              ),
              direction: this.isSelecting.direction,
              type: this.isSelecting.eventType,
              outputRange: this.isSelecting,
            });
          }
        }
      } else if (this.isSelecting.type === "remove") {
        this.deselectArea(this.isSelecting);
      } else {
        this.selections.push({
          start: this.isSelecting.start,
          end: this.isSelecting.end,
        });
      }
    }
    this.isSelecting = { type: "none" };
    this.onUpdate();
  }

  isHoveringCell(row: number, col: number) {
    return (
      this.isHovering.type === "cell" &&
      this.isHovering.row === row &&
      this.isHovering.col === col
    );
  }

  setupContainerElement(el: HTMLElement) {
    const onMouseUp = (ev: MouseEvent) => {
      this.mouseUp();
    };
    const onMouseDown = (ev: MouseEvent) => {
      const focus = el.contains(ev.target as Node);
      if (focus) {
        this.focus();
      } else {
        this.blur();
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (this.hasFocus) {
        this.handleKeyDown(ev);
      }
    };

    const handlePaste = (ev: ClipboardEvent) => {
      if (this.hasFocus) {
        this.handlePaste(ev);
      }
    };

    const handleDragOver = (ev: DragEvent) => {
      this.focus();
      ev.preventDefault();
    };

    const handleDrop = (ev: DragEvent) => {
      if (this.hasFocus) {
        this.handleDrop(ev);
      }
    };

    const handleMouseLeave = (ev: MouseEvent) => {
      this.willMaybeUpdate();
      this.isHovering = { type: "none" };
      this.onUpdate();
    };

    const selectionCleanup = this.observeStateChange(
      (state) => state.isSelecting.type,
      (type) => {
        if (type !== "none") {
          const preventSelection = (e: Event) => {
            e.preventDefault();
            document.getSelection()?.empty();
          };
          el.addEventListener("selectstart", preventSelection);
          el.addEventListener("selectionchange", preventSelection);
          return () => {
            el.removeEventListener("selectstart", preventSelection);
            el.removeEventListener("selectionchange", preventSelection);
          };
        }
      },
      true,
    );

    const inputCaptureCleanup = this.observeStateChange(
      (state) => state.hasFocus && state.isEditing.type === "none",
      (focus) => {
        if (focus) {
          const textarea = document.createElement("textarea");
          textarea.style.position = "fixed";
          textarea.style.top = "0";
          textarea.style.left = "0";
          textarea.style.right = "0";
          textarea.style.bottom = "0";
          textarea.style.opacity = "0";
          textarea.style.pointerEvents = "none";
          textarea.style.zIndex = "-1";
          textarea.name = "selection-manager-input-capture";
          textarea.tabIndex = -1;
          document.body.appendChild(textarea);

          textarea.setAttribute("autocomplete", "off");
          textarea.setAttribute("autocorrect", "off");
          textarea.setAttribute("autocapitalize", "off");
          textarea.setAttribute("spellcheck", "false");
          textarea.autofocus = true;
          textarea.addEventListener("beforeinput", (e) => {
            e.preventDefault();
            if (e.inputType === "insertText") {
              if (e.data) {
                const cell = this.getTopLeftCellInSelection();
                if (cell) {
                  this.editCell(cell.row, cell.col, e.data);
                }
              }
            }
            textarea.value = "";
          });
          textarea.addEventListener("compositionend", (e) => {
            e.preventDefault();
            if (e.data) {
              const cell = this.getTopLeftCellInSelection();
              if (cell) {
                this.editCell(cell.row, cell.col, e.data);
              }
            }
            textarea.value = "";
          });
          const onKeyDown = () => {
            textarea.focus({
              preventScroll: true,
            });
          };
          window.addEventListener("keydown", onKeyDown);
          this.inputCaptureElement = textarea;
          return () => {
            this.inputCaptureElement = null;
            window.removeEventListener("keydown", onKeyDown);
            document.body.removeChild(textarea);
          };
        }
      },
      true,
    );

    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("paste", handlePaste);
    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("drop", handleDrop);
    el.addEventListener("mouseleave", handleMouseLeave);
    const boxShadowCleanup = this.onNextState(() => {
      const boxShadow = this.getContainerBoxShadow();
      el.style.boxShadow = boxShadow ?? "";
    });
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("paste", handlePaste);
      el.removeEventListener("dragover", handleDragOver);
      el.removeEventListener("drop", handleDrop);
      el.removeEventListener("mouseleave", handleMouseLeave);
      boxShadowCleanup();
      selectionCleanup();
      inputCaptureCleanup();
    };
  }

  setupInputElement(
    element: HTMLInputElement | HTMLTextAreaElement,
    cell: { rowIndex: number; colIndex: number },
  ) {
    const el = element as HTMLInputElement; // (or HTMLTextAreaElement)
    const save = () => {
      this.saveCellValue(cell, el.value);
      this.cancelEditing();
    };
    const onBlur = () => {
      save();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        save();
      } else if (e.key === "Tab") {
        save();
        e.preventDefault();
      }
    };
    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKeyDown);

    if (
      this.isEditing.type === "cell" &&
      this.isEditing.row === cell.rowIndex &&
      this.isEditing.col === cell.colIndex
    ) {
      if (this.isEditing.initialValue) {
        el.value = this.isEditing.initialValue;
      }
    }
    el.focus();
    el.selectionStart = el.selectionEnd = el.value.length;
    return () => {
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKeyDown);
    };
  }
}

type Border = "left" | "right" | "top" | "bottom";
