import { useEffect, useRef, useState } from "react";
import { SelectionManager } from "./selection-manager";

const isShallowEqual = (a: any, b: any) => {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((value, index) => value === b[index])
    );
  }
  if (typeof a === "object" && a !== null && b !== null) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key])
    );
  }
  return false;
};

export function useSelectionManager<T>(
  selectionManager: SelectionManager,
  selector: () => T,
  areEqual: (a: T, b: T) => boolean = (a, b) => a === b,
): T {
  const [state, setState] = useState(() => selector());
  const effectRefOb = {
    selector,
  };
  const effectRef = useRef(effectRefOb);
  effectRef.current.selector = selector;
  useEffect(() => {
    if (selectionManager.controlled) {
      return;
    }
    const cleanup = selectionManager.listen(() => {
      setState((currentState) => {
        const selector = effectRef.current.selector;
        const newState = selector();
        if (!areEqual(newState, currentState)) {
          return newState;
        }
        return currentState;
      });
    });
    return cleanup;
  }, [areEqual, selectionManager]);
  return selectionManager.controlled ? selector() : state;
}
