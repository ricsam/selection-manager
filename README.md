# Selection Manager

A React hook-based selection manager for grid-like interfaces with support for multi-selection, keyboard navigation, and both controlled and uncontrolled modes.

## Features

- 🎯 **Multi-selection support** - Select multiple ranges with Ctrl/Cmd + click
- ⌨️ **Keyboard navigation** - Arrow keys, Shift+arrow for selection extension, Ctrl/Cmd+A for select all
- 🖱️ **Mouse interaction** - Click and drag to select ranges, header clicking for full rows/columns
- ✏️ **Cell editing** - Double-click or F2 to edit cells with automatic keyboard handling
- 🎨 **Visual feedback** - Border management and box shadows for selection visualization
- 📊 **Data export** - Export selected data as TSV format
- ♾️ **Infinite grids** - Support for grids with infinite rows/columns
- 🔄 **Real-time updates** - Event listener-based update system
- ⚡ **High performance** - DOM setup methods for optimal performance in large grids
- 🎛️ **Flexible integration** - Works with React hooks or direct DOM manipulation

## Installation

```bash
bun add selection-manager
```

## Quick Start

```tsx
import React, { useState } from 'react';
import { useInitializeSelectionManager, useSelectionManager } from 'selection-manager';

function MyGrid() {
  const [containerElement, setContainerElement] = useState(null);
  
  // Initialize selection manager with automatic event handling
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 10,
    containerElement
  });
  
  // Subscribe to selection changes
  const { selections, hasFocus } = useSelectionManager(selectionManager, (state) => ({
    selections: state.selections,
    hasFocus: state.hasFocus
  }));
  
  return (
    <div 
      ref={setContainerElement}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      {/* Your grid implementation with automatic event handling */}
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
selectionManager.cellDoubleClick(row, col);  // Start editing

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
const containerBoxShadow = selectionManager.getContainerBoxShadow();

// Get selection borders for custom styling
const borders = selectionManager.selectionBorders({ row: 2, col: 3 });
const currentBorders = selectionManager.currentSelectionBorders({ row: 2, col: 3 });

// Check if in negative selection mode (removing selection)
const isNegative = selectionManager.inNegativeSelection({ row: 2, col: 3 });

// Export selections as TSV
const tsv = selectionManager.selectionToTsv(dataMap);

// Check if any selections exist
const hasSelection = selectionManager.hasSelection();

// Get top-left cell in current selection
const topLeftCell = selectionManager.getTopLeftCellInSelection();

// Cell editing
selectionManager.cellDoubleClick(row, col);  // Start editing cell
selectionManager.cancelEditing();            // Cancel editing
const isEditing = selectionManager.isEditingCell(row, col);  // Check if cell is being edited
```

#### DOM Element Setup (High Performance)
```tsx
// Setup cell with automatic event handling and styling
const cleanupCell = selectionManager.setupCellElement(cellElement, { row: 2, col: 3 });

// Setup header with automatic event handling and styling
const cleanupHeader = selectionManager.setupHeaderElement(headerElement, 2, 'row');

// Setup container with focus/blur and keyboard handling
const cleanupContainer = selectionManager.setupContainerElement(containerElement);

// Always call cleanup when elements are removed
cleanupCell();
cleanupHeader();
cleanupContainer();
```

## Performance Guide

### React Hooks Approach (< 1000 cells)
Best for small to medium grids. Uses `useSelectionManager` with manual event handlers.

**Pros**: Simple, React-idiomatic, easy debugging
**Cons**: Manual event handling, more React re-renders

### DOM Setup Methods (> 1000 cells) ⚡ Recommended for large grids
Best for performance-critical applications. Uses `setupCellElement`/`setupHeaderElement` with memoized callback refs.

**Pros**: Optimal performance, automatic styling, minimal React overhead
**Cons**: Requires individual components, more setup complexity

## Usage Examples

### Basic Grid Implementation

```tsx
import React from 'react';
import { useInitializeSelectionManager, useSelectionManager } from 'selection-manager';

function Grid() {
  const [containerElement, setContainerElement] = useState(null);
  
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 5,
    containerElement
  });

  // Subscribe to selection state
  const { selections, hasFocus } = useSelectionManager(selectionManager, (state) => ({
    selections: state.selections,
    hasFocus: state.hasFocus
  }));

  return (
    <div
      ref={setContainerElement}
      tabIndex={0}
      style={{ outline: 'none' }}
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
    state: selectionState,
    onStateChange: setSelectionState
  });
  
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

### High-Performance Grid (Recommended for large datasets)

```tsx
import React, { useCallback, useState } from 'react';
import { useInitializeSelectionManager } from 'selection-manager';

