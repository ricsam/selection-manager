import { SelectionManager } from "../src/selection-manager";
import { expect, describe, it, beforeEach, mock } from "bun:test";

describe("SelectionManager Advanced Tests", () => {
  let selectionManager: SelectionManager;

  beforeEach(() => {
    selectionManager = new SelectionManager(
      () => ({ type: "number" as const, value: 10 }),
      () => ({ type: "number" as const, value: 5 }),
      () => [],
    );
  });

  describe("Border and Styling", () => {
    it("should provide correct box shadow for selected cells", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      const boxShadow = selectionManager.getCellBoxShadow({ row: 1, col: 1 });
      expect(boxShadow).toBeDefined();
      expect(typeof boxShadow).toBe("string");
      expect(boxShadow).toContain("#2196F3");
    });

    it("should provide header box shadow for selected rows", () => {
      selectionManager.headerMouseDown(1, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      selectionManager.mouseUp();

      const boxShadow = selectionManager.getHeaderBoxShadow(1, "row");
      expect(boxShadow).toBeDefined();
      expect(typeof boxShadow).toBe("string");
    });

    it("should provide container box shadow when focused", () => {
      selectionManager.focus();
      const boxShadow = selectionManager.getContainerBoxShadow();
      expect(boxShadow).toBe("0 0 0 1px #2196F3");

      selectionManager.blur();
      expect(selectionManager.getContainerBoxShadow()).toBeUndefined();
    });

    it("should generate custom box shadow", () => {
      const boxShadow = selectionManager.getBoxShadow({
        color: "#ff0000",
        position: ["top", "left"],
      });
      expect(boxShadow).toContain("#ff0000");
      expect(boxShadow).toContain("inset 0 2px 0 0");
      expect(boxShadow).toContain("inset 2px 0 0 0");
    });

    it("should handle hovering over cells", () => {
      selectionManager.cellMouseEnter(2, 3);
      expect(selectionManager.isHoveringCell(2, 3)).toBe(true);
      expect(selectionManager.isHoveringCell(1, 1)).toBe(false);
    });

    it("should cancel hovering", () => {
      selectionManager.cellMouseEnter(2, 3);
      expect(selectionManager.isHoveringCell(2, 3)).toBe(true);
      
      selectionManager.cancelHovering();
      expect(selectionManager.isHovering.type).toBe("none");
    });
  });

  describe("Data Operations", () => {
    it("should export selection as TSV with proper format", () => {
      const data = new Map([
        ["0,0", "A"],
        ["0,1", "B"],
        ["1,0", "C"],
        ["1,1", "D"],
        ["2,2", "E"], // Outside selection
      ]);

      selectionManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(1, 1);
      selectionManager.mouseUp();

      const tsv = selectionManager.selectionToTsv(data);
      expect(tsv).toBe("A\tB\nC\tD");
    });

    it("should handle empty TSV export", () => {
      const data = new Map([["5,5", "Outside"]]);

      selectionManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const tsv = selectionManager.selectionToTsv(data);
      expect(tsv).toBe("");
    });

    it("should save single cell value", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);

      selectionManager.saveCellValue({ rowIndex: 1, colIndex: 2 }, "test");
      expect(updateCallback).toHaveBeenCalledWith([
        { rowIndex: 1, colIndex: 2, value: "test" },
      ]);
    });

    it("should save multiple cell values", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);

      const updates = [
        { rowIndex: 1, colIndex: 2, value: "A" },
        { rowIndex: 2, colIndex: 3, value: "B" },
      ];

      selectionManager.saveCellValues(updates);
      expect(updateCallback).toHaveBeenCalledWith(updates);
    });

    it("should skip readonly cells when saving cell values", () => {
      const readonlyManager = new SelectionManager(
        () => ({ type: "number" as const, value: 10 }),
        () => ({ type: "number" as const, value: 5 }),
        () => [],
        {
          isCellReadonly: ({ rowIndex, colIndex }) =>
            rowIndex === 1 && colIndex === 2,
        },
      );
      const updateCallback = mock();
      readonlyManager.listenToUpdateData(updateCallback);

      expect(readonlyManager.isCellReadonly(1, 2)).toBe(true);
      expect(readonlyManager.isCellReadonly(1, 3)).toBe(false);

      readonlyManager.saveCellValue({ rowIndex: 1, colIndex: 2 }, "blocked");
      expect(updateCallback).not.toHaveBeenCalled();

      readonlyManager.saveCellValues([
        { rowIndex: 1, colIndex: 2, value: "blocked" },
        { rowIndex: 1, colIndex: 3, value: "allowed" },
      ]);
      expect(updateCallback).toHaveBeenCalledTimes(1);
      expect(updateCallback).toHaveBeenCalledWith([
        { rowIndex: 1, colIndex: 3, value: "allowed" },
      ]);
    });

    it("should iterate over selected cells", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);
      selectionManager.mouseUp();

      const cells: Array<{ absolute: { row: number; col: number }; relative: { row: number; col: number } }> = [];
      selectionManager.forEachSelectedCell((cell) => {
        cells.push(cell);
      });

      expect(cells).toHaveLength(4);
      expect(cells[0]).toEqual({
        absolute: { row: 1, col: 1 },
        relative: { row: 0, col: 0 },
      });
    });

    it("should throw error for infinite selection iteration", () => {
      const infiniteManager = new SelectionManager(
        () => ({ type: "infinity" as const }),
        () => ({ type: "infinity" as const }),
        () => [],
      );

      // Create an infinite selection by selecting a row header
      infiniteManager.headerMouseDown(0, "row", {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      });
      infiniteManager.mouseUp();

      expect(() => {
        infiniteManager.forEachSelectedCell(() => {});
      }).toThrow("Cannot iterate over infinite selections");
    });
  });

  describe("Readonly Cells", () => {
    const createReadonlyManager = (
      isCellReadonly: (cell: {
        rowIndex: number;
        colIndex: number;
      }) => boolean,
    ) =>
      new SelectionManager(
        () => ({ type: "number" as const, value: 10 }),
        () => ({ type: "number" as const, value: 5 }),
        () => [],
        { isCellReadonly },
      );

    it("should keep readonly cells selectable and copyable", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 1 && colIndex === 2,
      );
      const copyCallback = mock();
      readonlyManager.listenToCopy(copyCallback);

      readonlyManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.mouseUp();

      expect(readonlyManager.isSelected({ row: 1, col: 2 })).toBe(true);

      const preventDefault = mock();
      readonlyManager.handleKeyDown({
        key: "c",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        preventDefault,
      });

      expect(copyCallback).toHaveBeenCalledWith(false);
      expect(preventDefault).toHaveBeenCalled();
    });

    it("should block direct and keyboard edit entry for readonly cells", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 1 && colIndex === 2,
      );

      readonlyManager.editCell(1, 2);
      expect(readonlyManager.isEditing).toEqual({ type: "none" });

      readonlyManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.mouseUp();
      readonlyManager.handleKeyDown({
        key: "F2",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });
      expect(readonlyManager.isEditing).toEqual({ type: "none" });
    });

    it("should clear only writable cells on delete", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 1 && colIndex === 2,
      );
      const updateCallback = mock();
      readonlyManager.listenToUpdateData(updateCallback);

      readonlyManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.cellMouseEnter(1, 3);
      readonlyManager.mouseUp();

      readonlyManager.handleKeyDown({
        key: "Delete",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(updateCallback).toHaveBeenCalledWith([
        { rowIndex: 1, colIndex: 1, value: "" },
        { rowIndex: 1, colIndex: 3, value: "" },
      ]);
    });

    it("should emit no clear updates when all selected cells are readonly", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 1 && colIndex === 2,
      );
      const updateCallback = mock();
      readonlyManager.listenToUpdateData(updateCallback);

      readonlyManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.mouseUp();

      readonlyManager.handleKeyDown({
        key: "Backspace",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(updateCallback).not.toHaveBeenCalled();
    });

    it("should auto-clear only writable cells on cut", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 1 && colIndex === 2,
      );
      const copyCallback = mock((cut: boolean) => {
        if (cut) {
          readonlyManager.clearSelectedCells();
        }
      });
      const updateCallback = mock();
      readonlyManager.listenToCopy(copyCallback);
      readonlyManager.listenToUpdateData(updateCallback);

      readonlyManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.cellMouseEnter(1, 2);
      readonlyManager.mouseUp();

      readonlyManager.handleKeyDown({
        key: "x",
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(copyCallback).toHaveBeenCalledWith(true);
      expect(updateCallback).toHaveBeenCalledWith([
        { rowIndex: 1, colIndex: 1, value: "" },
      ]);
    });

    it("should paste only writable cells", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 0 && colIndex === 1,
      );
      const pasteCallback = mock(({ updates }) => {
        readonlyManager.saveCellValues(updates);
      });
      const updateCallback = mock();
      readonlyManager.listenToPaste(pasteCallback);
      readonlyManager.listenToUpdateData(updateCallback);

      readonlyManager.focus();
      readonlyManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.mouseUp();

      readonlyManager.handlePaste({
        preventDefault: mock(),
        clipboardData: {
          getData: mock(() => "A\tB\nC\tD"),
        },
      } as any);

      expect(pasteCallback).toHaveBeenCalledWith({
        rawString: "A\tB\nC\tD",
        updates: [
          { rowIndex: 0, colIndex: 0, value: "A" },
          { rowIndex: 1, colIndex: 0, value: "C" },
          { rowIndex: 1, colIndex: 1, value: "D" },
        ],
      });
      expect(updateCallback).toHaveBeenCalledWith([
        { rowIndex: 0, colIndex: 0, value: "A" },
        { rowIndex: 1, colIndex: 0, value: "C" },
        { rowIndex: 1, colIndex: 1, value: "D" },
      ]);
    });

    it("should emit no paste data updates when all pasted cells are readonly", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex < 2 && colIndex < 2,
      );
      const pasteCallback = mock(({ updates }) => {
        readonlyManager.saveCellValues(updates);
      });
      const updateCallback = mock();
      readonlyManager.listenToPaste(pasteCallback);
      readonlyManager.listenToUpdateData(updateCallback);

      readonlyManager.focus();
      readonlyManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.mouseUp();

      readonlyManager.handlePaste({
        preventDefault: mock(),
        clipboardData: {
          getData: mock(() => "A\tB\nC\tD"),
        },
      } as any);

      expect(pasteCallback).toHaveBeenCalledWith({
        rawString: "A\tB\nC\tD",
        updates: [],
      });
      expect(updateCallback).not.toHaveBeenCalled();
    });

    it("should drop only writable cells", async () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 0 && colIndex === 1,
      );
      const updateCallback = mock();
      readonlyManager.listenToUpdateData(updateCallback);
      readonlyManager.focus();

      const originalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        onload: ((event: any) => void) | null = null;
        readAsText() {
          setTimeout(() => {
            this.onload?.({ target: { result: "A\tB\nC\tD" } });
          }, 0);
        }
      } as any;

      try {
        readonlyManager.handleDrop({
          preventDefault: mock(),
          dataTransfer: {
            files: [
              new File(["A\tB\nC\tD"], "test.tsv", {
                type: "text/tab-separated-values",
              }),
            ],
          },
        } as any);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(updateCallback).toHaveBeenCalledWith([
          { rowIndex: 0, colIndex: 0, value: "A" },
          { rowIndex: 1, colIndex: 0, value: "C" },
          { rowIndex: 1, colIndex: 1, value: "D" },
        ]);
      } finally {
        globalThis.FileReader = originalFileReader;
      }
    });

    it("should emit no drop updates when all dropped cells are readonly", async () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex < 2 && colIndex < 2,
      );
      const updateCallback = mock();
      readonlyManager.listenToUpdateData(updateCallback);
      readonlyManager.focus();

      const originalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        onload: ((event: any) => void) | null = null;
        readAsText() {
          setTimeout(() => {
            this.onload?.({ target: { result: "A\tB\nC\tD" } });
          }, 0);
        }
      } as any;

      try {
        readonlyManager.handleDrop({
          preventDefault: mock(),
          dataTransfer: {
            files: [
              new File(["A\tB\nC\tD"], "test.tsv", {
                type: "text/tab-separated-values",
              }),
            ],
          },
        } as any);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(updateCallback).not.toHaveBeenCalled();
      } finally {
        globalThis.FileReader = originalFileReader;
      }
    });

    it("should keep fill events compatible while filtering readonly fill updates", () => {
      const readonlyManager = createReadonlyManager(
        ({ rowIndex, colIndex }) => rowIndex === 1 && colIndex === 3,
      );
      const fillCallback = mock(() => {
        readonlyManager.saveCellValues([
          { rowIndex: 1, colIndex: 3, value: "blocked" },
          { rowIndex: 1, colIndex: 4, value: "allowed" },
        ]);
      });
      const updateCallback = mock();
      readonlyManager.listenToFill(fillCallback);
      readonlyManager.listenToUpdateData(updateCallback);

      readonlyManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.cellMouseEnter(1, 2);
      readonlyManager.mouseUp();

      readonlyManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: true,
      });
      readonlyManager.cellMouseEnter(1, 4);
      readonlyManager.mouseUp();

      expect(fillCallback).toHaveBeenCalled();
      expect(updateCallback).toHaveBeenCalledWith([
        { rowIndex: 1, colIndex: 4, value: "allowed" },
      ]);
    });
  });

  describe("Element Setup", () => {
    type Listener = (...args: unknown[]) => void;

    const createContainerHarness = () => {
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;

      const registerListener = (
        listeners: Map<string, Listener[]>,
        type: string,
        listener: Listener,
      ) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      };
      const unregisterListener = (
        listeners: Map<string, Listener[]>,
        type: string,
        listener: Listener,
      ) => {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
        );
      };

      const windowListeners = new Map<string, Listener[]>();
      const documentListeners = new Map<string, Listener[]>();
      const textareaListeners = new Map<string, Listener[]>();

      const windowMock = {
        addEventListener: mock((type: string, listener: Listener) => {
          registerListener(windowListeners, type, listener);
        }),
        removeEventListener: mock((type: string, listener: Listener) => {
          unregisterListener(windowListeners, type, listener);
        }),
      } as any;

      const documentMock = {
        activeElement: null as unknown,
        hasFocus: mock(() => true),
        defaultView: windowMock,
        addEventListener: mock((type: string, listener: Listener) => {
          registerListener(documentListeners, type, listener);
        }),
        removeEventListener: mock((type: string, listener: Listener) => {
          unregisterListener(documentListeners, type, listener);
        }),
        getSelection: mock(() => ({ empty: mock() })),
      } as any;

      const textarea = {
        style: {} as Record<string, string>,
        value: "",
        name: "",
        tabIndex: -1,
        autofocus: false,
        isConnected: false,
        ownerDocument: documentMock,
        setAttribute: mock(),
        addEventListener: mock((type: string, listener: Listener) => {
          registerListener(textareaListeners, type, listener);
        }),
        removeEventListener: mock((type: string, listener: Listener) => {
          unregisterListener(textareaListeners, type, listener);
        }),
        focus: mock(() => {
          documentMock.activeElement = textarea;
        }),
      } as any;

      documentMock.createElement = mock(() => textarea);

      const mockElement = {
        ownerDocument: documentMock,
        tagName: "DIV",
        addEventListener: mock(),
        removeEventListener: mock(),
        contains: mock(() => true),
        appendChild: mock((node: { isConnected: boolean }) => {
          node.isConnected = true;
        }),
        removeChild: mock((node: { isConnected: boolean }) => {
          node.isConnected = false;
        }),
        getAttribute: mock(() => undefined),
        style: { boxShadow: "" },
      } as any;

      globalThis.window = windowMock;
      globalThis.document = documentMock;

      return {
        windowListeners,
        documentListeners,
        textareaListeners,
        windowMock,
        documentMock,
        textarea,
        mockElement,
        restore: () => {
          globalThis.window = originalWindow;
          globalThis.document = originalDocument;
        },
      };
    };

    const createInputHarness = () => {
      const inputListeners = new Map<string, Listener[]>();
      const registerListener = (
        listeners: Map<string, Listener[]>,
        type: string,
        listener: Listener,
      ) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      };
      const unregisterListener = (
        listeners: Map<string, Listener[]>,
        type: string,
        listener: Listener,
      ) => {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
        );
      };

      const inputElement = {
        value: "",
        selectionStart: 0,
        selectionEnd: 0,
        addEventListener: mock((type: string, listener: Listener) => {
          registerListener(inputListeners, type, listener);
        }),
        removeEventListener: mock((type: string, listener: Listener) => {
          unregisterListener(inputListeners, type, listener);
        }),
        focus: mock(),
      } as any;

      return {
        inputListeners,
        inputElement,
      };
    };

    const createCellHarness = (rect: {
      top: number;
      left: number;
      width: number;
      height: number;
    }) => {
      return {
        addEventListener: mock(),
        removeEventListener: mock(),
        getBoundingClientRect: mock(() => rect),
        style: { boxShadow: "" },
      } as any;
    };

    it("should setup cell element with event handlers", () => {
      const mockElement = {
        addEventListener: mock(),
        removeEventListener: mock(),
        style: { boxShadow: "" },
      } as any;

      const cleanup = selectionManager.setupCellElement(mockElement, { row: 1, col: 2 });

      expect(mockElement.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("dblclick", expect.any(Function));

      cleanup();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("dblclick", expect.any(Function));
    });

    it("should setup header element with event handlers", () => {
      const mockElement = {
        addEventListener: mock(),
        removeEventListener: mock(),
        style: { boxShadow: "" },
      } as any;

      const cleanup = selectionManager.setupHeaderElement(mockElement, 1, "row");

      expect(mockElement.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));

      cleanup();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mouseenter", expect.any(Function));
    });

    it("should setup container element with comprehensive event handlers", () => {
      // Mock global objects for browser environment
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      
      globalThis.window = {
        addEventListener: mock(),
        removeEventListener: mock(),
      } as any;
      
      globalThis.document = {
        addEventListener: mock(),
        removeEventListener: mock(),
        getSelection: mock(() => ({ empty: mock() })),
      } as any;

      const mockElement = {
        addEventListener: mock(),
        removeEventListener: mock(),
        contains: mock(() => true),
        style: { boxShadow: "" },
      } as any;

      const cleanup = selectionManager.setupContainerElement(mockElement);

      // Check element event listeners
      expect(mockElement.addEventListener).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("drop", expect.any(Function));
      expect(mockElement.addEventListener).toHaveBeenCalledWith("mouseleave", expect.any(Function));

      cleanup();

      expect(mockElement.removeEventListener).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("drop", expect.any(Function));
      expect(mockElement.removeEventListener).toHaveBeenCalledWith("mouseleave", expect.any(Function));

      // Restore global objects
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    });

    it("should trap focus back to the input capture textarea", async () => {
      const {
        documentListeners,
        textareaListeners,
        documentMock,
        textarea,
        mockElement,
        restore,
      } = createContainerHarness();

      try {
        const cleanup = selectionManager.setupContainerElement(mockElement);
        selectionManager.focus();

        expect(mockElement.appendChild).toHaveBeenCalledWith(textarea);
        expect(textarea.focus).toHaveBeenCalledTimes(1);

        documentMock.activeElement = { id: "stolen-focus" };
        textareaListeners.get("blur")?.[0]?.();
        documentListeners
          .get("focusin")
          ?.forEach((listener) => listener({ target: documentMock.activeElement }));

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(textarea.focus).toHaveBeenCalledTimes(2);

        cleanup();

        expect(mockElement.removeChild).toHaveBeenCalledWith(textarea);
      } finally {
        restore();
      }
    });

    it("should move and focus the input capture textarea when the selected cell changes", () => {
      const { mockElement, textarea, restore } = createContainerHarness();
      const firstCell = createCellHarness({
        top: 10,
        left: 20,
        width: 30,
        height: 40,
      });
      const secondCell = createCellHarness({
        top: 50,
        left: 60,
        width: 70,
        height: 80,
      });

      try {
        const cleanupContainer = selectionManager.setupContainerElement(mockElement);
        const cleanupFirstCell = selectionManager.setupCellElement(firstCell, {
          row: 1,
          col: 2,
        });
        const cleanupSecondCell = selectionManager.setupCellElement(secondCell, {
          row: 3,
          col: 4,
        });

        selectionManager.focus();
        selectionManager.cellMouseDown(1, 2, {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          isFillHandle: false,
        });
        selectionManager.mouseUp();

        expect(textarea.style.top).toBe("10px");
        expect(textarea.style.left).toBe("20px");
        expect(textarea.style.width).toBe("30px");
        expect(textarea.style.height).toBe("40px");

        selectionManager.cellMouseDown(3, 4, {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          isFillHandle: false,
        });
        selectionManager.mouseUp();

        expect(textarea.style.top).toBe("50px");
        expect(textarea.style.left).toBe("60px");
        expect(textarea.style.width).toBe("70px");
        expect(textarea.style.height).toBe("80px");
        expect(textarea.focus).toHaveBeenCalledWith({ preventScroll: true });

        cleanupSecondCell();
        cleanupFirstCell();
        cleanupContainer();
      } finally {
        restore();
      }
    });

    it("should start editing from printable keydown on the input capture textarea", () => {
      const { textareaListeners, mockElement, restore } = createContainerHarness();

      selectionManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      try {
        const cleanup = selectionManager.setupContainerElement(mockElement);
        selectionManager.focus();

        const preventDefault = mock();
        textareaListeners.get("keydown")?.[0]?.({
          key: "a",
          isComposing: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          preventDefault,
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(selectionManager.isEditing).toEqual({
          type: "cell",
          row: 1,
          col: 2,
          initialValue: "a",
        });

        cleanup();
      } finally {
        restore();
      }
    });

    it("should not start editing a readonly cell from printable keydown", () => {
      const readonlyManager = new SelectionManager(
        () => ({ type: "number" as const, value: 10 }),
        () => ({ type: "number" as const, value: 5 }),
        () => [],
        {
          isCellReadonly: ({ rowIndex, colIndex }) =>
            rowIndex === 1 && colIndex === 2,
        },
      );
      const { textareaListeners, mockElement, restore } = createContainerHarness();

      readonlyManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      readonlyManager.mouseUp();

      try {
        const cleanup = readonlyManager.setupContainerElement(mockElement);
        readonlyManager.focus();

        const preventDefault = mock();
        textareaListeners.get("keydown")?.[0]?.({
          key: "a",
          isComposing: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          preventDefault,
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(readonlyManager.isEditing).toEqual({ type: "none" });

        cleanup();
      } finally {
        restore();
      }
    });

    it("should recover input capture after editing a cell with no mounted input", () => {
      const { textareaListeners, mockElement, restore } = createContainerHarness();

      try {
        const cleanup = selectionManager.setupContainerElement(mockElement);
        selectionManager.focus();
        selectionManager.cellMouseDown(0, 0, {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          isFillHandle: false,
        });
        selectionManager.mouseUp();

        textareaListeners.get("keydown")?.at(-1)?.({
          key: "x",
          isComposing: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          preventDefault: mock(),
        });

        expect(selectionManager.isEditing).toEqual({
          type: "cell",
          row: 0,
          col: 0,
          initialValue: "x",
        });
        expect(selectionManager.inputCaptureElement).toBeNull();

        selectionManager.cellMouseDown(0, 1, {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          isFillHandle: false,
        });
        selectionManager.mouseUp();

        expect(selectionManager.isEditing).toEqual({ type: "none" });
        expect(selectionManager.inputCaptureElement).not.toBeNull();

        textareaListeners.get("keydown")?.at(-1)?.({
          key: "y",
          isComposing: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          preventDefault: mock(),
        });

        expect(selectionManager.isEditing).toEqual({
          type: "cell",
          row: 0,
          col: 1,
          initialValue: "y",
        });

        cleanup();
      } finally {
        restore();
      }
    });

    it("should not start editing a readonly cell from double click", () => {
      const readonlyManager = new SelectionManager(
        () => ({ type: "number" as const, value: 10 }),
        () => ({ type: "number" as const, value: 5 }),
        () => [],
        {
          isCellReadonly: ({ rowIndex, colIndex }) =>
            rowIndex === 1 && colIndex === 2,
        },
      );
      const listeners = new Map<string, Listener>();
      const mockElement = {
        addEventListener: mock((type: string, listener: Listener) => {
          listeners.set(type, listener);
        }),
        removeEventListener: mock(),
        style: { boxShadow: "" },
      } as any;

      const cleanup = readonlyManager.setupCellElement(mockElement, {
        row: 1,
        col: 2,
      });

      listeners.get("dblclick")?.({} as any);

      expect(readonlyManager.isEditing).toEqual({ type: "none" });

      cleanup();
    });

    it("should ignore modifier-only keydown on the input capture textarea", () => {
      const { textareaListeners, mockElement, restore } = createContainerHarness();

      selectionManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      try {
        const cleanup = selectionManager.setupContainerElement(mockElement);
        selectionManager.focus();

        const preventDefault = mock();
        textareaListeners.get("keydown")?.[0]?.({
          key: "Control",
          isComposing: false,
          ctrlKey: true,
          metaKey: false,
          altKey: false,
          preventDefault,
        });

        expect(preventDefault).not.toHaveBeenCalled();
        expect(selectionManager.isEditing).toEqual({ type: "none" });

        cleanup();
      } finally {
        restore();
      }
    });

    it("should start editing from compositionend on the input capture textarea", () => {
      const { textareaListeners, textarea, mockElement, restore } =
        createContainerHarness();

      selectionManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      try {
        const cleanup = selectionManager.setupContainerElement(mockElement);
        selectionManager.focus();

        textarea.value = "ö";
        const preventDefault = mock();
        textareaListeners.get("compositionend")?.[0]?.({
          data: "ö",
          preventDefault,
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(selectionManager.isEditing).toEqual({
          type: "cell",
          row: 1,
          col: 2,
          initialValue: "ö",
        });

        cleanup();
      } finally {
        restore();
      }
    });

    it("should discard edit on Escape without saving on blur", () => {
      const { inputListeners, inputElement } = createInputHarness();
      const updateListener = mock();
      selectionManager.listenToUpdateData(updateListener);

      selectionManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();
      selectionManager.focus();
      selectionManager.editCell(1, 2, "start");
      const cleanup = selectionManager.setupInputElement(inputElement, {
        rowIndex: 1,
        colIndex: 2,
      });

      inputElement.value = "edited";
      const preventDefault = mock();
      const stopPropagation = mock();
      inputListeners.get("keydown")?.[0]?.({
        key: "Escape",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault,
        stopPropagation,
      });
      inputListeners.get("blur")?.[0]?.();

      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();
      expect(updateListener).not.toHaveBeenCalled();
      expect(selectionManager.isEditing).toEqual({ type: "none" });
      expect(selectionManager.hasFocus).toBe(true);
      expect(selectionManager.hasSelection()).toBe(true);

      cleanup();
    });

    it("should let a second Escape blur the grid after editor Escape", () => {
      const { inputListeners, inputElement } = createInputHarness();

      selectionManager.cellMouseDown(1, 2, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();
      selectionManager.focus();
      selectionManager.editCell(1, 2, "start");

      const cleanup = selectionManager.setupInputElement(inputElement, {
        rowIndex: 1,
        colIndex: 2,
      });

      inputListeners.get("keydown")?.[0]?.({
        key: "Escape",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
        stopPropagation: mock(),
      });
      inputListeners.get("blur")?.[0]?.();

      expect(selectionManager.hasFocus).toBe(true);
      expect(selectionManager.hasSelection()).toBe(true);
      expect(selectionManager.isEditing).toEqual({ type: "none" });

      selectionManager.handleKeyDown({
        key: "Escape",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });

      expect(selectionManager.hasFocus).toBe(false);
      expect(selectionManager.hasSelection()).toBe(false);

      cleanup();
    });

    it("should save once on Enter even if blur follows", () => {
      const { inputListeners, inputElement } = createInputHarness();
      const updateListener = mock();
      selectionManager.listenToUpdateData(updateListener);

      selectionManager.editCell(1, 2, "start");
      const cleanup = selectionManager.setupInputElement(inputElement, {
        rowIndex: 1,
        colIndex: 2,
      });

      inputElement.value = "edited";
      inputListeners.get("keydown")?.[0]?.({
        key: "Enter",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: mock(),
      });
      inputListeners.get("blur")?.[0]?.();

      expect(updateListener).toHaveBeenCalledTimes(1);
      expect(updateListener).toHaveBeenCalledWith([
        { rowIndex: 1, colIndex: 2, value: "edited" },
      ]);
      expect(selectionManager.isEditing).toEqual({ type: "none" });

      cleanup();
    });
  });

  describe("Utility Functions and Edge Cases", () => {
    it("should test sort function with various combinations", () => {
      // Create manager that will use coordinate compression
      const manager = new SelectionManager(
        () => ({ type: "infinity" as const }),
        () => ({ type: "infinity" as const }),
        () => [],
      );

      // Create multiple selections to trigger coordinate compression
      manager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      manager.cellMouseEnter(2, 2);
      manager.mouseUp();

      manager.cellMouseDown(5, 5, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        isFillHandle: false,
      });
      manager.mouseUp();

      // This should exercise the sort function with INF values
      const overlapping = manager.getNonOverlappingSelections();
      expect(overlapping.length).toBeGreaterThan(0);
    });

    it("should handle negative selection detection", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      // Start a remove selection
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        isFillHandle: false,
      });

      expect(selectionManager.inNegativeSelection({ row: 1, col: 1 })).toBe(true);
      expect(selectionManager.inNegativeSelection({ row: 2, col: 2 })).toBe(false);
    });

    it("should get top-left cell in selection", () => {
      selectionManager.cellMouseDown(2, 3, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(1, 1);
      selectionManager.mouseUp();

      const topLeft = selectionManager.getTopLeftCellInSelection();
      expect(topLeft).toEqual({ row: 1, col: 1 });
    });

    it("should return undefined for top-left cell when no selections", () => {
      const topLeft = selectionManager.getTopLeftCellInSelection();
      expect(topLeft).toBeUndefined();
    });

    it("should get selections bounding rect", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      selectionManager.cellMouseDown(3, 3, {
        shiftKey: false,
        ctrlKey: true,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      const boundingRect = selectionManager.getSelectionsBoundingRect();
      expect(boundingRect).toEqual({
        start: { row: 1, col: 1 },
        end: { row: { type: "number", value: 3 }, col: { type: "number", value: 3 } },
      });
    });

    it("should handle selection cancellation", () => {
      selectionManager.cellMouseDown(1, 1, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.cellMouseEnter(2, 2);

      expect(selectionManager.isSelecting.type).not.toBe("none");

      selectionManager.cancelSelection();
      expect(selectionManager.isSelecting.type).toBe("none");
    });

    it("should normalize selections properly", () => {
      const infiniteSelection = {
        start: { row: 1, col: 1 },
        end: { row: { type: "infinity" } as const, col: { type: "infinity" } as const },
      };

      const normalized = selectionManager.normalizeSelection(infiniteSelection);
      
      expect(normalized.end.row).toEqual({ type: "number" as const, value: 9 }); // numRows - 1
      expect(normalized.end.col).toEqual({ type: "number" as const, value: 4 }); // numCols - 1
    });

    it("should handle paste and drop operations", () => {
      const onPasteCallback = mock();
      selectionManager.listenToPaste(onPasteCallback);
      
      selectionManager.focus();
      selectionManager.cellMouseDown(0, 0, {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        isFillHandle: false,
      });
      selectionManager.mouseUp();

      // Mock clipboard event
      const mockClipboardEvent = {
        preventDefault: mock(),
        clipboardData: {
          getData: mock(() => "A\tB\nC\tD"),
        },
      } as any;

      selectionManager.handlePaste(mockClipboardEvent);

      expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
      expect(onPasteCallback).toHaveBeenCalled();
    });

    it("should handle drag and drop files", () => {
      const updateCallback = mock();
      selectionManager.listenToUpdateData(updateCallback);
      
      selectionManager.focus();

      // Mock drag event with CSV file
      const mockFile = new File(["A,B\nC,D"], "test.csv", { type: "text/csv" });
      const mockDragEvent = {
        preventDefault: mock(),
        dataTransfer: {
          files: [mockFile],
        },
      } as any;

      // Mock FileReader
      const originalFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        onload: ((event: any) => void) | null = null;
        readAsText() {
          setTimeout(() => {
            this.onload?.({ target: { result: "A,B\nC,D" } });
          }, 0);
        }
      } as any;

      selectionManager.handleDrop(mockDragEvent);

      // Restore original FileReader
      globalThis.FileReader = originalFileReader;

      expect(mockDragEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe("Comparison Methods", () => {
    it("should test equals method", () => {
      expect(selectionManager.equals(
        { type: "number" as const, value: 5 },
        { type: "number" as const, value: 5 }
      )).toBe(true);

      expect(selectionManager.equals(
        { type: "infinity" as const },
        { type: "infinity" as const }
      )).toBe(true);

      expect(selectionManager.equals(
        { type: "number" as const, value: 5 },
        { type: "infinity" as const }
      )).toBe(false);
    });

    it("should test lt method", () => {
      expect(selectionManager.lt(
        { type: "number" as const, value: 3 },
        { type: "number" as const, value: 5 }
      )).toBe(true);

      expect(selectionManager.lt(
        { type: "number" as const, value: 5 },
        { type: "infinity" as const }
      )).toBe(true);

      expect(selectionManager.lt(
        { type: "infinity" as const },
        { type: "number" as const, value: 5 }
      )).toBe(false);
    });

    it("should test gt method", () => {
      expect(selectionManager.gt(
        { type: "number" as const, value: 5 },
        { type: "number" as const, value: 3 }
      )).toBe(true);

      expect(selectionManager.gt(
        { type: "infinity" as const },
        { type: "number" as const, value: 5 }
      )).toBe(true);

      expect(selectionManager.gt(
        { type: "number" as const, value: 3 },
        { type: "infinity" as const }
      )).toBe(false);
    });

    it("should test lte and gte methods", () => {
      expect(selectionManager.lte(
        { type: "number" as const, value: 3 },
        { type: "number" as const, value: 3 }
      )).toBe(true);

      expect(selectionManager.gte(
        { type: "number" as const, value: 5 },
        { type: "number" as const, value: 5 }
      )).toBe(true);
    });
  });
});
