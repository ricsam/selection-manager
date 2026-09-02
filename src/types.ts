import type { Format } from "./utils";

export type RealNumber = { type: "number"; value: number };
export type InfinityNumber = { type: "infinity" };
export type MaybeInfNumber = RealNumber | InfinityNumber;

export type ReadonlyCellPredicate = (cell: {
  rowIndex: number;
  colIndex: number;
}) => boolean;

export type SMCell = { row: number; col: number };

export type SMDirection = "up" | "down" | "left" | "right";

export type SelectionManagerOptions = {
  formats?: Format[];
  isCellReadonly?: ReadonlyCellPredicate;
  navigation?: SelectionNavigationModel;
};

export type SMArea = {
  start: { row: number; col: number };
  /**
   * The last row and column of the area.
   * Inclusive. Support row: Infinity and col: Infinity.
   */
  end: {
    row: MaybeInfNumber;
    col: MaybeInfNumber;
  };
};

export type SMTable = {
  id: string;
  /** The complete table, including headers and totals when present. */
  bounds: SMArea;
  /** The table's data body, when it differs from the complete table. */
  dataBounds?: SMArea;
};

export type NavigationKind = "step" | "jump";

export type NavigationRequest = {
  origin: SMCell;
  direction: SMDirection;
  kind: NavigationKind;
  extend: boolean;
  gridBounds: SMArea;
  usedRange?: SMArea;
  table?: SMTable;
};

export type NavigationTargetResolver = (
  request: NavigationRequest,
) => SMCell | undefined;

export type SelectionNavigationModel = {
  /** Returns the smallest range containing data on the current grid. */
  getUsedRange?: () => SMArea | undefined;
  /** Returns the logical table containing a cell, when one exists. */
  getTableAt?: (cell: SMCell) => SMTable | undefined;
  /**
   * Resolves keyboard navigation. This is authoritative for hosts with sparse
   * data, virtual rows, tables, or other domain-specific rules.
   */
  resolveTarget?: NavigationTargetResolver;
};

export type ViewportRequest = {
  type: "reveal-cell";
  cell: SMCell;
  direction: SMDirection;
  align: "nearest" | "start" | "end";
  reason: "keyboard-navigation";
  kind: NavigationKind;
};

export type SelectionMode = "primary" | "reference";

export type ReferencePickingOptions = {
  /** Associates the picked range with a token or editor decoration. */
  id?: string;
  /** The cell or range whose formula is currently being edited. */
  editedRange?: SMArea;
  /** An existing reference to show before the next pointer interaction. */
  initialRange?: SMArea;
};

export type ReferenceSelectionState =
  | { type: "none" }
  | {
      type: "selecting" | "selected";
      range: SMArea;
      id?: string;
      editedRange?: SMArea;
    };

export type ReferenceSelectionEvent =
  | {
      phase: "start" | "change" | "commit";
      range: SMArea;
      id?: string;
      editedRange?: SMArea;
    }
  | {
      phase: "cancel";
      range?: SMArea;
      id?: string;
      editedRange?: SMArea;
    };

export type FillDirection = "up" | "down" | "left" | "right";

export type FillEvent =
  | {
      type: "extend";
      /**
       * The user's original selection that defines the pattern/series.
       */
      seedRange: SMArea;
      /**
       * the new cells populated by the drag, excluding the seed: outputRange - seedRange.
       */
      fillRange: SMArea;
      /**
       * The direction of the fill.
       */
      direction: FillDirection;
      /**
       * seed range ∪ fill range
       */
      outputRange: SMArea;
    }
  | {
      type: "shrink";
      rangeToClear: SMArea;
    };

export type IsSelecting =
  | {
      type: "none";
    }
  | (SMArea &
      (
        | {
            type: "drag" | "add" | "remove" | "shift";
          }
        | {
            type: "fill";
            direction: FillDirection;
            eventType: FillEvent["type"];
          }
      ));

export type IsEditing =
  | {
      type: "none";
    }
  | {
      type: "cell";
      row: number;
      col: number;
      initialValue?: string;
    };

export type IsHovering =
  | {
      type: "none";
    }
  | {
      type: "cell";
      row: number;
      col: number;
    }
  | {
      type: "group";
      group: SMArea;
    }
  | {
      type: "header";
      index: number;
      headerType: "row" | "col";
    };

export type SelectionManagerState = {
  hasFocus: boolean;
  selections: SMArea[];
  isSelecting: IsSelecting;
  isEditing: IsEditing;
  isHovering: IsHovering;
  selectionMode: SelectionMode;
  /** A formula/reference range kept separate from the primary selection. */
  referenceSelection: ReferenceSelectionState;
};

/**
 * JSON Patch-inspired operations for SelectionManagerState
 * Path uses simple dot notation for nested properties and array indices
 * Examples:
 * - "hasFocus" - root property
 * - "selections" - array property
 * - "selections/0" - first selection in array
 * - "selections/-" - append to end of array (for add operations)
 * - "isEditing.row" - nested property
 */
export type StatePatch =
  | {
      op: "replace";
      path: string;
      value:
        | boolean
        | SMArea[]
        | IsSelecting
        | IsEditing
        | IsHovering
        | SelectionMode
        | ReferenceSelectionState;
    }
  | {
      op: "add";
      path: string;
      value: SMArea;
    }
  | {
      op: "remove";
      path: string;
    }
  | {
      op: "test";
      path: string;
      value:
        | boolean
        | SMArea[]
        | IsSelecting
        | IsEditing
        | IsHovering
        | SelectionMode
        | ReferenceSelectionState;
    };

export type CellDataUpdate = {
  rowIndex: number;
  colIndex: number;
  value: string;
};

export type GenericKeyboardEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
  stopPropagation?: () => void;
};

export type PasteEvent = {
  updates: CellDataUpdate[];
  rawString: string;
};
