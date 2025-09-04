import React, { useCallback, useState } from "react";
import {
  SelectionManager,
  type SelectionManagerState,
  type SMArea,
} from "./src/selection-manager";
import { useInitializeSelectionManager } from "./src/use-initialize-selection-manager";
import { useSelectionManager } from "./src/use-selection-manager";

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
          isEditing: selectionManager.isEditing,
        };
      },
    );

    const [values, setValues] = useState<Record<string, string>>({});

    React.useEffect(() => {
      return selectionManager.listenToUpdateData((data) => {
        data.forEach(({ rowIndex, colIndex, value }) => {
          setValues((prev) => ({
            ...prev,
            [`${rowIndex},${colIndex}`]: value,
          }));
        });
      });
    }, [selectionManager]);

    React.useEffect(() => {
      return selectionManager.listenToCopy(() => {
        const boundingRect = selectionManager.getSelectionsBoundingRect();
        if (!boundingRect) return;

        // Create grid covering bounding rectangle
        if (
          boundingRect.end.col.type === "infinity" ||
          boundingRect.end.row.type === "infinity"
        ) {
          throw new Error("Cannot copy infinite selections");
        }

        const gridHeight =
          boundingRect.end.row.value - boundingRect.start.row + 1;
        const gridWidth =
          boundingRect.end.col.value - boundingRect.start.col + 1;
        const grid: string[][] = Array(gridHeight)
          .fill(null)
          .map(() => Array(gridWidth).fill(""));

        // Fill grid with selected data using forEachSelectedCell helper
        selectionManager.forEachSelectedCell(({ absolute, relative }) => {
          const value =
            values[`${absolute.row},${absolute.col}`] ??
            `${absolute.row},${absolute.col}`;
          grid[relative.row]![relative.col] = value;
        });

        const tsvString = grid.map((row) => row.join("\t")).join("\n");
        navigator.clipboard.writeText(tsvString);
      });
    }, [selectionManager, values]);

    const renderCornerCell = () => {
      return (
        <div
          key="corner"
          onMouseEnter={() => {
            selectionManager.cancelHovering();
          }}
          style={{
            width: 40,
            height: 40,
            border: "1px solid #ddd",
            backgroundColor: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",

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

            fontWeight: "bold",
            boxShadow,
          }}
          onMouseDown={(e) => selectionManager.headerMouseDown(col, "col", e)}
          onMouseEnter={() => selectionManager.headerMouseEnter(col, "col")}
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

            fontWeight: "bold",
            boxShadow,
          }}
          onMouseDown={(e) => selectionManager.headerMouseDown(row, "row", e)}
          onMouseEnter={() => selectionManager.headerMouseEnter(row, "row")}
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
      const isEditing = selectionManager.isEditingCell(row, col);
      const canHaveFillHandle = selectionManager.canCellHaveFillHandle({
        row,
        col,
      });

      const value = values[`${row},${col}`] ?? `${row},${col}`;

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
            position: "relative",
          }}
          onMouseDown={(e) =>
            selectionManager.cellMouseDown(row, col, {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              isFillHandle:
                e.target instanceof HTMLElement &&
                (e.target.hasAttribute("data-fill-handle") ||
                  e.target.querySelector("[data-fill-handle]") !== null),
            })
          }
          onMouseEnter={() => selectionManager.cellMouseEnter(row, col)}
          onDoubleClick={(e) => selectionManager.cellDoubleClick(row, col)}
        >
          {isEditing ? (
            <input
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
              }}
              type="text"
              value={value}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  selectionManager.cancelEditing();
                }
              }}
              onBlur={() => selectionManager.cancelEditing()}
              onChange={(e) => {
                setValues((prev) => ({
                  ...prev,
                  [`${row},${col}`]: e.target.value,
                }));
              }}
            />
          ) : (
            value
          )}
          {canHaveFillHandle && (
            <div
              data-fill-handle={true}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 8,
                height: 8,
                backgroundColor: "blue",
                cursor: "crosshair",
              }}
            ></div>
          )}
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
            display: "inline-grid",
            gridTemplateColumns: "repeat(9, 40px)", // 1 for row headers + 8 for columns
            gridTemplateRows: "repeat(9, 40px)", // 1 for column headers + 8 for rows
            gap: 0,
            border: hasFocus ? "2px dotted red" : "2px solid transparent",
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
    getNumRows: () => ({ type: "number", value: 8 }),
    getNumCols: () => ({ type: "number", value: 8 }),
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
    getNumRows: () => ({ type: "number", value: 8 }),
    getNumCols: () => ({ type: "number", value: 8 }),
    initialState: {
      selections: [
        {
          start: { row: 1, col: 1 },
          end: {
            row: { type: "number", value: 2 },
            col: { type: "number", value: 2 },
          },
        },
        {
          start: { row: 4, col: 4 },
          end: {
            row: { type: "number", value: 5 },
            col: { type: "number", value: 5 },
          },
        },
      ],
    },
    containerElement,
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
      selections: [
        {
          start: { row: 0, col: 0 },
          end: { row: { type: "number", value: 1 }, col: { type: "number", value: 7 } },
        },
      ],
      hasFocus: false,
      isSelecting: { type: "none" },
      isEditing: { type: "none" },
      isHovering: { type: "none" },
    },
  );

  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => ({ type: "number", value: 8 }),
    getNumCols: () => ({ type: "number", value: 8 }),
    state: controlledState,
    containerElement,
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
                  row: { type: "number", value: Math.floor(Math.random() * 8) },
                  col: { type: "number", value: Math.floor(Math.random() * 8) },
                },
              },
            ],
            hasFocus: false,
            isSelecting: {
              type: "none",
            },
            isEditing: { type: "none" },
            isHovering: { type: "none" },
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
            isSelecting: {
              type: "none",
            },
            isEditing: { type: "none" },
            isHovering: { type: "none" },
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
  const [reportedSelections, setReportedSelections] = useState<SMArea[]>([]);
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => ({ type: "number", value: 8 }),
    getNumCols: () => ({ type: "number", value: 8 }),
    onStateChange: (state) => {
      console.log("Test 4 - Selection changed:", state);
      setReportedSelections([...state.selections]);
    },
    containerElement,
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
      selections: [{ start: { row: 3, col: 3 }, end: { row: { type: "number", value: 3 }, col: { type: "number", value: 3 } } }],
      hasFocus: false,
      isSelecting: { type: "none" },
      isEditing: { type: "none" },
      isHovering: { type: "none" },
    });

  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => ({ type: "number", value: 8 }),
    getNumCols: () => ({ type: "number", value: 8 }),
    state: fullyControlledState,
    onStateChange: (state) => {
      console.log("Test 5 - Selection changed:", state);
      setFullyControlledState(state);
    },
    containerElement,
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
              { start: { row: 0, col: 0 }, end: { row: { type: "number", value: 7 }, col: { type: "number", value: 7 } } },
            ],
            hasFocus: false,
            isSelecting: { type: "none" },
            isEditing: { type: "none" },
            isHovering: { type: "none" },
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
              { start: { row: 2, col: 2 }, end: { row: { type: "number", value: 5 }, col: { type: "number", value: 5 } } },
            ],
            hasFocus: false,
            isSelecting: { type: "none" },
            isEditing: { type: "none" },
            isHovering: { type: "none" },
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
            isEditing: { type: "none" },
            isHovering: { type: "none" },
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

