import { useEffect, useRef, useState } from "react";
import {
  SelectionManager,
  type SelectionManagerState,
} from "./selection-manager";

export function useInitializeSelectionManager(props: {
  getNumRows?: () => number;
  getNumCols?: () => number;
  initialState?: Partial<SelectionManagerState>;
  state?: SelectionManagerState;
  onStateChange?: (state: SelectionManagerState) => void;
  containerElement?: HTMLElement | null;
}): SelectionManager {
  const [selectionManager] = useState<SelectionManager>(() => {
    const selectionManager = new SelectionManager(
      props.getNumRows ?? (() => Infinity),
      props.getNumCols ?? (() => Infinity),
    );
    selectionManager.setState(props.state ?? props.initialState ?? {});
    if (props.onStateChange) {
      selectionManager.listen(props.onStateChange);
    }
    return selectionManager;
  });

  useEffect(() => {
    const containerElement = props.containerElement;
    if (containerElement) {
      const cancelSelection = (ev: MouseEvent) => {
        if (containerElement.contains(ev.target as Node)) {
          return;
        }
        selectionManager.cancelSelection();
      };
      const onMouseDown = (ev: MouseEvent) => {
        if (containerElement.contains(ev.target as Node)) {
          selectionManager.focus();
        } else {
          selectionManager.blur();
        }
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (selectionManager.hasFocus) {
          selectionManager.handleKeyDown(ev);
        }
      };
      window.addEventListener("mouseup", cancelSelection);
      window.addEventListener("mousedown", onMouseDown);
      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.removeEventListener("mouseup", cancelSelection);
        window.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("keydown", onKeyDown);
      };
    }
  }, [props.containerElement, selectionManager]);

  const isControlled = !!props.state;
  const isControlledRef = useRef(isControlled);
  // Check for controlled/uncontrolled mode switches
  if (process.env.NODE_ENV !== "production") {
    if (isControlledRef.current !== isControlled) {
      const prevMode = isControlledRef.current ? "controlled" : "uncontrolled";
      const currentMode = isControlled ? "controlled" : "uncontrolled";

      console.error(
        `Warning: A component is changing from ${prevMode} to ${currentMode}. ` +
          `This is likely caused by the state changing from ${isControlledRef.current ? "a defined value to undefined" : "undefined to a defined value"}, ` +
          `which should not happen. Decide between using a controlled or uncontrolled component ` +
          `for the lifetime of the component. More info: https://reactjs.org/link/controlled-components`,
      );
    }
  }
  isControlledRef.current = isControlled;

  if (props.state) {
    selectionManager.controlled = true;
    selectionManager.setState(props.state);
  } else {
    selectionManager.controlled = false;
  }

  return selectionManager;
}
