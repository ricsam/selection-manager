# 🎯 Selection Manager

> A powerful React hook-based selection manager that makes building spreadsheet-like interfaces a breeze! ✨

Transform any grid into an Excel-like powerhouse with intuitive multi-selection, keyboard navigation, copy/paste operations, and blazing-fast performance. Whether you're building the next Google Sheets or just need some fancy data tables, SelectionManager has got you covered! 🚀

## ✨ Features That'll Make You Smile

- 🎯 **Multi-selection magic** - Select ranges like a pro with Ctrl/Cmd + click
- ⌨️ **Keyboard ninja mode** - Arrow keys, shortcuts, and everything you'd expect
- 🖱️ **Mouse interactions** - Click, drag, double-click to edit - it just works!
- ✏️ **Cell editing** - F2 or double-click for instant editing with smart keyboard handling
- 🎨 **Visual feedback** - Beautiful borders and shadows that make selections pop
- 🖱️ **Hover detection** - Know exactly which cells and headers users are hovering over
- 🔗 **Merged cell support** - Handle grouped/merged cells like a real spreadsheet
- 🎯 **Fill handle** - Excel-style drag-to-fill functionality for extending data patterns
- 📊 **Data export** - Copy/paste TSV like you're in Excel (because why not?)
- ♾️ **Infinite grids** - Go crazy with millions of rows and columns
- 🔄 **Real-time updates** - Everything stays in sync, always
- ⚡ **Stupid fast** - Optimized for grids with thousands of cells
- 🎛️ **Flexible as yoga** - Works with React hooks or raw DOM manipulation

## 🚀 Quick Install

```bash
# Using bun (because it's fast!)
bun add selection-manager

# Or your favorite package manager
npm install selection-manager
yarn add selection-manager
pnpm add selection-manager
```

**📦 What's included:**
```typescript
import { 
  // Main hooks
  useInitializeSelectionManager, 
  useSelectionManager,
  
  // Core class
  SelectionManager,
  
  // Utility functions
  parseCSVContent,
  writeToClipboard,
  
  // Types
  type CellData,
  type SMSelection,
  type SelectionManagerState
} from 'selection-manager';
```

## 🎮 Quick Start - Let's Build Something Cool!

Here's how to get started in less than 5 minutes:

```tsx
import React, { useState } from 'react';
import { useInitializeSelectionManager, useSelectionManager } from 'selection-manager';

function MyAwesomeGrid() {
  const [containerElement, setContainerElement] = useState(null);
  
  // 🎉 This one hook does all the heavy lifting!
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,      // Your grid size
    getNumCols: () => 10,
    containerElement           // Auto-magic event handling!
  });
  
  // 📡 Subscribe to selection changes (React-style!)
  const { selections, hasFocus, boxShadow } = useSelectionManager(selectionManager, () => ({
    selections: selectionManager.selections,
    hasFocus: selectionManager.hasFocus,
    boxShadow: selectionManager.getCellBoxShadow({ row, col }),
  }));
  
  return (
    <div 
      ref={setContainerElement}
      style={{ 
        outline: 'none',
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 60px)',
        gap: '1px',
        padding: '20px',
        backgroundColor: '#f5f5f5'
      }}
    >
      {Array.from({ length: 100 }, (_, i) => {
        const row = Math.floor(i / 10);
        const col = i % 10;
        const isSelected = selectionManager.isSelected({ row, col });
        
        return (
          <div
            key={i}
            style={{
              height: '40px',
              backgroundColor: isSelected ? '#e3f2fd' : 'white',
              border: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              // ✨ Magic selection borders!
              boxShadow
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
          >
            {row},{col}
          </div>
        );
      })}
    </div>
  );
}
```

**🎊 That's it!** You now have a fully functional grid with:
- ✅ Click and drag selection
- ✅ Ctrl/Cmd+click for multi-selection  
- ✅ Shift+click to extend selections
- ✅ Arrow key navigation
- ✅ Ctrl/Cmd+A to select all
- ✅ Beautiful visual feedback

## 🎨 Core Concepts Made Simple

### 🎯 The SelectionManager - Your New Best Friend

Think of `SelectionManager` as the brain of your grid. It knows what's selected, handles all the complex mouse/keyboard logic, and gives you simple methods to query and manipulate selections.

