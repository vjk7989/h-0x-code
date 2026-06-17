"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.EarendilAnnouncementComponent = void 0;var fs = _interopRequireWildcard(await jitiImport("node:fs"));
var _piTui = await jitiImport("@earendil-works/pi-tui");
var _config = await jitiImport("../../../config.ts");
var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}

const BLOG_URL = "https://mariozechner.at/posts/2026-04-08-ive-sold-out/";
const IMAGE_FILENAME = "clankolas.png";

let cachedImageBase64;
let attemptedImageLoad = false;

function loadImageBase64() {
  if (attemptedImageLoad) {
    return cachedImageBase64;
  }

  attemptedImageLoad = true;
  try {
    cachedImageBase64 = fs.readFileSync((0, _config.getBundledInteractiveAssetPath)(IMAGE_FILENAME)).toString("base64");
  } catch {
    cachedImageBase64 = undefined;
  }
  return cachedImageBase64;
}

class EarendilAnnouncementComponent extends _piTui.Container {
  constructor() {
    super();

    this.addChild(new _dynamicBorder.DynamicBorder((text) => _theme.theme.fg("accent", text)));
    this.addChild(new _piTui.Text(_theme.theme.bold(_theme.theme.fg("accent", "pi has joined Earendil")), 1, 0));
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _piTui.Text(_theme.theme.fg("muted", "Read the blog post:"), 1, 0));
    this.addChild(new _piTui.Text(_theme.theme.fg("mdLink", BLOG_URL), 1, 0));
    this.addChild(new _piTui.Spacer(1));

    const imageBase64 = loadImageBase64();
    if (imageBase64) {
      this.addChild(
        new _piTui.Image(
          imageBase64,
          "image/png",
          { fallbackColor: (text) => _theme.theme.fg("muted", text) },
          { maxWidthCells: 56, filename: IMAGE_FILENAME }
        )
      );
      this.addChild(new _piTui.Spacer(1));
    }

    this.addChild(new _dynamicBorder.DynamicBorder((text) => _theme.theme.fg("accent", text)));
  }
}exports.EarendilAnnouncementComponent = EarendilAnnouncementComponent; /* v9-4dec7e33f677d6a3 */