// Cell component with memoized callback ref for optimal performance
const CellComponent = React.memo(({ row, col, selectionManager }) => {
  // CRITICAL: Use useCallback to prevent ref function from changing on every render
  const cellRef = useCallback((el) => {
    if (el) {
      return selectionManager.setupCellElement(el, { row, col });
    }
  }, [row, col, selectionManager]);

  return (
    <div
      ref={cellRef}
      style={{
        width: 40,
        height: 40,
        border: "1px solid #ddd",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {`${row},${col}`}
    </div>
  );
});

// Header component with memoized callback ref
const HeaderComponent = React.memo(({ index, type, selectionManager }) => {
  const headerRef = useCallback((el) => {
    if (el) {
      return selectionManager.setupHeaderElement(el, index, type);
    }
  }, [index, type, selectionManager]);

  return (
    <div
      ref={headerRef}
      style={{
        width: 40,
        height: 40,
        backgroundColor: "#f0f0f0",
        border: "1px solid #ddd",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold"
      }}
    >
      {index}
    </div>
  );
});

function HighPerformanceGrid() {
  const [containerElement, setContainerElement] = useState(null);
  
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 1000,  // Large grid
    getNumCols: () => 100,
    containerElement
  });

  return (
    <div 
      ref={setContainerElement}
      tabIndex={0}
      style={{ 
        display: "inline-grid", 
        gridTemplateColumns: "repeat(101, 40px)",  // +1 for row headers
        outline: "none"
      }}
    >
      {/* Corner cell */}
      <div style={{ width: 40, height: 40, backgroundColor: "#f5f5f5" }} />
      
      {/* Column headers */}
      {Array.from({ length: 100 }, (_, col) => (
        <HeaderComponent 
          key={`col-${col}`}
          index={col} 
          type="col" 
          selectionManager={selectionManager} 
        />
      ))}
      
      {/* Grid content */}
      {Array.from({ length: 1000 }, (_, row) => [
        // Row header
        <HeaderComponent 
          key={`row-${row}`}
          index={row} 
          type="row" 
          selectionManager={selectionManager} 
        />,
        // Row cells
        ...Array.from({ length: 100 }, (_, col) => (
          <CellComponent 
            key={`${row}-${col}`}
            row={row} 
            col={col} 
            selectionManager={selectionManager} 
          />
        ))
      ])}
    </div>
  );
}
```

**⚠️ Performance Note**: Each cell/header MUST be its own component to get memoized callback refs. Creating callback refs in loops causes constant cleanup/setup cycles and poor performance.

### Cell Editing

```tsx
import React, { useState, useCallback } from 'react';
import { useInitializeSelectionManager, useSelectionManager } from 'selection-manager';

// Editable cell component
const EditableCellComponent = React.memo(({ row, col, selectionManager, data, onCellEdit }) => {
  const cellRef = useCallback((el) => {
    if (el) {
      return selectionManager.setupCellElement(el, { row, col });
    }
  }, [row, col, selectionManager]);

  const isEditing = useSelectionManager(
    selectionManager,
    () => selectionManager.isEditingCell(row, col)
  );

  const cellValue = data.get(`${row},${col}`) || '';

  if (isEditing) {
    return (
      <input
        autoFocus
        defaultValue={cellValue}
        style={{
          width: 40,
          height: 40,
          border: "2px solid #2196F3",
          outline: "none",
          textAlign: "center"
        }}
        onBlur={() => selectionManager.cancelEditing()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onCellEdit(row, col, e.target.value);
            selectionManager.cancelEditing();
          } else if (e.key === 'Escape') {
            selectionManager.cancelEditing();
          }
        }}
      />
    );
  }

  return (
    <div
      ref={cellRef}
      style={{
        width: 40,
        height: 40,
        border: "1px solid #ddd",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {cellValue}
    </div>
  );
});