```tsx
// 🧠 The brain that does it all
const selectionManager = useInitializeSelectionManager({
  getNumRows: () => 1000,      // Can be dynamic!
  getNumCols: () => 50,        // Even Infinity works!
  containerElement             // Pass this for auto-magic
});

// 🔍 Ask it anything about selections
const isSelected = selectionManager.isSelected({ row: 5, col: 3 });
const allSelected = selectionManager.isAllSelected();
const topLeftCell = selectionManager.getTopLeftCellInSelection();
```

### 🎪 Mouse Interactions - Click, Drag, Repeat

Every mouse interaction has a purpose:

- **👆 Click**: Select single cell
- **👆👆 Double Click**: Start editing (like Excel!)
- **🖱️ Click + Drag**: Select rectangular range
- **⌘ + Click**: Add or remove from selection (multi-select!)
- **⇧ + Click**: Extend current selection
- **📊 Header Click**: Select entire row or column

### ⌨️ Keyboard Shortcuts - For the Power Users

We've got all the shortcuts you expect (and they're smart about editing mode):

| Shortcut | Action | Available When |
|----------|--------|----------------|
| `Arrow Keys` | Navigate selection | Not editing |
| `Shift + Arrows` | Extend selection | Not editing |
| `Ctrl/Cmd + A` | Select all | Not editing |
| `Ctrl/Cmd + C` | Copy selection | Not editing |
| `Ctrl/Cmd + X` | Cut selection | Not editing |
| `Delete/Backspace` | Clear cells | Not editing |
| `F2` | Start editing | Always |
| `Escape` | Cancel editing or clear selection | Always |

### 🎨 Visual Magic - Borders That Make Sense

SelectionManager automatically generates beautiful CSS for you:

- **🔵 Blue borders**: Your committed selections
- **⚫ Gray borders**: The selection you're currently making
- **🟢 Green borders**: Active row/column headers
- **🤎 Brown borders**: Cells and headers being hovered

```tsx
// ✨ Just apply the magic CSS!
<div style={{ 
  boxShadow: useSelectionManager(selectionManager, () => selectionManager.getCellBoxShadow({ row, col }))
}}>
  My Cell
</div>
```

## 🏗️ Real-World Examples

### 📊 Building a Data Table with Headers

```tsx
import React, { useState } from 'react';
import { useInitializeSelectionManager, useSelectionManager } from 'selection-manager';

function DataTable({ data }) {
  const [containerElement, setContainerElement] = useState(null);
  
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => data.length,
    getNumCols: () => data[0]?.length || 0,
    containerElement
  });

  return (
    <div 
      ref={setContainerElement}
      className="data-table"
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      {/* 📋 Column headers */}
      <div className="header-row">
        <div className="corner-cell" />
        {data[0]?.map((_, colIndex) => (
          <ColumnHeader 
            key={colIndex}
            index={colIndex}
            selectionManager={selectionManager}
          />
        ))}
      </div>
      
      {/* 📊 Data rows */}
      {data.map((row, rowIndex) => (
        <div key={rowIndex} className="data-row">
          <RowHeader 
            index={rowIndex}
            selectionManager={selectionManager}
          />
          {row.map((cellData, colIndex) => (
            <DataCell
              key={`${rowIndex}-${colIndex}`}
              row={rowIndex}
              col={colIndex}
              data={cellData}
              selectionManager={selectionManager}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// 🏷️ Smart column header component
function ColumnHeader({ index, selectionManager }) {
  const isSelected = useSelectionManager(
    selectionManager, 
    () => selectionManager.isWholeColSelected(index)
  );

  return (
    <div
      className={`column-header ${isSelected ? 'selected' : ''}`}
      style={{
        boxShadow: selectionManager.getHeaderBoxShadow(index, 'col')
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
    >
      {String.fromCharCode(65 + index)} {/* A, B, C... */}
    </div>
  );
}

// 🔢 Smart row header component  
function RowHeader({ index, selectionManager }) {
  const isSelected = useSelectionManager(
    selectionManager,
    () => selectionManager.isWholeRowSelected(index)
  );

  return (
    <div
      className={`row-header ${isSelected ? 'selected' : ''}`}
      style={{
        boxShadow: selectionManager.getHeaderBoxShadow(index, 'row')
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
    >
      {index + 1}
    </div>
  );
}
```

### ✏️ Editable Spreadsheet Experience

