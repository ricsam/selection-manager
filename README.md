# Selection Manager

A React hook-based selection manager for grid-like interfaces with support for multi-selection, keyboard navigation, and both controlled and uncontrolled modes.

## Features

- 🎯 **Multi-selection support** - Select multiple ranges with Ctrl/Cmd + click
- ⌨️ **Keyboard navigation** - Arrow keys, Shift+arrow for selection extension, Ctrl/Cmd+A for select all
- 🖱️ **Mouse interaction** - Click and drag to select ranges, header clicking for full rows/columns
- 🎨 **Visual feedback** - Border management and box shadows for selection visualization
- 📊 **Data export** - Export selected data as TSV format
- ♾️ **Infinite grids** - Support for grids with infinite rows/columns
- 🔄 **Real-time updates** - Event listener-based update system

## Installation

```bash
bun add selection-manager
```

## Quick Start

```tsx
import { useInitializeSelectionManager, useSelectionManager } from 'selection-manager';

function MyGrid() {
  // Initialize selection manager
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 10
  });
  
  // Subscribe to selection changes
  const { selections, hasFocus } = useSelectionManager(selectionManager, (state) => ({
    selections: state.selections,
    hasFocus: state.hasFocus
  }));
  
  return (
    <div>
      {/* Your grid implementation */}
    </div>
  );
}
```

## Core API

### Selection Manager Methods

#### Mouse Interaction
```tsx
// Cell interaction
selectionManager.cellMouseDown(row, col, { shiftKey, ctrlKey, metaKey });
selectionManager.cellMouseEnter(row, col);
selectionManager.cellMouseUp(row, col);

// Header interaction (for selecting entire rows/columns)
selectionManager.headerMouseDown(index, 'row' | 'col', { shiftKey, ctrlKey, metaKey });
selectionManager.headerMouseEnter(index, 'row' | 'col');
selectionManager.headerMouseUp(index, 'row' | 'col');
```

#### Keyboard Navigation
```tsx
// Handle keyboard events (arrow keys, Ctrl+A, Escape, etc.)
selectionManager.handleKeyDown(keyboardEvent);
```

#### Focus Management
```tsx
selectionManager.focus();   // Enable keyboard navigation
selectionManager.blur();    // Disable keyboard navigation
```

#### State Queries
```tsx
// Check if cell is selected
const isSelected = selectionManager.isSelected({ row: 2, col: 3 });

// Check if entire row/column is selected
const isRowSelected = selectionManager.isWholeRowSelected(2);
const isColSelected = selectionManager.isWholeColSelected(3);

// Get visual styling
const cellBoxShadow = selectionManager.getCellBoxShadow({ row: 2, col: 3 });
const headerBoxShadow = selectionManager.getHeaderBoxShadow(2, 'row');

// Get selection borders for custom styling
const borders = selectionManager.selectionBorders({ row: 2, col: 3 });
const currentBorders = selectionManager.currentSelectionBorders({ row: 2, col: 3 });

// Check if in negative selection mode (removing selection)
const isNegative = selectionManager.inNegativeSelection({ row: 2, col: 3 });

// Export selections as TSV
const tsv = selectionManager.selectionToTsv(dataMap);

// Check if any selections exist
const hasSelection = selectionManager.hasSelection();
```

## Usage Examples

### Basic Grid Implementation

```tsx
import React from 'react';
import { useInitializeSelectionManager, useSelectionManager } from 'selection-manager';

function Grid() {
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 5
  });

  // Subscribe to selection state
  const { selections, hasFocus } = useSelectionManager(selectionManager, (state) => ({
    selections: state.selections,
    hasFocus: state.hasFocus
  }));

  // Setup keyboard handling
  React.useEffect(() => {
    if (!hasFocus) return;
    
    const handler = (ev: KeyboardEvent) => {
      selectionManager.handleKeyDown(ev);
    };
    
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionManager, hasFocus]);

  return (
    <div
      onFocus={() => selectionManager.focus()}
      onBlur={() => selectionManager.blur()}
      tabIndex={0}
    >
      {/* Column headers */}
      <div style={{ display: 'flex' }}>
        {Array.from({ length: 5 }, (_, col) => (
          <ColumnHeader
            key={col}
            index={col}
            selectionManager={selectionManager}
          />
        ))}
      </div>
      
      {/* Grid rows */}
      {Array.from({ length: 10 }, (_, row) => (
        <div key={row} style={{ display: 'flex' }}>
          <RowHeader
            index={row}
            selectionManager={selectionManager}
          />
          {Array.from({ length: 5 }, (_, col) => (
            <Cell
              key={`${row}-${col}`}
              row={row}
              col={col}
              selectionManager={selectionManager}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Cell({ row, col, selectionManager }) {
  const { isSelected, boxShadow } = useSelectionManager(selectionManager, (state) => ({
    isSelected: selectionManager.isSelected({ row, col }),
    boxShadow: selectionManager.getCellBoxShadow({ row, col })
  }));

  return (
    <div
      style={{
        width: 100,
        height: 30,
        border: '1px solid #ccc',
        backgroundColor: isSelected ? '#e3f2fd' : 'white',
        boxShadow,
        cursor: 'pointer'
      }}
      onMouseDown={(e) => {
        selectionManager.cellMouseDown(row, col, {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });
      }}
      onMouseEnter={() => {
        selectionManager.cellMouseEnter(row, col);
      }}
      onMouseUp={() => {
        selectionManager.cellMouseUp(row, col);
      }}
    >
      {row},{col}
    </div>
  );
}

function RowHeader({ index, selectionManager }) {
  const { isSelected, boxShadow } = useSelectionManager(selectionManager, (state) => ({
    isSelected: selectionManager.isWholeRowSelected(index),
    boxShadow: selectionManager.getHeaderBoxShadow(index, 'row')
  }));

  return (
    <div
      style={{
        width: 50,
        height: 30,
        border: '1px solid #ccc',
        backgroundColor: isSelected ? '#e3f2fd' : '#f5f5f5',
        boxShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }}
      onMouseDown={(e) => {
        selectionManager.headerMouseDown(index, 'row', {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });
      }}
      onMouseEnter={() => {
        selectionManager.headerMouseEnter(index, 'row');
      }}
      onMouseUp={() => {
        selectionManager.headerMouseUp(index, 'row');
      }}
    >
      {index}
    </div>
  );
}

function ColumnHeader({ index, selectionManager }) {
  const { isSelected, boxShadow } = useSelectionManager(selectionManager, (state) => ({
    isSelected: selectionManager.isWholeColSelected(index),
    boxShadow: selectionManager.getHeaderBoxShadow(index, 'col')
  }));

  return (
    <div
      style={{
        width: 100,
        height: 30,
        border: '1px solid #ccc',
        backgroundColor: isSelected ? '#e3f2fd' : '#f5f5f5',
        boxShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }}
      onMouseDown={(e) => {
        selectionManager.headerMouseDown(index, 'col', {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });
      }}
      onMouseEnter={() => {
        selectionManager.headerMouseEnter(index, 'col');
      }}
      onMouseUp={() => {
        selectionManager.headerMouseUp(index, 'col');
      }}
    >
      {String.fromCharCode(65 + index)}
    </div>
  );
}
```

