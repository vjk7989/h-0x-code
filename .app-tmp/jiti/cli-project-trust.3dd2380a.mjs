"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createProjectTrustContext = createProjectTrustContext;var _chalk = _interopRequireDefault(await jitiImport("chalk"));



var _startupUi = await jitiImport("./startup-ui.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

function createProjectTrustContext(options)




{
  return {
    cwd: options.cwd,
    mode: options.mode === "interactive" ? "tui" : options.mode,
    hasUI: options.hasUI,
    ui: {
      select: async (title, selectOptions) => {
        if (!options.hasUI) {
          return undefined;
        }
        if (options.mode !== "interactive") {
          return undefined;
        }
        return (0, _startupUi.showStartupSelector)(
          options.settingsManager,
          title,
          selectOptions.map((option) => ({ label: option, value: option }))
        );
      },
      confirm: async (title, message) => {
        if (!options.hasUI) {
          return false;
        }
        if (options.mode !== "interactive") {
          return false;
        }
        return (
          (await (0, _startupUi.showStartupSelector)(options.settingsManager, `${title}\n${message}`, [
          { label: "Yes", value: true },
          { label: "No", value: false }]
          )) ?? false);

      },
      input: async (title, placeholder) => {
        if (!options.hasUI) {
          return undefined;
        }
        if (options.mode !== "interactive") {
          return undefined;
        }
        return (0, _startupUi.showStartupInput)(options.settingsManager, title, placeholder);
      },
      notify: (message, type = "info") => {
        if (options.mode !== "interactive") {
          const color = type === "error" ? _chalk.default.red : type === "warning" ? _chalk.default.yellow : _chalk.default.cyan;
          console.error(color(message));
        }
      }
    }
  };
} /* v9-64b4f5bb612d650d */
