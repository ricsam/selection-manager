export type RealNumber = { type: "number"; value: number };
export type InfinityNumber = { type: "infinity" };
export type MaybeInfNumber = RealNumber | InfinityNumber;

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

type KeyboardEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
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
      value: boolean | SMArea[] | IsSelecting | IsEditing | IsHovering;
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
      value: boolean | SMArea[] | IsSelecting | IsEditing | IsHovering;
    };
