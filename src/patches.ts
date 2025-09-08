import type { SelectionManagerState, SMArea, IsSelecting, IsEditing, IsHovering, StatePatch } from "./types";

// StatePatch type is now defined in types.ts

/**
 * Type-safe patch creators for common operations
 */
export const createPatch = {
  setHasFocus: (value: boolean): StatePatch => ({
    op: "replace",
    path: "hasFocus",
    value,
  }),
  
  setSelections: (selections: SMArea[]): StatePatch => ({
    op: "replace", 
    path: "selections",
    value: selections,
  }),
  
  addSelection: (selection: SMArea, index?: number): StatePatch => ({
    op: "add",
    path: index !== undefined ? `selections/${index}` : "selections/-",
    value: selection,
  }),
  
  removeSelection: (index: number): StatePatch => ({
    op: "remove",
    path: `selections/${index}`,
  }),
  
  clearSelections: (): StatePatch => ({
    op: "replace",
    path: "selections", 
    value: [],
  }),
  
  setIsSelecting: (value: IsSelecting): StatePatch => ({
    op: "replace",
    path: "isSelecting",
    value,
  }),
  
  setIsEditing: (value: IsEditing): StatePatch => ({
    op: "replace", 
    path: "isEditing",
    value,
  }),
  
  setIsHovering: (value: IsHovering): StatePatch => ({
    op: "replace",
    path: "isHovering", 
    value,
  }),
};

/**
 * Compares two values for deep equality
 */
function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Creates patches that describe the differences between two states
 */
export function createPatches(
  prevState: SelectionManagerState,
  nextState: SelectionManagerState
): StatePatch[] {
  const patches: StatePatch[] = [];

  // Check hasFocus
  if (prevState.hasFocus !== nextState.hasFocus) {
    patches.push(createPatch.setHasFocus(nextState.hasFocus));
  }

  // Check selections - try to create granular patches
  if (!deepEqual(prevState.selections, nextState.selections)) {
    const prevSelections = prevState.selections;
    const nextSelections = nextState.selections;

    // If clearing all selections
    if (nextSelections.length === 0 && prevSelections.length > 0) {
      patches.push(createPatch.clearSelections());
    }
    // If it's a single addition to the end
    else if (
      nextSelections.length === prevSelections.length + 1 &&
      prevSelections.every((sel, i) => deepEqual(sel, nextSelections[i]))
    ) {
      const lastSelection = nextSelections[nextSelections.length - 1];
      if (lastSelection) {
        patches.push(createPatch.addSelection(lastSelection));
      }
    }
    // If it's a single removal
    else if (
      nextSelections.length === prevSelections.length - 1 &&
      prevSelections.length > 0
    ) {
      // Find which index was removed
      let removedIndex = -1;
      for (let i = 0; i < prevSelections.length; i++) {
        const isRemoved = !nextSelections.some(sel => deepEqual(sel, prevSelections[i]));
        if (isRemoved) {
          removedIndex = i;
          break;
        }
      }
      if (removedIndex !== -1) {
        // Verify that all other elements match after accounting for the removal
        let matches = true;
        for (let i = 0; i < nextSelections.length; i++) {
          const prevIndex = i < removedIndex ? i : i + 1;
          if (!deepEqual(nextSelections[i], prevSelections[prevIndex])) {
            matches = false;
            break;
          }
        }
        if (matches) {
          patches.push(createPatch.removeSelection(removedIndex));
        } else {
          // Complex change, just set the whole array
          patches.push(createPatch.setSelections(nextSelections));
        }
      } else {
        // Couldn't determine the change, set the whole array
        patches.push(createPatch.setSelections(nextSelections));
      }
    }
    // For complex changes, just set the whole array
    else {
      patches.push(createPatch.setSelections(nextSelections));
    }
  }

  // Check isSelecting
  if (!deepEqual(prevState.isSelecting, nextState.isSelecting)) {
    patches.push(createPatch.setIsSelecting(nextState.isSelecting));
  }

  // Check isEditing
  if (!deepEqual(prevState.isEditing, nextState.isEditing)) {
    patches.push(createPatch.setIsEditing(nextState.isEditing));
  }

  // Check isHovering
  if (!deepEqual(prevState.isHovering, nextState.isHovering)) {
    patches.push(createPatch.setIsHovering(nextState.isHovering));
  }

  return patches;
}

/**
 * Gets a value from state using a path
 */
