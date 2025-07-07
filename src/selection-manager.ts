export type SMSelection = {
  start: { row: number; col: number };
  end: { row: number; col: number };
};

type KeyboardEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
};

export type IsSelecting =
  | {
      type: "none";
    }
  | (SMSelection & {
      type: "drag" | "add" | "remove" | "shift";
    });

export type IsEditing =
  | {
      type: "none";
    }
  | {
      type: "cell";
      row: number;
      col: number;
    };

export type SelectionManagerState = {
  hasFocus: boolean;
  selections: SMSelection[];
  isSelecting: IsSelecting;
  isEditing: IsEditing;
};

export class SelectionManager {
  hasFocus = false;
  selections: SMSelection[] = [];
  isSelecting: IsSelecting = { type: "none" };
  isEditing: IsEditing = { type: "none" };
  controlled = false;

  key = String(Math.random());

  constructor(
    private getNumRows: () => number,
    private getNumCols: () => number,
  ) {}

  getState(): SelectionManagerState {
    return {
      hasFocus: this.hasFocus,
      selections: this.selections,
      isSelecting: this.isSelecting,
      isEditing: this.isEditing,
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

  onUpdate() {
    const nextState = this.getState();

    if (this.controlled) {
      // revert the state if it is controlled
      this.setState(this.prevState);
      this.requestedStateListeners.forEach((listener) => listener(nextState));
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
    keys: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) {
    const cmdKey = keys.metaKey || keys.ctrlKey;
    this.willMaybeUpdate();
    const lastSelection = this.selections[this.selections.length - 1];
    if (keys.shiftKey && lastSelection) {
      this.selections.splice(this.selections.length - 1, 1);
      this.isSelecting = { ...lastSelection, type: "shift" };
      this.isSelecting.end = { row, col };
    } else if (cmdKey) {
      const type: "add" | "remove" = this.isSelected({ row, col })
        ? "remove"
        : "add";
      this.isSelecting = {
        start: { row, col },
        end: { row, col },
        type,
      };
    } else {
      this.isSelecting = {
        start: { row, col },
        end: { row, col },
        type: "drag",
      };
      this.selections = [];
    }
    this.onUpdate();
  }

  cellMouseEnter(row: number, col: number) {
    this.willMaybeUpdate();
    if (this.isSelecting.type !== "none") {
      this.isSelecting.end = { row, col };
      this.onUpdate();
    }
  }

  cellMouseUp(row: number, col: number) {
    this.willMaybeUpdate();
    if (this.isSelecting.type !== "none") {
      this.isSelecting.end = { row, col };
      if (this.isSelecting.type === "remove") {
        this.deselectArea(this.isSelecting);
      } else {
        this.selections.push(this.isSelecting);
      }
    }
    this.isSelecting = { type: "none" };
    this.onUpdate();
  }

  cellDoubleClick(row: number, col: number) {
    this.willMaybeUpdate();
    const shouldUpdate =
      this.isEditing.type !== "cell" ||
      this.isEditing.row !== row ||
      this.isEditing.col !== col;

    if (shouldUpdate) {
      this.isEditing = {
        type: "cell",
        row,
        col,
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

  headerMouseDown(
    index: number,
    type: "row" | "col",
    keys: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) {
    this.willMaybeUpdate();
    const lastSelection = this.selections[this.selections.length - 1];

    const actualEndRow =
      this.getNumRows() === Infinity ? Infinity : this.getNumRows() - 1;
    const actualEndCol =
      this.getNumCols() === Infinity ? Infinity : this.getNumCols() - 1;

    const cmdKey = keys.metaKey || keys.ctrlKey;

    const defaultIsSelecting = () => {
      if (type === "row") {
        this.isSelecting = {
          start: { row: index, col: 0 },
          end: { row: index, col: actualEndCol },
          type: "drag",
        };
      } else {
        this.isSelecting = {
          start: { row: 0, col: index },
          end: { row: actualEndRow, col: index },
          type: "drag",
        };
      }
    };
    if (keys.shiftKey && lastSelection) {
      this.selections.splice(this.selections.length - 1, 1);
      this.isSelecting = { ...lastSelection, type: "shift" };
      if (type === "row") {
        this.isSelecting.end = { row: index, col: actualEndCol };
      } else {
        this.isSelecting.end = { row: actualEndRow, col: index };
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
      this.selections = [];
    }
    this.onUpdate();
  }

  headerMouseEnter(index: number, type: "row" | "col") {
    this.willMaybeUpdate();
    const actualEndCol =
      this.getNumCols() === Infinity ? Infinity : this.getNumCols() - 1;
    const actualEndRow =
      this.getNumRows() === Infinity ? Infinity : this.getNumRows() - 1;
    if (this.isSelecting.type !== "none") {
      if (type === "row") {
        this.isSelecting.end = { row: index, col: actualEndCol };
      } else {
        this.isSelecting.end = { row: actualEndRow, col: index };
      }
      this.onUpdate();
    }
  }

  headerMouseUp(index: number, type: "row" | "col") {
    this.willMaybeUpdate();
    const actualEndCol =
      this.getNumCols() === Infinity ? Infinity : this.getNumCols() - 1;
    const actualEndRow =
      this.getNumRows() === Infinity ? Infinity : this.getNumRows() - 1;
    if (this.isSelecting.type !== "none") {
      if (type === "row") {
        this.isSelecting.end = { row: index, col: actualEndCol };
      } else {
        this.isSelecting.end = { row: actualEndRow, col: index };
      }
      if (this.isSelecting.type === "remove") {
        this.deselectArea(this.isSelecting);
      } else {
        this.selections.push(this.isSelecting);
      }
    }
    this.isSelecting = { type: "none" };
    this.onUpdate();
  }

  cancelSelection() {
    this.willMaybeUpdate();
    this.isSelecting = { type: "none" };
    this.onUpdate();
  }

  getActualEndRow() {
    const numRows = this.getNumRows();
    return numRows === Infinity ? Infinity : numRows - 1;
  }
  getActualEndCol() {
    const numCols = this.getNumCols();
    return numCols === Infinity ? Infinity : numCols - 1;
  }

  normalizeSelection(selection: SMSelection) {
    return {
      start: {
        row:
          selection.start.row === Infinity
            ? this.getActualEndRow()
            : selection.start.row,
        col:
          selection.start.col === Infinity
            ? this.getActualEndCol()
            : selection.start.col,
      },
      end: {
        row:
          selection.end.row === Infinity
            ? this.getActualEndRow()
            : selection.end.row,
        col:
          selection.end.col === Infinity
            ? this.getActualEndCol()
            : selection.end.col,
      },
    };
  }

  cellInSelection(
    cell: { row: number; col: number },
    selection: SMSelection,
  ): boolean {
    const { start, end } = selection;
    const startRow = Math.min(start.row, end.row);
    const startCol = Math.min(start.col, end.col);
    const endRow = Math.max(start.row, end.row);
    const endCol = Math.max(start.col, end.col);

    const numRows = this.getNumRows();
    const numCols = this.getNumCols();

    // Handle infinite selections by using actual table bounds
    const actualEndRow =
      endRow === Infinity
        ? numRows === Infinity
          ? Infinity
          : numRows - 1
        : endRow;
    const actualEndCol =
      endCol === Infinity
        ? numCols === Infinity
          ? Infinity
          : numCols - 1
        : endCol;

    return (
      cell.row >= startRow &&
      (actualEndRow === Infinity || cell.row <= actualEndRow) &&
      cell.col >= startCol &&
      (actualEndCol === Infinity || cell.col <= actualEndCol)
    );
  }

  deselectArea(areaToDeselect: SMSelection) {
    const newSelections: SMSelection[] = [];

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

  private selectionsOverlap(a: SMSelection, b: SMSelection): boolean {
    const aMinRow = Math.min(a.start.row, a.end.row);
    const aMaxRow = Math.max(a.start.row, a.end.row);
    const aMinCol = Math.min(a.start.col, a.end.col);
    const aMaxCol = Math.max(a.start.col, a.end.col);

    const bMinRow = Math.min(b.start.row, b.end.row);
    const bMaxRow = Math.max(b.start.row, b.end.row);
    const bMinCol = Math.min(b.start.col, b.end.col);
    const bMaxCol = Math.max(b.start.col, b.end.col);

    return !(
      aMaxRow < bMinRow ||
      aMinRow > bMaxRow ||
      aMaxCol < bMinCol ||
      aMinCol > bMaxCol
    );
  }

  private subtractSelection(
    original: SMSelection,
    toRemove: SMSelection,
  ): SMSelection[] {
    const origMinRow = Math.min(original.start.row, original.end.row);
    const origMaxRow = Math.max(original.start.row, original.end.row);
    const origMinCol = Math.min(original.start.col, original.end.col);
    const origMaxCol = Math.max(original.start.col, original.end.col);

    const removeMinRow = Math.min(toRemove.start.row, toRemove.end.row);
    const removeMaxRow = Math.max(toRemove.start.row, toRemove.end.row);
    const removeMinCol = Math.min(toRemove.start.col, toRemove.end.col);
    const removeMaxCol = Math.max(toRemove.start.col, toRemove.end.col);

    const remaining: SMSelection[] = [];

    // Top rectangle (above the removed area)
    if (origMinRow < removeMinRow) {
      remaining.push({
        start: { row: origMinRow, col: origMinCol },
        end: { row: Math.min(removeMinRow - 1, origMaxRow), col: origMaxCol },
      });
    }

    // Bottom rectangle (below the removed area)
    if (origMaxRow > removeMaxRow) {
      remaining.push({
        start: { row: Math.max(removeMaxRow + 1, origMinRow), col: origMinCol },
        end: { row: origMaxRow, col: origMaxCol },
      });
    }

    // Left rectangle (to the left of the removed area, within the vertical bounds of overlap)
    if (origMinCol < removeMinCol) {
      const topRow = Math.max(origMinRow, removeMinRow);
      const bottomRow = Math.min(origMaxRow, removeMaxRow);
      if (topRow <= bottomRow) {
        remaining.push({
          start: { row: topRow, col: origMinCol },
          end: { row: bottomRow, col: Math.min(removeMinCol - 1, origMaxCol) },
        });
      }
    }

    // Right rectangle (to the right of the removed area, within the vertical bounds of overlap)
    if (origMaxCol > removeMaxCol) {
      const topRow = Math.max(origMinRow, removeMinRow);
      const bottomRow = Math.min(origMaxRow, removeMaxRow);
      if (topRow <= bottomRow) {
        remaining.push({
          start: { row: topRow, col: Math.max(removeMaxCol + 1, origMinCol) },
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
      (numRows !== Infinity && row >= numRows) ||
      (numCols !== Infinity && col >= numCols)
    ) {
      return false;
    }

    return this.selections.some((selection) =>
      this.cellInSelection(cell, selection),
    );
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
        (numRows !== Infinity && sRow >= numRows) ||
        (numCols !== Infinity && sCol >= numCols);

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

  currentSelectionBorders(cell: { row: number; col: number }): Border[] {
    const borders: Border[] = [];
    const selection = this.isSelecting;
    if (selection.type !== "none" && this.cellInSelection(cell, selection)) {
      const minRow = Math.min(selection.start.row, selection.end.row);
      const maxRow = Math.max(selection.start.row, selection.end.row);
      const minCol = Math.min(selection.start.col, selection.end.col);
      const maxCol = Math.max(selection.start.col, selection.end.col);

      const numRows = this.getNumRows();
      const numCols = this.getNumCols();

      // Handle infinite selections by using actual table bounds
      const actualMaxRow =
        maxRow === Infinity
          ? numRows === Infinity
            ? Infinity
            : numRows - 1
          : maxRow;
      const actualMaxCol =
        maxCol === Infinity
          ? numCols === Infinity
            ? Infinity
            : numCols - 1
          : maxCol;

      if (cell.row === minRow) {
        borders.push("top");
      }
      if (actualMaxRow !== Infinity && cell.row === actualMaxRow) {
        borders.push("bottom");
      }
      if (cell.col === minCol) {
        borders.push("left");
      }
      if (actualMaxCol !== Infinity && cell.col === actualMaxCol) {
        borders.push("right");
      }
    }
    return borders;
  }

  getCellBoxShadow(cell: { row: number; col: number }): string | undefined {
    const selectionBorders = this.selectionBorders(cell);
    const currentSelectionBorders = this.currentSelectionBorders(cell);

    const selectionShadows: string[] = [];
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

    currentSelectionBorders.forEach((border) => {
      switch (border) {
        case "top":
          if (
            cell.row !== 0 ||
            !this.currentSelectionCoversWholeIndex(cell.col, "col")
          ) {
            selectionShadows.push(`inset 0 2px 0 0 #c5b4b3`);
          }
          break;
        case "right":
          selectionShadows.push(`inset -2px 0 0 0 #c5b4b3`);
          break;
        case "bottom":
          selectionShadows.push(`inset 0 -2px 0 0 #c5b4b3`);
          break;
        case "left":
          if (
            cell.col !== 0 ||
            !this.currentSelectionCoversWholeIndex(cell.row, "row")
          ) {
            selectionShadows.push(`inset 2px 0 0 0 #c5b4b3`);
          }
          break;
      }
    });

    const selectionBoxShadow =
      selectionShadows.length > 0 ? selectionShadows.join(", ") : undefined;
    return selectionBoxShadow;
  }

  private getIntervalsForIndex(
    index: number,
    type: "row" | "col",
  ): Array<{ start: number; end: number }> {
    const intervals: Array<{ start: number; end: number }> = [];

    for (const selection of this.selections) {
      const startRow = Math.min(selection.start.row, selection.end.row);
      const endRow = Math.max(selection.start.row, selection.end.row);
      const startCol = Math.min(selection.start.col, selection.end.col);
      const endCol = Math.max(selection.start.col, selection.end.col);

      // Apply the same logic as cellInSelection for handling infinity
      const actualEndRow =
        endRow === Infinity
          ? this.getNumRows() === Infinity
            ? Infinity
            : this.getNumRows() - 1
          : endRow;
      const actualEndCol =
        endCol === Infinity
          ? this.getNumCols() === Infinity
            ? Infinity
            : this.getNumCols() - 1
          : endCol;

      if (type === "row") {
        // Check if this selection covers the row
        if (
          startRow <= index &&
          (actualEndRow === Infinity || index <= actualEndRow)
        ) {
          intervals.push({ start: startCol, end: actualEndCol });
        }
      } else {
        // Check if this selection covers the column
        if (
          startCol <= index &&
          (actualEndCol === Infinity || index <= actualEndCol)
        ) {
          intervals.push({ start: startRow, end: actualEndRow });
        }
      }
    }

    return intervals;
  }

  private mergeIntervals(
    intervals: Array<{ start: number; end: number }>,
  ): Array<{ start: number; end: number }> {
    if (intervals.length === 0) {
      return [];
    }

    // Sort intervals by start position
    intervals.sort((a, b) => a.start - b.start);

    // Merge overlapping intervals
    const merged: Array<{ start: number; end: number }> = [intervals[0]!];

    for (let i = 1; i < intervals.length; i++) {
      const current = intervals[i]!;
      const last = merged[merged.length - 1]!;

      if (current.start <= last.end + 1) {
        // Overlapping or adjacent intervals, merge them
        last.end = Math.max(last.end, current.end);
      } else {
        // Non-overlapping interval, add it
        merged.push(current);
      }
    }

    return merged;
  }

  private intervalsSpanFullRange(
    intervals: Array<{ start: number; end: number }>,
    maxValue: number,
  ): boolean {
    if (intervals.length !== 1) {
      return false;
    }

    const interval = intervals[0]!;

    if (maxValue === Infinity) {
      // For infinite range, we need coverage from 0 to Infinity
      return interval.start === 0 && interval.end === Infinity;
    } else {
      // For finite range, we need coverage from 0 to maxValue-1
      return interval.start === 0 && interval.end >= maxValue - 1;
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
    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const startCol = Math.min(selection.start.col, selection.end.col);
    const endCol = Math.max(selection.start.col, selection.end.col);

    // Apply the same logic as cellInSelection for handling infinity
    const actualEndRow =
      endRow === Infinity
        ? this.getNumRows() === Infinity
          ? Infinity
          : this.getNumRows() - 1
        : endRow;
    const actualEndCol =
      endCol === Infinity
        ? this.getNumCols() === Infinity
          ? Infinity
          : this.getNumCols() - 1
        : endCol;

    if (type === "row") {
      // Check if the current selection intersects with this row
      return (
        startRow <= index &&
        (actualEndRow === Infinity || index <= actualEndRow)
      );
    } else {
      // Check if the current selection intersects with this column
      return (
        startCol <= index &&
        (actualEndCol === Infinity || index <= actualEndCol)
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

    const selectionBoxShadow =
      selectionShadows.length > 0 ? selectionShadows.join(", ") : undefined;
    return selectionBoxShadow;
  }

  getTopLeftCellInSelection(): { row: number; col: number } | undefined {
    if (this.selections.length === 0) {
      return undefined;
    }
    let minCell: { row: number; col: number } | undefined;
    const evaluateCell = (cell: { row: number; col: number }) => {
      if (!minCell) {
        minCell = cell;
        return;
      }
      if (cell.col < minCell.col) {
        minCell = cell;
      } else if (cell.col === minCell.col && cell.row < minCell.row) {
        minCell = cell;
      }

    };
    this.selections.forEach((selection) => {
      evaluateCell(selection.start);
      evaluateCell(selection.end);
    });
    return minCell;
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

    if (event.key === "F2") {
      const cell = this.getTopLeftCellInSelection();
      if (cell) {
        this.cellDoubleClick(cell.row, cell.col);
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
        if (lastSelection.end.row > 0) {
          lastSelection.end.row = 0;
          shouldUpdate = true;
        }
      }
      if (event.key === "ArrowDown") {
        const numRows = this.getNumRows();
        const maxRow = numRows === Infinity ? Infinity : numRows - 1;
        if (lastSelection.end.row < maxRow) {
          lastSelection.end.row = maxRow;
          shouldUpdate = true;
        }
      }
      if (event.key === "ArrowLeft") {
        if (lastSelection.end.col > 0) {
          lastSelection.end.col = 0;
          shouldUpdate = true;
        }
      }
      if (event.key === "ArrowRight") {
        const numCols = this.getNumCols();
        const maxCol = numCols === Infinity ? Infinity : numCols - 1;
        if (lastSelection.end.col < maxCol) {
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
            s.end.row === (numRows === Infinity ? Infinity : numRows - 1) &&
            s.end.col === (numCols === Infinity ? Infinity : numCols - 1),
        )
      ) {
        return;
      }
      event.preventDefault();

      this.selections = [
        {
          start: { row: 0, col: 0 },
          end: {
            row: numRows === Infinity ? Infinity : numRows - 1,
            col: numCols === Infinity ? Infinity : numCols - 1,
          },
        },
      ];
      this.onUpdate();
      return;
    }

    // handle arrow keys for navigation and selection
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    ) {
      let shouldUpdate = false;

      // Get the current active position (start of last selection, or 0,0 if no selection)
      const lastSelection = this.selections[this.selections.length - 1];
      const currentRow = lastSelection
        ? lastSelection[event.shiftKey ? "end" : "start"].row
        : 0;
      const currentCol = lastSelection
        ? lastSelection[event.shiftKey ? "end" : "start"].col
        : 0;

      // Calculate new position based on arrow key
      let newRow = currentRow;
      let newCol = currentCol;

      const numRows = this.getNumRows();
      const numCols = this.getNumCols();

      if (event.key === "ArrowUp" && newRow > 0) {
        newRow--;
      } else if (
        event.key === "ArrowDown" &&
        (numRows === Infinity || newRow < numRows - 1)
      ) {
        newRow++;
      } else if (event.key === "ArrowLeft" && newCol > 0) {
        newCol--;
      } else if (
        event.key === "ArrowRight" &&
        (numCols === Infinity || newCol < numCols - 1)
      ) {
        newCol++;
      }

      // If position changed
      if (newRow !== currentRow || newCol !== currentCol) {
        if (event.shiftKey && lastSelection) {
          // Extend current selection
          lastSelection.end = { row: newRow, col: newCol };
          shouldUpdate = true;
        } else {
          // Create new single-cell selection
          this.selections = [
            {
              start: { row: newRow, col: newCol },
              end: { row: newRow, col: newCol },
            },
          ];
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        this.onUpdate();
      }
      return;
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
        const startRow = Math.min(selection.start.row, selection.end.row);
        const endRow = Math.max(selection.start.row, selection.end.row);
        const startCol = Math.min(selection.start.col, selection.end.col);
        const endCol = Math.max(selection.start.col, selection.end.col);

        return (
          row >= startRow && row <= endRow && col >= startCol && col <= endCol
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

  private currentSelectionCoversWholeIndex(
    index: number,
    type: "row" | "col",
  ): boolean {
    if (this.isSelecting.type === "none") {
      return false;
    }

    const selection = this.isSelecting;
    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const startCol = Math.min(selection.start.col, selection.end.col);
    const endCol = Math.max(selection.start.col, selection.end.col);

    // Apply the same logic as cellInSelection for handling infinity
    const actualEndRow =
      endRow === Infinity
        ? this.getNumRows() === Infinity
          ? Infinity
          : this.getNumRows() - 1
        : endRow;
    const actualEndCol =
      endCol === Infinity
        ? this.getNumCols() === Infinity
          ? Infinity
          : this.getNumCols() - 1
        : endCol;

    if (type === "row") {
      // Check if current selection covers the entire row
      if (
        !(
          startRow <= index &&
          (actualEndRow === Infinity || index <= actualEndRow)
        )
      ) {
        return false;
      }
      // Check if the column range covers the entire width
      const numCols = this.getNumCols();
      if (numCols === Infinity) {
        return startCol === 0 && actualEndCol === Infinity;
      } else {
        return startCol === 0 && actualEndCol >= numCols - 1;
      }
    } else {
      // Check if current selection covers the entire column
      if (
        !(
          startCol <= index &&
          (actualEndCol === Infinity || index <= actualEndCol)
        )
      ) {
        return false;
      }
      // Check if the row range covers the entire height
      const numRows = this.getNumRows();
      if (numRows === Infinity) {
        return startRow === 0 && actualEndRow === Infinity;
      } else {
        return startRow === 0 && actualEndRow >= numRows - 1;
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
      this.cellMouseDown(cell.row, cell.col, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      });
    };
    const onMouseEnter = (e: MouseEvent) => {
      this.cellMouseEnter(cell.row, cell.col);
    };
    const onMouseUp = (e: MouseEvent) => {
      this.cellMouseUp(cell.row, cell.col);
    };
    const onDoubleClick = (e: MouseEvent) => {
      this.cellDoubleClick(cell.row, cell.col);
    };
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("dblclick", onDoubleClick);
    const cleanup = this.onNextState(() => {
      const boxShadow = this.getCellBoxShadow({ row: cell.row, col: cell.col });
      el.style.boxShadow = boxShadow ?? "";
    });
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("dblclick", onDoubleClick);
      cleanup();
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
    const onMouseUp = (e: MouseEvent) => {
      this.headerMouseUp(index, type);
    };
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("mouseup", onMouseUp);
    const cleanup = this.onNextState(() => {
      const boxShadow = this.getHeaderBoxShadow(index, type);
      el.style.boxShadow = boxShadow ?? "";
    });
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("mouseup", onMouseUp);
      cleanup();
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

    const cleanup = this.onNextState((state) => {
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

  setupContainerElement(el: HTMLElement) {
    const cancelSelection = (ev: MouseEvent) => {
      if (el.contains(ev.target as Node)) {
        return;
      }
      this.cancelSelection();
    };
    const onMouseDown = (ev: MouseEvent) => {
      if (el.contains(ev.target as Node)) {
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

    window.addEventListener("mouseup", cancelSelection);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    const boxShadowCleanup = this.onNextState(() => {
      const boxShadow = this.getContainerBoxShadow();
      el.style.boxShadow = boxShadow ?? "";
    });
    return () => {
      window.removeEventListener("mouseup", cancelSelection);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      boxShadowCleanup();
      selectionCleanup();
    };
  }
}

type Border = "left" | "right" | "top" | "bottom";