```tsx
function EditableSpreadsheet() {
  const [data, setData] = useState(() => {
    // 🎲 Generate some demo data
    const grid = new Map();
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 10; col++) {
        grid.set(`${row},${col}`, `Cell ${row},${col}`);
      }
    }
    return grid;
  });

  const [containerElement, setContainerElement] = useState(null);
  
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 20,
    getNumCols: () => 10,
    containerElement
  });

  // 📋 Handle copy operations like a pro
  useEffect(() => {
    return selectionManager.listenToCopy((isCut) => {
      const boundingRect = selectionManager.getSelectionsBoundingRect();
      if (!boundingRect) return;

      // 🧮 Create a proper grid for export
      const height = boundingRect.end.row - boundingRect.start.row + 1;
      const width = boundingRect.end.col - boundingRect.start.col + 1;
      const exportGrid = Array(height).fill(null).map(() => Array(width).fill(""));

      // 🎯 Fill only the selected cells
      selectionManager.forEachSelectedCell(({ absolute, relative }) => {
        const value = data.get(`${absolute.row},${absolute.col}`) || "";
        exportGrid[relative.row][relative.col] = value;
      });

      // 📋 Copy to clipboard as TSV (Excel-compatible!)
      const tsvString = exportGrid.map(row => row.join('\t')).join('\n');
      navigator.clipboard.writeText(tsvString);
      
      if (isCut) {
        // 🗑️ Clear the cut cells
        selectionManager.getNonOverlappingSelections().forEach(selection => {
          for (let row = selection.start.row; row <= selection.end.row; row++) {
            for (let col = selection.start.col; col <= selection.end.col; col++) {
              setData(prev => {
                const newData = new Map(prev);
                newData.set(`${row},${col}`, "");
                return newData;
              });
            }
          }
        });
      }
    });
  }, [data, selectionManager]);

  // 📋 Handle paste operations - REQUIRED for paste to work!
  useEffect(() => {
    return selectionManager.listenToPaste((updates) => {
      // The clipboard content has been parsed and positioned at the current selection
      // You must save these updates to make paste work:
      selectionManager.saveCellValues(updates);
    });
  }, [selectionManager]);

  // 📝 Handle data updates (from cell editing, paste, etc.)
  useEffect(() => {
    return selectionManager.listenToUpdateData((updates) => {
      setData(prev => {
        const newData = new Map(prev);
        updates.forEach(({ rowIndex, colIndex, value }) => {
          newData.set(`${rowIndex},${colIndex}`, value);
        });
        return newData;
      });
    });
  }, [selectionManager]);

  // 🎯 Custom CSV import example
  const handleCsvImport = (csvText: string) => {
    const cellData = parseCSVContent(csvText);
    const topLeft = selectionManager.getTopLeftCellInSelection() || { row: 0, col: 0 };
    
    // Import at current selection position
    setData(prev => {
      const newData = new Map(prev);
      cellData.forEach(({ rowIndex, colIndex, value }) => {
        const targetRow = topLeft.row + rowIndex;
        const targetCol = topLeft.col + colIndex;
        newData.set(`${targetRow},${targetCol}`, value);
      });
      return newData;
    });
  };



  return (
    <div className="spreadsheet-container">
      <div className="toolbar">
        <button onClick={() => {
          const tsv = selectionManager.selectionToTsv(data);
          console.log('📊 Exported data:', tsv);
        }}>
          📊 Export Selection
        </button>
        <span className="selection-info">
          {selectionManager.hasSelection() ? 
            `Selected: ${selectionManager.getState().selections.length} range(s)` : 
            'No selection'}
        </span>
      </div>
      
      <div 
        ref={setContainerElement}
        className="spreadsheet-grid"
        tabIndex={0}
      >
        {Array.from({ length: 20 }, (_, row) =>
          Array.from({ length: 10 }, (_, col) => (
            <EditableCell
              key={`${row}-${col}`}
              row={row}
              col={col}
              data={data}
              selectionManager={selectionManager}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ✏️ A cell that can be edited
const EditableCell = React.memo(({ row, col, data, selectionManager }) => {
  const isEditing = useSelectionManager(
    selectionManager,
    () => selectionManager.isEditingCell(row, col)
  );
  
  const isHovering = useSelectionManager(
    selectionManager,
    () => selectionManager.isHoveringCell(row, col)
  );
  
  const cellValue = data.get(`${row},${col}`) || '';

  if (isEditing) {
    return (
      <input
        className="cell-editor"
        autoFocus
        defaultValue={cellValue}  // 🔑 Use defaultValue, not value!
        onBlur={() => selectionManager.cancelEditing()}  // 🔥 Always cancel on blur
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // 💾 Save using saveCellValue - triggers listenToUpdateData!
            selectionManager.saveCellValue(
              { rowIndex: row, colIndex: col },
              e.target.value
            );
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
      className={`spreadsheet-cell ${isHovering ? 'hovering' : ''}`}
      style={{
        boxShadow: selectionManager.getCellBoxShadow({ row, col }),
        // 🖱️ You can add custom hover styling too!
        cursor: isHovering ? 'pointer' : 'default'
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
      onDoubleClick={() => {
        selectionManager.cellDoubleClick(row, col);
      }}
    >
      {cellValue}
    </div>
  );
});
```

