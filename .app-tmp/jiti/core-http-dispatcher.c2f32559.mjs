"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.HTTP_IDLE_TIMEOUT_CHOICES = exports.DEFAULT_HTTP_IDLE_TIMEOUT_MS = void 0;exports.applyHttpProxySettings = applyHttpProxySettings;exports.configureHttpDispatcher = configureHttpDispatcher;exports.formatHttpIdleTimeoutMs = formatHttpIdleTimeoutMs;exports.parseHttpIdleTimeoutMs = parseHttpIdleTimeoutMs;var undici = _interopRequireWildcard(await jitiImport("undici"));function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}

const DEFAULT_HTTP_IDLE_TIMEOUT_MS = exports.DEFAULT_HTTP_IDLE_TIMEOUT_MS = 300_000;

const HTTP_IDLE_TIMEOUT_CHOICES = exports.HTTP_IDLE_TIMEOUT_CHOICES = [
{ label: "30 sec", timeoutMs: 30_000 },
{ label: "1 min", timeoutMs: 60_000 },
{ label: "2 min", timeoutMs: 120_000 },
{ label: "5 min", timeoutMs: 300_000 },
{ label: "disabled", timeoutMs: 0 }];


const originalGlobalFetch = globalThis.fetch;
let installedGlobalFetch;

function parseHttpIdleTimeoutMs(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === "disabled") {
      return 0;
    }
    if (trimmed.length === 0) {
      return undefined;
    }
    return parseHttpIdleTimeoutMs(Number(trimmed));
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function formatHttpIdleTimeoutMs(timeoutMs) {
  const choice = HTTP_IDLE_TIMEOUT_CHOICES.find((item) => item.timeoutMs === timeoutMs);
  if (choice) {
    return choice.label;
  }
  return `${timeoutMs / 1000} sec`;
}

function applyHttpProxySettings(httpProxy) {
  const proxy = httpProxy?.trim();
  if (!proxy) return;
  process.env.HTTP_PROXY ??= proxy;
  process.env.HTTPS_PROXY ??= proxy;
}

function configureHttpDispatcher(timeoutMs = DEFAULT_HTTP_IDLE_TIMEOUT_MS) {
  const normalizedTimeoutMs = parseHttpIdleTimeoutMs(timeoutMs);
  if (normalizedTimeoutMs === undefined) {
    throw new Error(`Invalid HTTP idle timeout: ${String(timeoutMs)}`);
  }
  undici.setGlobalDispatcher(
    new undici.EnvHttpProxyAgent({
      allowH2: false,
      bodyTimeout: normalizedTimeoutMs,
      headersTimeout: normalizedTimeoutMs
    })
  );
  // Keep fetch and the dispatcher on the same undici implementation. Node 26.0's
  // bundled fetch can otherwise consume compressed responses through npm undici's
  // dispatcher without decompressing them, causing response.json() failures.
  // If a caller replaced fetch after module load, preserve that deliberate override.
  const shouldInstallGlobals =
  installedGlobalFetch === undefined ?
  globalThis.fetch === originalGlobalFetch :
  globalThis.fetch === installedGlobalFetch;
  if (shouldInstallGlobals) {
    undici.install?.();
    installedGlobalFetch = globalThis.fetch;
  }
} /* v9-8bf90837ca234635 */
