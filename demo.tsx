import React, { useState, useRef, useEffect } from "react";
import { useInitializeSelectionManager } from "./src/use-initialize-selection-manager";
import { useSelectionManager } from "./src/use-selection-manager";
import {
  SelectionManager,
  type SelectionManagerState,
  type SMSelection,
} from "./src/selection-manager";

// Grid component that displays an 8x8 grid (64 cells) with selection support
interface GridProps {
  selectionManager: SelectionManager;
  title: string;
}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ selectionManager, title }, ref) => {
    // Subscribe to selection manager updates
    const { selections, hasFocus, isSelecting } = useSelectionManager(
      selectionManager,
      () => {
        return {
          selections: selectionManager.selections,
          hasFocus: selectionManager.hasFocus,
          isSelecting: selectionManager.isSelecting,
        };
      },
    );

    const renderCornerCell = () => {
      return (
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          key="corner"
          style={{
            width: 40,
            height: 40,
            border: "1px solid #ddd",
            backgroundColor: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            userSelect: "none",
            fontWeight: "bold",
          }}
        ></div>
      );
    };

    const renderColumnHeader = (col: number) => {
      const boxShadow = selectionManager.getHeaderBoxShadow(col, "col");
      return (
        <div
          key={`col-header-${col}`}
          className="col-header"
          style={{
            width: 40,
            height: 40,
            border: "1px solid #ddd",
            backgroundColor: "#f0f0f0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            userSelect: "none",
            fontWeight: "bold",
            boxShadow,
          }}
          onMouseDown={(e) => selectionManager.headerMouseDown(col, "col", e)}
          onMouseEnter={() => selectionManager.headerMouseEnter(col, "col")}
          onMouseUp={() => selectionManager.headerMouseUp(col, "col")}
        >
          {col}
        </div>
      );
    };

    const renderRowHeader = (row: number) => {
      const boxShadow = selectionManager.getHeaderBoxShadow(row, "row");
      return (
        <div
          key={`row-header-${row}`}
          className="row-header"
          style={{
            width: 40,
            height: 40,
            border: "1px solid #ddd",
            backgroundColor: "#f0f0f0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            userSelect: "none",
            fontWeight: "bold",
            boxShadow,
          }}
          onMouseDown={(e) => selectionManager.headerMouseDown(row, "row", e)}
          onMouseEnter={() => selectionManager.headerMouseEnter(row, "row")}
          onMouseUp={() => selectionManager.headerMouseUp(row, "row")}
        >
          {row}
        </div>
      );
    };

    const renderCell = (row: number, col: number) => {
      const isSelected = selectionManager.isSelected({ row, col });
      const isNegativeSelection = selectionManager.inNegativeSelection({
        row,
        col,
      });
      const boxShadow = selectionManager.getCellBoxShadow({ row, col });

      return (
        <div
          key={`${row}-${col}`}
          className="cell"
          style={{
            width: 40,
            height: 40,
            border: "1px solid #ddd",
            backgroundColor: isSelected
              ? isNegativeSelection
                ? "#ffebee"
                : "#e3f2fd"
              : "#fff",
            boxShadow,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            userSelect: "none",
          }}
          onMouseDown={(e) => selectionManager.cellMouseDown(row, col, e)}
          onMouseEnter={() => selectionManager.cellMouseEnter(row, col)}
          onMouseUp={() => selectionManager.cellMouseUp(row, col)}
        >
          {`${row},${col}`}
        </div>
      );
    };

    const renderGridContent = () => {
      const content = [];

      // First row: corner + column headers
      content.push(renderCornerCell());
      for (let col = 0; col < 8; col++) {
        content.push(renderColumnHeader(col));
      }

      // Data rows: row header + cells
      for (let row = 0; row < 8; row++) {
        content.push(renderRowHeader(row));
        for (let col = 0; col < 8; col++) {
          content.push(renderCell(row, col));
        }
      }

      return content;
    };

    return (
      <div style={{ marginBottom: 40 }}>
        <h3>{title}</h3>
        <div
          ref={ref}
          tabIndex={0}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(9, 40px)", // 1 for row headers + 8 for columns
            gridTemplateRows: "repeat(9, 40px)", // 1 for column headers + 8 for rows
            gap: 0,
            border: hasFocus ? "2px solid #2196F3" : "2px solid transparent",
            outline: "none",
            padding: 4,
          }}
        >
          {renderGridContent()}
        </div>
        <div style={{ fontSize: "12px", color: "#666", marginTop: 8 }}>
          <strong>Selections:</strong> {JSON.stringify(selections)}
          <br />
          <strong>Has Focus:</strong> {hasFocus ? "Yes" : "No"}
          <br />
          <strong>Currently Selecting:</strong>{" "}
          {isSelecting ? JSON.stringify(isSelecting) : "No"}
          <br />
          <em>
            Click row/column headers to select entire rows/columns. Use
            Shift+click to extend, Ctrl/Cmd+click for multi-selection.
          </em>
        </div>
      </div>
    );
  },
);
Grid.displayName = "Grid";

// Test 1: Uncontrolled
function Test1() {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 8,
    getNumCols: () => 8,
    containerElement,
  });

  return (
    <Grid
      selectionManager={selectionManager}
      title="Test 1: Uncontrolled"
      ref={setContainerElement}
    />
  );
}