### 🚀 High-Performance Grid (For the Speed Demons)

When you need to handle thousands of cells, use the DOM setup approach for maximum performance:

```tsx
import React, { useCallback, useState } from 'react';

// 🏎️ Optimized cell component
const HighPerformanceCell = React.memo(({ row, col, selectionManager, data }) => {
  // 🔑 Critical: useCallback prevents ref recreation
  const cellRef = useCallback((el) => {
    if (el) {
      // ✨ This does ALL the work for you:
      // - Event listeners
      // - Style updates
      // - State synchronization
      return selectionManager.setupCellElement(el, { row, col });
    }
  }, [row, col, selectionManager]);

  return (
    <div
      ref={cellRef}
      className="performance-cell"
      style={{
        width: 60,
        height: 30,
        border: "1px solid #e0e0e0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        cursor: "pointer",
        backgroundColor: "white"
      }}
    >
      {data.get(`${row},${col}`) || `${row},${col}`}
    </div>
  );
});

function MassiveGrid() {
  const [containerElement, setContainerElement] = useState(null);
  const [data] = useState(() => {
    // 🎲 Generate 50,000 cells of data
    const grid = new Map();
    for (let row = 0; row < 500; row++) {
      for (let col = 0; col < 100; col++) {
        grid.set(`${row},${col}`, Math.floor(Math.random() * 1000));
      }
    }
    return grid;
  });
  
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 500,
    getNumCols: () => 100,
    containerElement
  });

  return (
    <div className="massive-grid-container">
      <h2>🚀 50,000 Cells - Still Smooth as Butter!</h2>
      <div 
        ref={setContainerElement}
        tabIndex={0}
        style={{ 
          display: "grid",
          gridTemplateColumns: "repeat(100, 60px)",
          gap: "0",
          height: "400px",
          overflow: "auto",
          outline: "none",
          border: "2px solid #ddd"
        }}
      >
        {Array.from({ length: 500 }, (_, row) =>
          Array.from({ length: 100 }, (_, col) => (
            <HighPerformanceCell 
              key={`${row}-${col}`}
              row={row} 
              col={col} 
              selectionManager={selectionManager}
              data={data}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

### 🎮 Controlled Mode - Take Full Control

Sometimes you want to manage the selection state yourself:

```tsx
function ControlledExample() {
  const [selectionState, setSelectionState] = useState({
    selections: [],
    hasFocus: false,
    isSelecting: { type: "none" },
    isEditing: { type: "none" }
  });
  
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 10,
    getNumCols: () => 10,
    state: selectionState,           // 🎛️ You control the state
    onStateChange: setSelectionState // 📡 Get notified of changes
  });

  // 🎯 Now you can manipulate selections programmatically!
  const selectTopLeftCorner = () => {
    setSelectionState(prev => ({
      ...prev,
      selections: [{ start: { row: 0, col: 0 }, end: { row: 2, col: 2 } }]
    }));
  };

  const clearAllSelections = () => {
    setSelectionState(prev => ({
      ...prev,
      selections: []
    }));
  };

  const clearHovering = () => {
    // 🖱️ Clear any hovering state programmatically
    selectionManager.cancelHovering();
  };

  return (
    <div>
      <div className="controls">
        <button onClick={selectTopLeftCorner}>
          🎯 Select Top-Left 3x3
        </button>
        <button onClick={clearAllSelections}>
          🧹 Clear All
        </button>
        <button onClick={clearHovering}>
          🖱️ Clear Hover
        </button>
      </div>
      <Grid selectionManager={selectionManager} />
    </div>
  );
}
```

## 🧠 Deep Dive: API Reference

### 🎯 Core Types (TypeScript Goodness)

```typescript
// 📐 A selection is just a rectangle
type SMSelection = {
  start: { row: number; col: number };
  end: { row: number; col: number };
};

