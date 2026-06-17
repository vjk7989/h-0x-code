"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.formatKeyText = formatKeyText;exports.keyDisplayText = keyDisplayText;exports.keyHint = keyHint;exports.keyText = keyText;exports.rawKeyHint = rawKeyHint;



var _piTui = await jitiImport("@earendil-works/pi-tui");
var _theme = await jitiImport("../theme/theme.ts"); /**
 * Utilities for formatting keybinding hints in the UI.
 */



function formatKeyPart(part, options) {
  const displayPart = process.platform === "darwin" && part.toLowerCase() === "alt" ? "option" : part;
  return options.capitalize ? displayPart.charAt(0).toUpperCase() + displayPart.slice(1) : displayPart;
}

function formatKeyText(key, options = {}) {
  return key.
  split("/").
  map((k) =>
  k.
  split("+").
  map((part) => formatKeyPart(part, options)).
  join("+")
  ).
  join("/");
}

function formatKeys(keys, options = {}) {
  if (keys.length === 0) return "";
  return formatKeyText(keys.join("/"), options);
}

function keyText(keybinding) {
  return formatKeys((0, _piTui.getKeybindings)().getKeys(keybinding));
}

function keyDisplayText(keybinding) {
  return formatKeys((0, _piTui.getKeybindings)().getKeys(keybinding), { capitalize: true });
}

function keyHint(keybinding, description) {
  return _theme.theme.fg("dim", keyText(keybinding)) + _theme.theme.fg("muted", ` ${description}`);
}

function rawKeyHint(key, description) {
  return _theme.theme.fg("dim", formatKeyText(key)) + _theme.theme.fg("muted", ` ${description}`);
} /* v9-b61fd1c78631e608 */