### Controlled Mode

```tsx
function ControlledGrid() {
  const [selectionState, setSelectionState] = useState<SelectionManagerState>({
    selections: [],
    hasFocus: false,
    isSelecting: { type: "none" }
  });
  
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 5,
    controlled: true
  });

  // Listen for changes and update state
  React.useEffect(() => {
    return selectionManager.listen((state) => {
      setSelectionState(state);
    });
  }, [selectionManager]);

  // Apply state to manager
  React.useEffect(() => {
    selectionManager.setState(selectionState);
  }, [selectionManager, selectionState]);
  
  return <Grid selectionManager={selectionManager} />;
}
```

### Data Export

```tsx
function ExportExample() {
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 5
  });

  const exportSelection = () => {
    // Create data map (row,col -> value)
    const dataMap = new Map<string, unknown>();
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 5; col++) {
        dataMap.set(`${row},${col}`, `Cell ${row},${col}`);
      }
    }

    const tsv = selectionManager.selectionToTsv(dataMap);
    console.log('Exported TSV:', tsv);
  };

  return (
    <div>
      <Grid selectionManager={selectionManager} />
      <button onClick={exportSelection}>Export Selection as TSV</button>
    </div>
  );
}
```

## API Reference

### Types

```tsx
type SMSelection = {
  start: { row: number; col: number };
  end: { row: number; col: number };
};

type IsSelecting =
  | { type: "none" }
  | (SMSelection & { type: "drag" | "add" | "remove" | "shift" });

type SelectionManagerState = {
  hasFocus: boolean;
  selections: SMSelection[];
  isSelecting?: IsSelecting;
};

type KeyboardEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
};
```

### Hooks

#### `useInitializeSelectionManager(options)`

Creates and returns a `SelectionManager` instance.

**Parameters:**
- `getNumRows?: () => number` - Function returning the number of rows (default: `() => Infinity`)
- `getNumCols?: () => number` - Function returning the number of columns (default: `() => Infinity`)
- `controlled?: boolean` - Whether to use controlled mode (default: `false`)

**Returns:**
- `SelectionManager` - The selection manager instance

#### `useSelectionManager(selectionManager, selector, areEqual?)`

Subscribes to selection manager state changes and returns selected data.

**Parameters:**
- `selectionManager: SelectionManager` - The selection manager instance
- `selector: (state: SelectionManagerState) => T` - Function to select specific data from state
- `areEqual?: (a: T, b: T) => boolean` - Custom equality function (default: shallow equal)

**Returns:**
- `T` - The selected data from the state

## Keyboard Shortcuts

- **Arrow Keys**: Navigate selection
- **Shift + Arrow Keys**: Extend selection
- **Ctrl/Cmd + Arrow Keys**: Navigate to edge
- **Ctrl/Cmd + Shift + Arrow Keys**: Extend selection to edge
- **Ctrl/Cmd + A**: Select all
- **Escape**: Clear selection and remove focus

## Mouse Interactions

- **Click**: Select single cell
- **Click + Drag**: Select range
- **Ctrl/Cmd + Click**: Add/remove selection
- **Shift + Click**: Extend selection
- **Header Click**: Select entire row/column
- **Ctrl/Cmd + Header Click**: Add/remove row/column selection

## Visual Styling

The selection manager provides box shadows for visual feedback:

- **Blue borders** (`#2196F3`): Committed selections
- **Gray borders** (`#c5b4b3`): Current selection being made
- **Green borders** (`#9ec299`): Active row/column headers during selection

Use `getCellBoxShadow()` and `getHeaderBoxShadow()` to apply these styles to your components.

## Best Practices

1. **Always handle focus**: Set up `onFocus`/`onBlur` and `tabIndex` for keyboard navigation
2. **Prevent text selection**: Add `user-select: none` CSS to prevent text selection during dragging
3. **Handle infinite grids**: Use `Infinity` for dynamic or very large datasets
4. **Optimize re-renders**: Use specific selectors in `useSelectionManager` to minimize re-renders
5. **Export data**: Use `selectionToTsv()` for clipboard or file export functionality

## License

MIT