// 🎪 What kind of selection is happening?
type IsSelecting =
  | { type: "none" }                           // Nothing happening
  | { type: "drag"; ...SMSelection }           // Normal drag selection
  | { type: "add"; ...SMSelection }            // Ctrl+click adding
  | { type: "remove"; ...SMSelection }         // Ctrl+click removing
  | { type: "shift"; ...SMSelection };         // Shift+click extending

// ✏️ Editing state
type IsEditing =
  | { type: "none" }                           // Not editing
  | { type: "cell"; row: number; col: number }; // Editing this cell

// 🧠 The complete state
type SelectionManagerState = {
  hasFocus: boolean;        // Is the grid focused?
  selections: SMSelection[]; // All current selections
  isSelecting: IsSelecting; // Current selection operation
  isEditing: IsEditing;     // Current editing state
  isHovering: IsHovering;   // Current hovering state
};

// 🖱️ Hovering state
type IsHovering =
  | { type: "none" }                                    // Not hovering
  | { type: "cell"; row: number; col: number }          // Hovering over this cell
  | { type: "group"; group: SMArea }                    // Hovering over merged cell group
  | { type: "header"; index: number; headerType: "row" | "col" }; // Hovering over header
```

### 🎨 Visual Styling Methods

```typescript
// ✨ Get beautiful CSS for your cells
const cellShadow = selectionManager.getCellBoxShadow({ row: 2, col: 3 });
const headerShadow = selectionManager.getHeaderBoxShadow(2, 'row');
const containerShadow = selectionManager.getContainerBoxShadow();

// 🎨 Or build your own with border information
const borders = selectionManager.selectionBorders({ row: 2, col: 3 });
// Returns: Array<"left" | "right" | "top" | "bottom">
```

### 🔍 Selection Query Methods

```typescript
// 🤔 Is this cell selected?
const isSelected = selectionManager.isSelected({ row: 5, col: 3 });

// 📊 Is this entire row/column selected?
const rowSelected = selectionManager.isWholeRowSelected(5);
const colSelected = selectionManager.isWholeColSelected(3);

// 🌍 Is everything selected?
const allSelected = selectionManager.isAllSelected();

// 🎯 Where's the action happening?
const topLeft = selectionManager.getTopLeftCellInSelection();

// 📐 What's the smallest box containing all selections?
const boundingRect = selectionManager.getSelectionsBoundingRect();

// 🧮 Break down overlapping selections
const cleanSelections = selectionManager.getNonOverlappingSelections();

// 🔄 Iterate through every selected cell
selectionManager.forEachSelectedCell(({ absolute, relative }) => {
  console.log(`Cell ${absolute.row},${absolute.col} -> Grid pos ${relative.row},${relative.col}`);
});

// 🖱️ Is this cell being hovered?
const isHovering = selectionManager.isHoveringCell(row, col);

// 🧹 Cancel any hovering state
selectionManager.cancelHovering();

// 💾 Save a cell value (triggers listenToUpdateData listeners)
selectionManager.saveCellValue(
  { rowIndex: 2, colIndex: 3 }, 
  "New Value"
);

// 💾 Save multiple cell values at once
selectionManager.saveCellValues([
  { rowIndex: 0, colIndex: 0, value: "A1" },
  { rowIndex: 0, colIndex: 1, value: "B1" },
  { rowIndex: 1, colIndex: 0, value: "A2" }
]);

// 🔗 Group/merged cell operations
const group = selectionManager.findGroupContainingCell({ row: 2, col: 3 });
const isHoveringGroup = selectionManager.isHoveringGroup(group);
const groupShadow = selectionManager.getBoxShadow({ color: '#4CAF50' });

