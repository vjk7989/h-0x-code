"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtensionEditorComponent = void 0;




var _nodeChild_process = await jitiImport("node:child_process");
var fs = _interopRequireWildcard(await jitiImport("node:fs"));
var os = _interopRequireWildcard(await jitiImport("node:os"));
var path = _interopRequireWildcard(await jitiImport("node:path"));
var _piTui = await jitiImport("@earendil-works/pi-tui");










var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} /**
 * Multi-line editor component for extensions.
 * Supports Ctrl+G for external editor.
 */class ExtensionEditorComponent extends _piTui.Container {editor;
  onSubmitCallback;
  onCancelCallback;
  tui;
  keybindings;

  _focused = false;
  get focused() {
    return this._focused;
  }
  set focused(value) {
    this._focused = value;
    this.editor.focused = value;
  }

  constructor(
  tui,
  keybindings,
  title,
  prefill,
  onSubmit,
  onCancel,
  options)
  {
    super();

    this.tui = tui;
    this.keybindings = keybindings;
    this.onSubmitCallback = onSubmit;
    this.onCancelCallback = onCancel;

    // Add top border
    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));

    // Add title
    this.addChild(new _piTui.Text(_theme.theme.fg("accent", title), 1, 0));
    this.addChild(new _piTui.Spacer(1));

    // Create editor
    this.editor = new _piTui.Editor(tui, (0, _theme.getEditorTheme)(), options);
    if (prefill) {
      this.editor.setText(prefill);
    }
    // Wire up Enter to submit (Shift+Enter for newlines, like the main editor)
    this.editor.onSubmit = (text) => {
      this.onSubmitCallback(text);
    };
    this.addChild(this.editor);

    this.addChild(new _piTui.Spacer(1));

    // Add hint
    const hasExternalEditor = !!(process.env.VISUAL || process.env.EDITOR);
    const hint =
    (0, _keybindingHints.keyHint)("tui.select.confirm", "submit") +
    "  " +
    (0, _keybindingHints.keyHint)("tui.input.newLine", "newline") +
    "  " +
    (0, _keybindingHints.keyHint)("tui.select.cancel", "cancel") + (
    hasExternalEditor ? `  ${(0, _keybindingHints.keyHint)("app.editor.external", "external editor")}` : "");
    this.addChild(new _piTui.Text(hint, 1, 0));

    this.addChild(new _piTui.Spacer(1));

    // Add bottom border
    this.addChild(new _dynamicBorder.DynamicBorder());
  }

  handleInput(keyData) {
    const kb = (0, _piTui.getKeybindings)();
    // Escape or Ctrl+C to cancel
    if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
      return;
    }

    // External editor (app keybinding)
    if (this.keybindings.matches(keyData, "app.editor.external")) {
      this.openExternalEditor();
      return;
    }

    // Forward to editor
    this.editor.handleInput(keyData);
  }

  async openExternalEditor() {
    const editorCmd = process.env.VISUAL || process.env.EDITOR;
    if (!editorCmd) {
      return;
    }

    const currentText = this.editor.getText();
    const tmpFile = path.join(os.tmpdir(), `pi-extension-editor-${Date.now()}.md`);

    try {
      fs.writeFileSync(tmpFile, currentText, "utf-8");
      this.tui.stop();

      const [editor, ...editorArgs] = editorCmd.split(" ");
      process.stdout.write(`Launching external editor: ${editorCmd}\nPi will resume when the editor exits.\n`);

      // Do not use spawnSync here. On Windows, synchronous child_process calls can keep
      // Node/libuv's console input read active after tui.stop() pauses stdin, racing
      // vim/nvim for the console input buffer until Ctrl+C cancels the pending read.
      const status = await new Promise((resolve) => {
        const child = (0, _nodeChild_process.spawn)(editor, [...editorArgs, tmpFile], {
          stdio: "inherit",
          shell: process.platform === "win32"
        });
        child.on("error", () => resolve(null));
        child.on("close", (code) => resolve(code));
      });

      if (status === 0) {
        const newContent = fs.readFileSync(tmpFile, "utf-8").replace(/\n$/, "");
        this.editor.setText(newContent);
      }
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {

        // Ignore cleanup errors
      }this.tui.start();
      // Force full re-render since external editor uses alternate screen
      this.tui.requestRender(true);
    }
  }
}exports.ExtensionEditorComponent = ExtensionEditorComponent; /* v9-7d025ca8aac21110 */