function getValue(state: SelectionManagerState, path: string): any {
  const parts = path.split('/');
  let current: any = state;
  
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  
  return current;
}

/**
 * Sets a value in state using a path (immutably)
 */
function setValue(
  state: SelectionManagerState, 
  path: string, 
  value: boolean | SMArea[] | IsSelecting | IsEditing | IsHovering
): SelectionManagerState {
  const parts = path.split('/');
  
  if (parts.length === 1) {
    const key = parts[0] as keyof SelectionManagerState;
    // Root property
    switch (key) {
      case 'hasFocus':
        return { ...state, hasFocus: value as boolean };
      case 'selections':
        return { ...state, selections: value as SMArea[] };
      case 'isSelecting':
        return { ...state, isSelecting: value as IsSelecting };
      case 'isEditing':
        return { ...state, isEditing: value as IsEditing };
      case 'isHovering':
        return { ...state, isHovering: value as IsHovering };
      default:
        throw new Error(`Unsupported root property: ${key}`);
    }
  }
  
  // For nested properties, we'd need more complex logic
  // For now, handle the common cases
  const [root, ...rest] = parts;
  
  if (root === 'selections' && rest.length === 0) {
    return { ...state, selections: value as SMArea[] };
  }
  
  throw new Error(`Unsupported path: ${path}`);
}

/**
 * Applies patches to a state and returns a new state
 */
export function applyPatches(
  state: SelectionManagerState,
  patches: StatePatch[]
): SelectionManagerState {
  let newState = { ...state };

  for (const patch of patches) {
    switch (patch.op) {
      case "replace":
        newState = setValue(newState, patch.path, patch.value);
        break;
        
      case "add":
        if (patch.path.endsWith('/-')) {
          // Add to end of array
          const arrayPath = patch.path.slice(0, -2);
          const currentArray = getValue(newState, arrayPath) as any[];
          const newArray = [...currentArray, patch.value];
          newState = setValue(newState, arrayPath, newArray);
        } else if (patch.path.includes('/')) {
          // Add at specific index
          const lastSlash = patch.path.lastIndexOf('/');
          const arrayPath = patch.path.slice(0, lastSlash);
          const indexStr = patch.path.slice(lastSlash + 1);
          const index = parseInt(indexStr, 10);
          
          if (arrayPath === 'selections' && !isNaN(index)) {
            const currentArray = [...newState.selections];
            currentArray.splice(index, 0, patch.value);
            newState = { ...newState, selections: currentArray };
          } else {
            throw new Error(`Unsupported add path: ${patch.path}`);
          }
        } else {
          throw new Error(`Unsupported add path: ${patch.path}`);
        }
        break;
        
      case "remove":
        if (patch.path.includes('/')) {
          const lastSlash = patch.path.lastIndexOf('/');
          const arrayPath = patch.path.slice(0, lastSlash);
          const indexStr = patch.path.slice(lastSlash + 1);
          const index = parseInt(indexStr, 10);
          
          if (arrayPath === 'selections' && !isNaN(index)) {
            const currentArray = [...newState.selections];
            currentArray.splice(index, 1);
            newState = { ...newState, selections: currentArray };
          } else {
            throw new Error(`Unsupported remove path: ${patch.path}`);
          }
        } else {
          throw new Error(`Unsupported remove path: ${patch.path}`);
        }
        break;
        
      case "test":
        const currentValue = getValue(newState, patch.path);
        if (!deepEqual(currentValue, patch.value)) {
          throw new Error(`Test failed at path ${patch.path}: expected ${JSON.stringify(patch.value)}, got ${JSON.stringify(currentValue)}`);
        }
        break;
        
      default:
        throw new Error(`Unsupported patch operation: ${(patch as any).op}`);
    }
  }

  return newState;
}

/**
 * Creates a single patch from two states (for backward compatibility)
 * If multiple changes exist, returns the first one
 */
export function buildPatch(
  prevState: SelectionManagerState,
  nextState: SelectionManagerState
): StatePatch {
  const patches = createPatches(prevState, nextState);
  
  if (patches.length === 0) {
    // Return a no-op test patch
    return { op: "test", path: "hasFocus", value: prevState.hasFocus };
  } else {
    const firstPatch = patches[0];
    if (!firstPatch) {
      // This should never happen, but provide a fallback
      return { op: "test", path: "hasFocus", value: prevState.hasFocus };
    }
    return firstPatch;
  }
}