// 🎯 Fill handle operations
const canShowFillHandle = selectionManager.canCellHaveFillHandle({ row: 2, col: 3 });
const fillBaseSelection = selectionManager.getFillHandleBaseSelection();
```

### ✏️ Cell Editing Best Practices

When implementing cell editing, follow these patterns for the best user experience:

```typescript
// 🔑 Key editing patterns
const EditingCell = ({ row, col, selectionManager, initialValue }) => {
  return (
    <input
      autoFocus                    // 🎯 Focus immediately
      defaultValue={initialValue}  // 🔑 Use defaultValue, NOT value
      onBlur={() => {
        // 🔥 Always cancel on blur
        selectionManager.cancelEditing();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // 💾 Save and exit - this triggers listenToUpdateData listeners!
          selectionManager.saveCellValue(
            { rowIndex: row, colIndex: col },
            e.target.value
          );
          selectionManager.cancelEditing();
        } else if (e.key === 'Escape') {
          // ⏭️ Cancel without saving
          selectionManager.cancelEditing();
        }
      }}
      style={{
        width: "100%",
        height: "100%", 
        border: "none",
        outline: "none",
        backgroundColor: "transparent",
        textAlign: "center"
      }}
    />
  );
};
```

**🎯 Key Takeaways:**

1. **`defaultValue` not `value`**: Use `defaultValue` for better performance and to avoid React warnings
2. **Always handle `onBlur`**: Cancel editing when the user clicks away
3. **Use `saveCellValue()`**: This method automatically triggers all `listenToUpdateData` listeners
4. **Handle Enter and Escape**: Standard spreadsheet behavior users expect

### 🎯 Fill Handle - Excel-Style Data Extension

The fill handle lets users drag from the bottom-right corner of a selection to extend data patterns, just like in Excel:

```tsx
function CellWithFillHandle({ row, col, selectionManager, data }) {
  const canHaveFillHandle = useSelectionManager(
    selectionManager,
    () => selectionManager.canCellHaveFillHandle({ row, col })
  );

  return (
    <div
      className="cell"
      onMouseDown={(e) => {
        const isFillHandle = 
          e.target instanceof HTMLElement &&
          (e.target.hasAttribute("data-fill-handle") ||
           e.target.querySelector("[data-fill-handle]") !== null);

        selectionManager.cellMouseDown(row, col, {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          isFillHandle  // 🔑 Key parameter for fill handle detection
        });
      }}
      // ... other props
    >
      {/* Your cell content */}
      Cell content here
      
      {/* 🎯 Fill handle - only shows on bottom-right cell of selection */}
      {canHaveFillHandle && (
        <div
          data-fill-handle={true}  // 🔑 Required attribute
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 8,
            height: 8,
            backgroundColor: "blue",
            cursor: "crosshair",  // Excel-style cursor
          }}
        />
      )}
    </div>
  );
}

// 🎧 Listen for fill operations
React.useEffect(() => {
  return selectionManager.listenToFill((baseSelection, fillArea) => {
    console.log("Fill operation:", { from: baseSelection, to: fillArea });
    
    // Implement your fill logic here
    // Example: extend patterns, copy data, generate sequences, etc.
    const updates = generateFillData(baseSelection, fillArea);
    selectionManager.saveCellValues(updates);
  });
}, [selectionManager]);
```

**🎯 Key Fill Handle Features:**

1. **Automatic detection**: Use `canCellHaveFillHandle()` to check if a cell should show the handle
2. **Visual feedback**: Fill operations show with red borders during drag
3. **Smart direction**: Automatically detects row-wise vs column-wise fill based on drag direction
4. **Event driven**: Use `listenToFill()` to implement your own data extension logic
5. **Excel-like UX**: Familiar crosshair cursor and bottom-right corner positioning

**🎨 Fill Handle Styling:**

```tsx
// The fill handle gets special styling during drag operations
const cellBoxShadow = selectionManager.getCellBoxShadow({ row, col });
// During fill operations, this returns red borders instead of blue

// You can also detect fill mode programmatically
const isFillMode = selectionManager.isSelecting.type === "fill";
```

### 🔗 Merged Cell Groups (Advanced)

For spreadsheet-like applications with merged cells, SelectionManager supports grouped cells:

```typescript
const selectionManager = useInitializeSelectionManager({
  getNumRows: () => 10,
  getNumCols: () => 5,
  // 🔗 Define merged cell areas  
  getGroups: () => {
    // Return areas that should be treated as merged cells
    return [
      { start: { row: 1, col: 1 }, end: { row: 2, col: 3 } }, // 2x3 merged area
      { start: { row: 5, col: 0 }, end: { row: 5, col: 4 } }, // Merged row
    ];
  }
});