function EditableGrid() {
  const [containerElement, setContainerElement] = useState(null);
  const [data, setData] = useState(() => {
    const initialData = new Map();
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 5; col++) {
        initialData.set(`${row},${col}`, `${row},${col}`);
      }
    }
    return initialData;
  });

  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 5,
    containerElement
  });

  const handleCellEdit = useCallback((row, col, value) => {
    setData(prev => {
      const newData = new Map(prev);
      newData.set(`${row},${col}`, value);
      return newData;
    });
  }, []);

  return (
    <div 
      ref={setContainerElement}
      tabIndex={0}
      style={{ 
        display: "inline-grid", 
        gridTemplateColumns: "repeat(5, 40px)",
        outline: "none"
      }}
    >
      {Array.from({ length: 10 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => (
          <EditableCellComponent 
            key={`${row}-${col}`}
            row={row} 
            col={col} 
            selectionManager={selectionManager} 
            data={data}
            onCellEdit={handleCellEdit}
          />
        ))
      )}
    </div>
  );
}
```

**Key Features:**
- **Double-click to edit**: Automatically handled by `setupCellElement`
- **F2 keyboard shortcut**: Start editing the top-left selected cell
- **Escape handling**: Cancel editing or clear selections
- **Enter to save**: Complete editing and save changes
- **Auto-focus**: Input automatically focuses when editing starts
- **Keyboard navigation disabled**: While editing, selection navigation is disabled

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

type IsEditing =
  | { type: "none" }
  | { type: "cell"; row: number; col: number };

type SelectionManagerState = {
  hasFocus: boolean;
  selections: SMSelection[];
  isSelecting: IsSelecting;
  isEditing: IsEditing;
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
- `initialState?: Partial<SelectionManagerState>` - Initial state (uncontrolled mode)
- `state?: SelectionManagerState` - Current state (controlled mode)
- `onStateChange?: (state: SelectionManagerState) => void` - State change callback
- `containerElement?: HTMLElement | null` - Element for automatic event handling

**Auto Event Handling:** When `containerElement` is provided, the hook automatically:
- Adds window mouse/keyboard event listeners
- Handles focus/blur when clicking inside/outside container
- Cancels selection on mouseup outside container
- Processes keyboard events when focused
- Updates container styling based on focus state

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

### Advanced State Management

#### `onNextState(callback)`
Subscribe to all state changes (for uncontrolled mode).

```tsx
const cleanup = selectionManager.onNextState((state) => {
  console.log('State changed:', state);
});
// Call cleanup() when done
```

#### `onNewRequestedState(callback)` 
Subscribe to state change requests (for controlled mode). Used internally by `useInitializeSelectionManager`.

```tsx
const cleanup = selectionManager.onNewRequestedState((newState) => {
  // Handle the requested state change in controlled mode
  setControlledState(newState);
});
```

#### `observeStateChange(selector, callback, runInstant?)`
Watch for changes to specific derived state values with automatic cleanup support.

```tsx
// Watch for selection type changes with automatic cleanup
const cleanup = selectionManager.observeStateChange(
  (state) => state.isSelecting.type,
  (type) => {
    if (type !== "none") {
      console.log('Started selecting');
      // Return cleanup function
      return () => console.log('Stopped selecting');
    }
  },
  true  // Run immediately with current state
);
```

## Keyboard Shortcuts

- **Arrow Keys**: Navigate selection (disabled while editing)
- **Shift + Arrow Keys**: Extend selection (disabled while editing)
- **Ctrl/Cmd + Arrow Keys**: Navigate to edge (disabled while editing)
- **Ctrl/Cmd + Shift + Arrow Keys**: Extend selection to edge (disabled while editing)
- **Ctrl/Cmd + A**: Select all (disabled while editing)
- **F2**: Start editing the top-left cell in current selection
- **Escape**: Cancel editing (if editing) or clear selection and remove focus

## Mouse Interactions

- **Click**: Select single cell
- **Double Click**: Start editing cell
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

1. **Choose the right approach**:
   - Use React hooks for small grids (< 1000 cells)
   - Use DOM setup methods for large grids (> 1000 cells)
   
2. **For high performance**:
   - Create individual components for each cell/header
   - Use `React.memo` and `useCallback` for callback refs
   - Avoid creating callback refs in loops or render functions

3. **Always handle focus**: Set up `containerElement` or manual `onFocus`/`onBlur` and `tabIndex` for keyboard navigation

4. **Text selection prevention**: When using `containerElement`, text selection is automatically prevented during drag operations

5. **Handle infinite grids**: Use `Infinity` for dynamic or very large datasets

6. **Optimize re-renders**: Use specific selectors in `useSelectionManager` to minimize re-renders

7. **Export data**: Use `selectionToTsv()` for clipboard or file export functionality

## License

MIT