// Cell component with useCallback ref for Test6
const CellComponent = React.memo(
  ({
    row,
    col,
    selectionManager,
  }: {
    row: number;
    col: number;
    selectionManager: SelectionManager;
  }) => {
    const cellRef = useCallback(
      (el: HTMLElement | null) => {
        if (el) {
          return selectionManager.setupCellElement(el, { row, col });
        }
      },
      [row, col, selectionManager],
    );

    const isEditing = useSelectionManager(selectionManager, () => {
      return selectionManager.isEditingCell(row, col);
    });

    const canHaveFillHandle = useSelectionManager(selectionManager, () => {
      return selectionManager.canCellHaveFillHandle({ row, col });
    });

    const [value, setValue] = useState<string>(`${row},${col}`);

    return (
      <div
        ref={cellRef}
        className="cell"
        style={{
          width: 40,
          height: 40,
          border: "1px solid #ddd",
          backgroundColor: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          position: "relative",
        }}
      >
        {isEditing ? (
          <input
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                selectionManager.cancelEditing();
              }
            }}
            onBlur={() => selectionManager.cancelEditing()}
            onChange={(e) => setValue(e.target.value)}
            value={value}
            autoFocus
          />
        ) : (
          value
        )}
        {canHaveFillHandle && (
          <div
            data-fill-handle={true}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 8,
              height: 8,
              backgroundColor: "blue",
              cursor: "crosshair",
            }}
          ></div>
        )}
      </div>
    );
  },
);
CellComponent.displayName = "CellComponent";

