"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.copyToClipboard = copyToClipboard;var _child_process = await jitiImport("child_process");
var _os = await jitiImport("os");
var _clipboardImage = await jitiImport("./clipboard-image.ts");
var _clipboardNative = await jitiImport("./clipboard-native.ts");







function copyToX11Clipboard(options) {
  try {
    (0, _child_process.execSync)("xclip -selection clipboard", options);
  } catch {
    (0, _child_process.execSync)("xsel --clipboard --input", options);
  }
}

const MAX_OSC52_ENCODED_LENGTH = 100_000;

function isRemoteSession(env = process.env) {
  return Boolean(env.SSH_CONNECTION || env.SSH_CLIENT || env.MOSH_CONNECTION);
}

function emitOsc52(text) {
  const encoded = Buffer.from(text).toString("base64");
  if (encoded.length > MAX_OSC52_ENCODED_LENGTH) {
    return false;
  }
  process.stdout.write(`\x1b]52;c;${encoded}\x07`);
  return true;
}

async function copyToClipboard(text) {
  let copied = false;

  const p = (0, _os.platform)();

  // Prefer direct clipboard writes. Emitting OSC 52 first can make terminals
  // write the same native clipboard concurrently with the addon, and very large
  // OSC 52 payloads can desynchronize terminal rendering.
  //
  // On Linux, skip the native addon. The underlying `clipboard-rs` crate is
  // X11-only and does not retain selection ownership after `set_text`
  // resolves, so on Wayland-only compositors (Hyprland, Niri, ...) and even
  // some X11 sessions the call resolves successfully without populating the
  // clipboard. The platform tools below (wl-copy, xclip, xsel) properly
  // daemonize and keep ownership.
  try {
    if (_clipboardNative.clipboard && p !== "linux") {
      await _clipboardNative.clipboard.setText(text);
      copied = true;
    }
  } catch {

    // Fall through to platform-specific clipboard tools.
  }
  const remote = isRemoteSession();
  if (copied && !remote) {
    return;
  }

  const options = { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] };

  if (!copied) {
    try {
      if (p === "darwin") {
        (0, _child_process.execSync)("pbcopy", options);
        copied = true;
      } else if (p === "win32") {
        (0, _child_process.execSync)("clip", options);
        copied = true;
      } else {
        // Linux. Try Termux, Wayland, or X11 clipboard tools.
        if (process.env.TERMUX_VERSION) {
          try {
            (0, _child_process.execSync)("termux-clipboard-set", options);
            copied = true;
          } catch {

            // Fall back to Wayland or X11 tools.
          }}

        if (!copied) {
          const hasWaylandDisplay = Boolean(process.env.WAYLAND_DISPLAY);
          const hasX11Display = Boolean(process.env.DISPLAY);
          const isWayland = (0, _clipboardImage.isWaylandSession)();
          if (isWayland && hasWaylandDisplay) {
            try {
              // Verify wl-copy exists (spawn errors are async and won't be caught)
              (0, _child_process.execSync)("which wl-copy", { stdio: "ignore" });
              // wl-copy with execSync hangs due to fork behavior; use spawn instead
              const proc = (0, _child_process.spawn)("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
              proc.stdin.on("error", () => {

                // Ignore EPIPE errors if wl-copy exits early
              });proc.stdin.write(text);
              proc.stdin.end();
              proc.unref();
              copied = true;
            } catch {
              if (hasX11Display) {
                copyToX11Clipboard(options);
                copied = true;
              }
            }
          } else if (hasX11Display) {
            copyToX11Clipboard(options);
            copied = true;
          }
        }
      }
    } catch {

      // Fall through to OSC 52 fallback.
    }}

  if (remote || !copied) {
    const osc52Copied = emitOsc52(text);
    copied = copied || osc52Copied;
  }

  if (!copied) {
    throw new Error("Failed to copy to clipboard");
  }
} /* v9-648d7d79475d242f */
