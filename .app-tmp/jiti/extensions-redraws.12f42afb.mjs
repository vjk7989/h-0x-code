"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;






var _piTui = await jitiImport("@earendil-works/pi-tui"); /**
 * Redraws Extension
 *
 * Exposes /tui to show TUI redraw stats.
 */function _default(pi) {pi.registerCommand("tui", { description: "Show TUI stats",
      handler: async (_args, ctx) => {
        if (!ctx.hasUI) return;
        let redraws = 0;
        await ctx.ui.custom((tui, _theme, _keybindings, done) => {
          redraws = tui.fullRedraws;
          done(undefined);
          return new _piTui.Text("", 0, 0);
        });
        ctx.ui.notify(`TUI full redraws: ${redraws}`, "info");
      }
    });
} /* v9-1fb79420585f9eb3 */