// 🎯 Usage in components
const GroupedCell = ({ row, col, group, selectionManager }) => {
  // Only render content in the top-left cell of a group
  const isTopLeft = group && group.start.row === row && group.start.col === col;
  
  const groupBoxShadow = useSelectionManager(selectionManager, () => {
    return (
      group &&
      selectionManager.isHoveringGroup(group) &&
      selectionManager.getBoxShadow({ color: '#4CAF50' })
    ) || undefined;
  });

  if (group && !isTopLeft) {
    // Hidden cells in merged group
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div
      style={{
        // Span multiple cells if this is a group
        gridRowStart: row + 1,
        gridRowEnd: group ? group.end.row + 2 : row + 2,
        gridColumnStart: col + 1, 
        gridColumnEnd: group ? group.end.col + 2 : col + 2,
        boxShadow: groupBoxShadow,
        border: '1px solid #ddd',
        padding: '8px'
      }}
    >
      {group ? `Merged ${group.end.row - group.start.row + 1}x${group.end.col - group.start.col + 1}` : `${row},${col}`}
    </div>
  );
};
```

**🎯 Key Patterns:**

- **Dynamic groups**: `getGroups()` can return different areas based on data
- **Hover detection**: Use `isHoveringGroup(group)` to detect group hovers
- **Custom styling**: Use `getBoxShadow()` for group-specific visual feedback

### 🛠️ Utility Functions

SelectionManager exports helpful utility functions for data handling:

```typescript
import { parseCSVContent, writeToClipboard, type CellData } from 'selection-manager';

// 📊 Parse CSV/TSV content into cell data format
type CellData = {
  rowIndex: number;
  colIndex: number;
  value: string;
};

const csvData = "Name,Age,City\nJohn,25,NYC\nJane,30,LA";
const cells: CellData[] = parseCSVContent(csvData);
// Returns: [
//   { rowIndex: 0, colIndex: 0, value: "Name" },
//   { rowIndex: 0, colIndex: 1, value: "Age" },
//   { rowIndex: 0, colIndex: 2, value: "City" },
//   { rowIndex: 1, colIndex: 0, value: "John" },
//   ...
// ]

// 📋 Write data to clipboard (with fallback for older browsers)
writeToClipboard("Hello\tWorld\nFoo\tBar");  // TSV format
```

**🎯 Smart Parsing Features:**

- **Auto-delimiter detection**: Prefers tabs > commas > spaces
- **Formatted numbers**: Handles "1,234.56" as single values, not CSV
- **Quote handling**: Properly parses quoted CSV fields
- **Cross-browser clipboard**: Fallback for older browsers

### 📋 Data Operations (Copy/Paste Magic)

```typescript
// 📋 Export selections as TSV
const dataMap = new Map([
  ["0,0", "Hello"],
  ["0,1", "World"],
  ["1,0", "42"],
  ["1,1", "🎉"]
]);
const tsv = selectionManager.selectionToTsv(dataMap);
// Returns: "Hello\tWorld\n42\t🎉" (only selected cells)

// 🎧 Listen for user actions
const unsubscribeCopy = selectionManager.listenToCopy(() => {
  console.log("User copied/cut data");
});

// 📋 Listen for paste operations - REQUIRED for paste to work!
const unsubscribePaste = selectionManager.listenToPaste((updates) => {
  // updates: Array<{ rowIndex: number; colIndex: number; value: string }>
  // The clipboard content has been parsed and positioned at the current selection
  // You must handle these updates, typically by saving them:
  selectionManager.saveCellValues(updates);
});

const unsubscribeData = selectionManager.listenToUpdateData((data) => {
  console.log("Data updated:", data);
  // data: Array<{ rowIndex: number; colIndex: number; value: string }>
  // This fires for: cell editing, paste operations, file drops, and manual saves
});

const unsubscribeFill = selectionManager.listenToFill((baseSelection, fillArea) => {
  console.log("Fill operation:", { from: baseSelection, to: fillArea });
  // baseSelection: The original selected area being extended from
  // fillArea: The new area being filled (includes direction and extent)
  
  // Implement your fill logic: copy data, extend patterns, generate sequences, etc.
  const fillUpdates = generateDataForFillArea(baseSelection, fillArea);
  selectionManager.saveCellValues(fillUpdates);
});

// 🗑️ Clear selected cells (triggers listenToUpdateData with empty values)
selectionManager.clearSelectedCells();

// 💾 Save single cell value (triggers listenToUpdateData)
selectionManager.saveCellValue({ rowIndex: 2, colIndex: 3 }, "New Value");

