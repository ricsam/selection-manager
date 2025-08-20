import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SelectionManager,
  type SelectionManagerState,
  type SMArea,
  type MaybeInfNumber,
} from "./selection-manager";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useInitializeSelectionManager(props: {
  getNumRows?: () => MaybeInfNumber;
  getNumCols?: () => MaybeInfNumber;
  initialState?: Partial<SelectionManagerState>;
  state?: SelectionManagerState;
  onStateChange?: (state: SelectionManagerState) => void;
  containerElement?: HTMLElement | null;
  getGroups?: () => SMArea[];
}): SelectionManager {
  const onStateChangeRef = useRef(props.onStateChange);
  const [selectionManager] = useState<SelectionManager>(() => {
    const selectionManager = new SelectionManager(
      props.getNumRows ?? (() => ({ type: "infinity" })),
      props.getNumCols ?? (() => ({ type: "infinity" })),
      props.getGroups ?? (() => []),
    );
    selectionManager.setState(props.state ?? props.initialState ?? {});
    if (onStateChangeRef.current) {
      selectionManager.onNextState(onStateChangeRef.current);
      selectionManager.onNewRequestedState(onStateChangeRef.current);
    }
    return selectionManager;
  });

  useEffect(() => {
    const containerElement = props.containerElement;
    if (containerElement) {
      const cleanup = selectionManager.setupContainerElement(containerElement);
      return cleanup;
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

  // we can't start re-rendering other components while this hook is running
  // (other components that might be have setState callbacks in nextStateListeners)
  // so we need to use a layout effect
  useIsomorphicLayoutEffect(() => {
    if (props.state) {
      const state = selectionManager.getState();
      selectionManager.nextStateListeners.forEach((listener) => {
        if (listener === onStateChangeRef.current) {
          return;
        }
        return listener(state);
      });
    }
  }, [selectionManager, props.state]);

  return selectionManager;
}