// Header component with useCallback ref for Test6
const HeaderComponent = React.memo(
  ({
    index,
    type,
    selectionManager,
  }: {
    index: number;
    type: "row" | "col";
    selectionManager: SelectionManager;
  }) => {
    const headerRef = useCallback(
      (el: HTMLElement | null) => {
        if (el) {
          return selectionManager.setupHeaderElement(el, index, type);
        }
      },
      [index, type, selectionManager],
    );

    return (
      <div
        ref={headerRef}
        className={`${type}-header`}
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

          fontWeight: "bold",
        }}
      >
        {index}
      </div>
    );
  },
);
HeaderComponent.displayName = "HeaderComponent";

// Corner cell component for Test6
const CornerCell = React.memo(
  ({ selectionManager }: { selectionManager: SelectionManager }) => {
    return (
      <div
        onMouseEnter={() => {
          selectionManager.cancelHovering();
        }}
        style={{
          width: 40,
          height: 40,
          border: "1px solid #ddd",
          backgroundColor: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",

          fontWeight: "bold",
        }}
      ></div>
    );
  },
);
CornerCell.displayName = "CornerCell";

// Test 6: Using callback refs with setupCellElement and setupHeaderElement
function Test6() {
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );
  const selectionManager = useInitializeSelectionManager({
    getNumRows: () => ({ type: "number", value: 8 }),
    getNumCols: () => ({ type: "number", value: 8 }),
    containerElement,
  });

  React.useEffect(() => {
    return selectionManager.listenToFill((fillEvent) => {
      console.log("fillArea", {
        seedRange: fillEvent.seedRange,
        fillRange: fillEvent.fillRange,
        direction: fillEvent.direction,
        type: fillEvent.type,
        outputRange: fillEvent.outputRange
      });
    });
  }, [selectionManager]);

  const renderGridContent = () => {
    const content = [];

    // First row: corner + column headers
    content.push(
      <CornerCell key="corner" selectionManager={selectionManager} />,
    );
    for (let col = 0; col < 8; col++) {
      content.push(
        <HeaderComponent
          key={`col-header-${col}`}
          index={col}
          type="col"
          selectionManager={selectionManager}
        />,
      );
    }

    // Data rows: row header + cells
    for (let row = 0; row < 8; row++) {
      content.push(
        <HeaderComponent
          key={`row-header-${row}`}
          index={row}
          type="row"
          selectionManager={selectionManager}
        />,
      );
      for (let col = 0; col < 8; col++) {
        content.push(
          <CellComponent
            key={`${row}-${col}`}
            row={row}
            col={col}
            selectionManager={selectionManager}
          />,
        );
      }
    }

    return content;
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <h3>
        Test 6: Using Callback Refs with setupCellElement/setupHeaderElement
      </h3>
      <div
        ref={setContainerElement}
        tabIndex={0}
        style={{
          display: "inline-grid",
          gridTemplateColumns: "repeat(9, 40px)", // 1 for row headers + 8 for columns
          gridTemplateRows: "repeat(9, 40px)", // 1 for column headers + 8 for rows
          gap: 0,
          border: "2px solid transparent",
          outline: "none",
          padding: 4,
        }}
      >
        {renderGridContent()}
      </div>
      <div style={{ fontSize: "12px", color: "#666", marginTop: 8 }}>
        <em>
          This test uses setupCellElement and setupHeaderElement methods
          directly with callback refs instead of the useSelectionManager hook.
          The styling and event handling is managed by the SelectionManager
          automatically.
        </em>
      </div>
    </div>
  );
}

export function Demo() {
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Selection Manager Demo - 6 Test Cases</h1>
      <p>
        This demo shows 6 different ways to use the SelectionManager with an 8x8
        grid. Click and drag to select cells. Use Ctrl+click for
        multi-selection, Shift+click to extend. Use arrow keys for keyboard
        navigation when a grid has focus.
      </p>

      <Test1 />
      <Test2 />
      <Test3 />
      <Test4 />
      <Test5 />
      <Test6 />
    </div>
  );
}