// 💾 Save multiple cell values (triggers listenToUpdateData)
selectionManager.saveCellValues([
  { rowIndex: 0, colIndex: 0, value: "A1" },
  { rowIndex: 0, colIndex: 1, value: "B1" }
]);

// 🧹 Clean up when done
unsubscribeCopy();
unsubscribePaste();
unsubscribeData();
unsubscribeFill();
```

## 🎪 Advanced Patterns

### ♾️ Infinite Grids - Go Wild!

```tsx
function InfiniteGrid() {
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => Infinity,    // 🤯 Infinite rows!
    getNumCols: () => Infinity,    // 🤯 Infinite columns!
  });

  // Selections can now have Infinity as end coordinates
  // Perfect for virtualized grids!
}
```

### 🎭 Custom State Observation

```tsx
function SmartComponent() {
  const selectionManager = useInitializeSelectionManager({/* ... */});

  // 👀 Watch for specific state changes
  useEffect(() => {
    return selectionManager.observeStateChange(
      (state) => state.isSelecting.type,  // Watch selection type
      (type) => {
        if (type !== "none") {
          console.log("Started selecting!");
          // Return cleanup function
          return () => console.log("Stopped selecting!");
        }
      },
      true  // Run immediately with current state
    );
  }, [selectionManager]);

  // 🖱️ Watch for hovering state changes
  useEffect(() => {
    return selectionManager.observeStateChange(
      (state) => state.isHovering,
      (hovering) => {
        if (hovering.type === "cell") {
          console.log(`Hovering over cell ${hovering.row},${hovering.col}`);
        } else if (hovering.type === "header") {
          console.log(`Hovering over ${hovering.headerType} header ${hovering.index}`);
        }
      },
      true
    );
  }, [selectionManager]);
}
```

### 🎨 Custom Styling with Borders

```tsx
function CustomStyledCell({ row, col, selectionManager }) {
  const borders = useSelectionManager(
    selectionManager,
    () => selectionManager.selectionBorders({ row, col })
  );

  const customStyle = {
    borderLeft: borders.includes('left') ? '2px solid #ff4081' : '1px solid #ddd',
    borderRight: borders.includes('right') ? '2px solid #ff4081' : '1px solid #ddd',
    borderTop: borders.includes('top') ? '2px solid #ff4081' : '1px solid #ddd',
    borderBottom: borders.includes('bottom') ? '2px solid #ff4081' : '1px solid #ddd',
  };

  return <div style={customStyle}>Custom styled cell!</div>;
}
```

## 🏆 Performance Tips

### 🚀 For Small Grids (< 1000 cells)
- Use the React hooks approach with `useSelectionManager`
- Manual event handlers are fine
- Easy to debug and understand

### ⚡ For Large Grids (> 1000 cells)
- Use `setupCellElement` and `setupHeaderElement`
- Individual components with `React.memo`
- `useCallback` for refs (critical!)
- Avoid creating refs in loops

### 🎯 Best Practices

1. **Always use `useCallback` for refs**:
   ```tsx
   // ✅ Good
   const cellRef = useCallback((el) => {
     if (el) return selectionManager.setupCellElement(el, { row, col });
   }, [row, col, selectionManager]);

   // ❌ Bad - creates new function every render
   const cellRef = (el) => {
     if (el) return selectionManager.setupCellElement(el, { row, col });
   };
   ```

2. **Set up focus correctly**:
   ```tsx
   <div 
     ref={setContainerElement}
     tabIndex={0}              // 🔑 Required for keyboard events
     style={{ outline: 'none' }} // 🎨 Remove ugly focus outline
   />
   ```

3. **Use specific selectors**:
   ```tsx
   // ✅ Good - only re-renders when selections change
   const selections = useSelectionManager(sm, (state) => state.selections);

   // ❌ Bad - re-renders on any state change
   const state = useSelectionManager(sm, (state) => state);
   ```

## 🎉 That's a Wrap!

SelectionManager makes building grid interfaces fun instead of frustrating. Whether you're creating a simple data table or the next Excel competitor, we've got the tools to make it happen smoothly.

**Quick links:**
- 🌟 [Star us on GitHub](https://github.com/ricsam/selection-manager)
- 🐛 [Report issues](https://github.com/ricsam/selection-manager/issues) 

Now go build something amazing! 🚀✨

---

## 📄 License

MIT © ricsam - Go wild! 🎊
