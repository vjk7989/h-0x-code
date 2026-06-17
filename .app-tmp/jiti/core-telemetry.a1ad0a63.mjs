"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.isInstallTelemetryEnabled = isInstallTelemetryEnabled;

function isTruthyEnvFlag(value) {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function isInstallTelemetryEnabled(
settingsManager,
telemetryEnv = process.env.PI_TELEMETRY)
{
  return telemetryEnv !== undefined ? isTruthyEnvFlag(telemetryEnv) : settingsManager.getEnableInstallTelemetry();
} /* v9-907210144c2003fe */
