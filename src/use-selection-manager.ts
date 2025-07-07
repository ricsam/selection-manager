import { useEffect, useRef, useState } from "react";
import { SelectionManager } from "./selection-manager";

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
    const cleanup = selectionManager.onNextState(() => {
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