// Test 2: With initial selection
function Test2() {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 8,
    getNumCols: () => 8,
    initialState: {
      selections: [
        { start: { row: 1, col: 1 }, end: { row: 2, col: 2 } },
        { start: { row: 4, col: 4 }, end: { row: 5, col: 5 } },
      ],
    },
  });

  return (
    <Grid
      ref={setContainerElement}
      selectionManager={selectionManager}
      title="Test 2: With Initial Selections"
    />
  );
}

// Test 3: With only selections provided (read-only)
function Test3() {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );
  const [controlledState, setControlledState] = useState<SelectionManagerState>(
    {
      selections: [{ start: { row: 0, col: 0 }, end: { row: 1, col: 7 } }],
      hasFocus: false,
      isSelecting: { type: "none" },
    },
  );

  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 8,
    getNumCols: () => 8,
    state: controlledState,
  });

  return (
    <div style={{ marginBottom: 40 }}>
      <Grid
        ref={setContainerElement}
        selectionManager={selectionManager}
        title="Test 3: With Only Selections Provided (Read-only)"
      />
      <button
        onClick={() =>
          setControlledState({
            selections: [
              {
                start: {
                  row: Math.floor(Math.random() * 8),
                  col: Math.floor(Math.random() * 8),
                },
                end: {
                  row: Math.floor(Math.random() * 8),
                  col: Math.floor(Math.random() * 8),
                },
              },
            ],
            hasFocus: false,
            isSelecting: undefined,
          })
        }
        style={{ marginTop: 8, padding: "4px 8px" }}
      >
        Random Selection
      </button>
      <button
        onClick={() =>
          setControlledState({
            selections: [],
            hasFocus: false,
            isSelecting: undefined,
          })
        }
        style={{ marginTop: 8, marginLeft: 8, padding: "4px 8px" }}
      >
        Clear Selection
      </button>
    </div>
  );
}

// Test 4: With only onSelectionChange
function Test4() {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );
  const [reportedSelections, setReportedSelections] = useState<SMSelection[]>(
    [],
  );
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 8,
    getNumCols: () => 8,
    onStateChange: (state) => {
      console.log("Test 4 - Selection changed:", state);
      setReportedSelections([...state.selections]);
    },
  });

  return (
    <div style={{ marginBottom: 40 }}>
      <Grid
        selectionManager={selectionManager}
        title="Test 4: With Only onSelectionChange"
        ref={setContainerElement}
      />
      <div style={{ fontSize: "14px", marginTop: 8 }}>
        <strong>Reported Selections:</strong>{" "}
        {JSON.stringify(reportedSelections)}
      </div>
    </div>
  );
}

// Test 5: Fully controlled
function Test5() {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );
  const [fullyControlledState, setFullyControlledState] =
    useState<SelectionManagerState>({
      selections: [{ start: { row: 3, col: 3 }, end: { row: 3, col: 3 } }],
      hasFocus: false,
      isSelecting: { type: "none" },
    });

  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => 8,
    getNumCols: () => 8,
    state: fullyControlledState,
    onStateChange: (state) => {
      console.log("Test 5 - Selection changed:", state);
      setFullyControlledState(state);
    },
  });

  return (
    <div style={{ marginBottom: 40 }}>
      <Grid
        selectionManager={selectionManager}
        title="Test 5: Fully Controlled (selections + onSelectionChange)"
        ref={setContainerElement}
      />
      <button
        onClick={() =>
          setFullyControlledState({
            selections: [
              { start: { row: 0, col: 0 }, end: { row: 7, col: 7 } },
            ],
            hasFocus: false,
            isSelecting: { type: "none" },
          })
        }
        style={{ marginTop: 8, padding: "4px 8px" }}
      >
        Select All
      </button>
      <button
        onClick={() =>
          setFullyControlledState({
            selections: [
              { start: { row: 2, col: 2 }, end: { row: 5, col: 5 } },
            ],
            hasFocus: false,
            isSelecting: { type: "none" },
          })
        }
        style={{ marginTop: 8, marginLeft: 8, padding: "4px 8px" }}
      >
        Select Center
      </button>
      <button
        onClick={() =>
          setFullyControlledState({
            selections: [],
            hasFocus: false,
            isSelecting: { type: "none" },
          })
        }
        style={{ marginTop: 8, marginLeft: 8, padding: "4px 8px" }}
      >
        Clear
      </button>
      <div style={{ fontSize: "14px", marginTop: 8 }}>
        <strong>Controlled State:</strong>{" "}
        {JSON.stringify(fullyControlledState)}
      </div>
    </div>
  );
}

export function Demo() {
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Selection Manager Demo - 5 Test Cases</h1>
      <p>
        This demo shows 5 different ways to use the SelectionManager with an 8x8
        grid. Click and drag to select cells. Use Ctrl+click for
        multi-selection, Shift+click to extend. Use arrow keys for keyboard
        navigation when a grid has focus.
      </p>

      <Test1 />
      <Test2 />
      <Test3 />
      <Test4 />
      <Test5 />
    </div>
  );
}
