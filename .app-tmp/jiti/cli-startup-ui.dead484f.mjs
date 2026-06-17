"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.shouldRunFirstTimeSetup = shouldRunFirstTimeSetup;exports.showFirstTimeSetup = showFirstTimeSetup;exports.showStartupInput = showStartupInput;exports.showStartupSelector = showStartupSelector;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _fs = await jitiImport("fs");
var _config = await jitiImport("../config.ts");
var _experimental = await jitiImport("../core/experimental.ts");
var _keybindings = await jitiImport("../core/keybindings.ts");

var _extensionInput = await jitiImport("../modes/interactive/components/extension-input.ts");
var _extensionSelector = await jitiImport("../modes/interactive/components/extension-selector.ts");
var _firstTimeSetup = await jitiImport("../modes/interactive/components/first-time-setup.ts");



var _theme = await jitiImport("../modes/interactive/theme/theme.ts");

const OFFICIAL_PACKAGE_NAME = "@earendil-works/pi-coding-agent";
const OFFICIAL_APP_NAME = "pi";
const OFFICIAL_CONFIG_DIR_NAME = ".pi";







function isOfficialDistribution({ packageName, appName, configDirName }) {
  return (
    packageName === OFFICIAL_PACKAGE_NAME &&
    appName === OFFICIAL_APP_NAME &&
    configDirName === OFFICIAL_CONFIG_DIR_NAME);

}

function createStartupTui(settingsManager) {
  (0, _theme.initTheme)(settingsManager.getTheme());
  (0, _piTui.setKeybindings)(_keybindings.KeybindingsManager.create());
  const ui = new _piTui.TUI(new _piTui.ProcessTerminal(), settingsManager.getShowHardwareCursor());
  ui.setClearOnShrink(settingsManager.getClearOnShrink());
  return ui;
}

async function clearStartupTui(ui) {
  ui.clear();
  ui.requestRender();
  await new Promise((resolve) => setTimeout(resolve, 25));
}

/**
 * First-time setup runs when all of these hold:
 * - this is the official Pi distribution (not a fork/rebrand)
 * - experimental features are enabled (PI_EXPERIMENTAL=1)
 * - the default agent directory is used (no custom agent dir override)
 * - setup was not completed before (settings.json does not exist)
 */
function shouldRunFirstTimeSetup(settingsPath = (0, _config.getSettingsPath)()) {
  if (
  !isOfficialDistribution({
    packageName: _config.PACKAGE_NAME,
    appName: _config.APP_NAME,
    configDirName: _config.CONFIG_DIR_NAME
  }))
  {
    return false;
  }
  if (!(0, _experimental.areExperimentalFeaturesEnabled)()) {
    return false;
  }
  if (process.env[_config.ENV_AGENT_DIR]) {
    return false;
  }
  return !(0, _fs.existsSync)(settingsPath);
}

async function showStartupSelector(
settingsManager,
title,
options)
{
  return new Promise((resolve) => {
    const ui = createStartupTui(settingsManager);

    let settled = false;
    const finish = async (result) => {
      if (settled) {
        return;
      }
      settled = true;
      await clearStartupTui(ui);
      ui.stop();
      resolve(result);
    };

    const selector = new _extensionSelector.ExtensionSelectorComponent(
      title,
      options.map((option) => option.label),
      (option) => void finish(options.find((entry) => entry.label === option)?.value),
      () => void finish(undefined),
      { tui: ui }
    );
    ui.addChild(selector);
    ui.setFocus(selector);
    ui.start();
  });
}

/** Show the first-time setup dialog and persist the result */
async function showFirstTimeSetup(settingsManager) {
  return new Promise((resolve) => {
    const ui = createStartupTui(settingsManager);

    let settled = false;
    const finish = async (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (result) {
        settingsManager.setTheme(result.theme);
        settingsManager.setEnableAnalytics(result.shareAnalytics);
        await settingsManager.flush();
      }
      await clearStartupTui(ui);
      ui.stop();
      resolve();
    };

    const showSetup = async () => {
      ui.start();
      const detection = await (0, _theme.detectTerminalBackgroundTheme)({ ui, timeoutMs: 100 });
      (0, _theme.setTheme)(detection.theme);
      const component = new _firstTimeSetup.FirstTimeSetupComponent({
        detectedTheme: detection.theme,
        onThemePreview: (themeName) => {
          (0, _theme.setTheme)(themeName);
          ui.requestRender();
        },
        onSubmit: (result) => void finish(result),
        onCancel: () => void finish(undefined)
      });
      ui.addChild(component);
      ui.setFocus(component);
      ui.requestRender();
    };

    void showSetup();
  });
}

async function showStartupInput(
settingsManager,
title,
placeholder)
{
  return new Promise((resolve) => {
    const ui = createStartupTui(settingsManager);

    let settled = false;
    const finish = async (result) => {
      if (settled) {
        return;
      }
      settled = true;
      input.dispose();
      await clearStartupTui(ui);
      ui.stop();
      resolve(result);
    };

    const input = new _extensionInput.ExtensionInputComponent(
      title,
      placeholder,
      (value) => void finish(value),
      () => void finish(undefined),
      {
        tui: ui
      }
    );
    ui.addChild(input);
    ui.setFocus(input);
    ui.start();
  });
} /* v9-8710f9241b5dada5 */
