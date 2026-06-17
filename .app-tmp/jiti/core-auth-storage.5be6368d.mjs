"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.InMemoryAuthStorageBackend = exports.FileAuthStorageBackend = exports.AuthStorage = void 0;







var _piAi = await jitiImport("@earendil-works/pi-ai");






var _oauth = await jitiImport("@earendil-works/pi-ai/oauth");
var _fs = await jitiImport("fs");
var _path = await jitiImport("path");
var _properLockfile = _interopRequireDefault(await jitiImport("proper-lockfile"));
var _config = await jitiImport("../config.ts");
var _paths = await jitiImport("../utils/paths.ts");
var _resolveConfigValue = await jitiImport("./resolve-config-value.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };} /**
 * Credential storage for API keys and OAuth tokens.
 * Handles loading, saving, and refreshing credentials from auth.json.
 *
 * Uses file locking to prevent race conditions when multiple pi instances
 * try to refresh tokens simultaneously.
 */




















const AUTH_FILE_WRITE_OPTIONS = { encoding: "utf-8", mode: 0o600 };






class FileAuthStorageBackend {
  authPath;

  constructor(authPath = (0, _path.join)((0, _config.getAgentDir)(), "auth.json")) {
    this.authPath = (0, _paths.normalizePath)(authPath);
  }

  ensureParentDir() {
    const dir = (0, _path.dirname)(this.authPath);
    if (!(0, _fs.existsSync)(dir)) {
      (0, _fs.mkdirSync)(dir, { recursive: true, mode: 0o700 });
    }
  }

  ensureFileExists() {
    if (!(0, _fs.existsSync)(this.authPath)) {
      (0, _fs.writeFileSync)(this.authPath, "{}", AUTH_FILE_WRITE_OPTIONS);
      (0, _fs.chmodSync)(this.authPath, 0o600);
    }
  }

  acquireLockSyncWithRetry(path) {
    const maxAttempts = 10;
    const delayMs = 20;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return _properLockfile.default.lockSync(path, { realpath: false });
      } catch (error) {
        const code =
        typeof error === "object" && error !== null && "code" in error ?
        String(error.code) :
        undefined;
        if (code !== "ELOCKED" || attempt === maxAttempts) {
          throw error;
        }
        lastError = error;
        const start = Date.now();
        while (Date.now() - start < delayMs) {

          // Sleep synchronously to avoid changing callers to async.
        }}
    }

    throw lastError ?? new Error("Failed to acquire auth storage lock");
  }

  withLock(fn) {
    this.ensureParentDir();
    this.ensureFileExists();

    let release;
    try {
      release = this.acquireLockSyncWithRetry(this.authPath);
      const current = (0, _fs.existsSync)(this.authPath) ? (0, _fs.readFileSync)(this.authPath, "utf-8") : undefined;
      const { result, next } = fn(current);
      if (next !== undefined) {
        (0, _fs.writeFileSync)(this.authPath, next, AUTH_FILE_WRITE_OPTIONS);
        (0, _fs.chmodSync)(this.authPath, 0o600);
      }
      return result;
    } finally {
      if (release) {
        release();
      }
    }
  }

  async withLockAsync(fn) {
    this.ensureParentDir();
    this.ensureFileExists();

    let release;
    let lockCompromised = false;
    let lockCompromisedError;
    const throwIfCompromised = () => {
      if (lockCompromised) {
        throw lockCompromisedError ?? new Error("Auth storage lock was compromised");
      }
    };

    try {
      release = await _properLockfile.default.lock(this.authPath, {
        retries: {
          retries: 10,
          factor: 2,
          minTimeout: 100,
          maxTimeout: 10000,
          randomize: true
        },
        stale: 30000,
        onCompromised: (err) => {
          lockCompromised = true;
          lockCompromisedError = err;
        }
      });

      throwIfCompromised();
      const current = (0, _fs.existsSync)(this.authPath) ? (0, _fs.readFileSync)(this.authPath, "utf-8") : undefined;
      const { result, next } = await fn(current);
      throwIfCompromised();
      if (next !== undefined) {
        (0, _fs.writeFileSync)(this.authPath, next, AUTH_FILE_WRITE_OPTIONS);
        (0, _fs.chmodSync)(this.authPath, 0o600);
      }
      throwIfCompromised();
      return result;
    } finally {
      if (release) {
        try {
          await release();
        } catch {

          // Ignore unlock errors when lock is compromised.
        }}
    }
  }
}exports.FileAuthStorageBackend = FileAuthStorageBackend;

class InMemoryAuthStorageBackend {
  value;

  withLock(fn) {
    const { result, next } = fn(this.value);
    if (next !== undefined) {
      this.value = next;
    }
    return result;
  }

  async withLockAsync(fn) {
    const { result, next } = await fn(this.value);
    if (next !== undefined) {
      this.value = next;
    }
    return result;
  }
}

/**
 * Credential storage backed by a JSON file.
 */exports.InMemoryAuthStorageBackend = InMemoryAuthStorageBackend;
class AuthStorage {
  data = {};
  runtimeOverrides = new Map();
  fallbackResolver;
  loadError = null;
  errors = [];
  storage;

  constructor(storage) {
    this.storage = storage;
    this.reload();
  }

  static create(authPath) {
    return new AuthStorage(new FileAuthStorageBackend(authPath ?? (0, _path.join)((0, _config.getAgentDir)(), "auth.json")));
  }

  static fromStorage(storage) {
    return new AuthStorage(storage);
  }

  static inMemory(data = {}) {
    const storage = new InMemoryAuthStorageBackend();
    storage.withLock(() => ({ result: undefined, next: JSON.stringify(data, null, 2) }));
    return AuthStorage.fromStorage(storage);
  }

  /**
   * Set a runtime API key override (not persisted to disk).
   * Used for CLI --api-key flag.
   */
  setRuntimeApiKey(provider, apiKey) {
    this.runtimeOverrides.set(provider, apiKey);
  }

  /**
   * Remove a runtime API key override.
   */
  removeRuntimeApiKey(provider) {
    this.runtimeOverrides.delete(provider);
  }

  /**
   * Set a fallback resolver for API keys not found in auth.json or env vars.
   * Used for custom provider keys from models.json.
   */
  setFallbackResolver(resolver) {
    this.fallbackResolver = resolver;
  }

  recordError(error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    this.errors.push(normalizedError);
  }

  parseStorageData(content) {
    if (!content) {
      return {};
    }
    return JSON.parse(content);
  }

  /**
   * Reload credentials from storage.
   */
  reload() {
    let content;
    try {
      this.storage.withLock((current) => {
        content = current;
        return { result: undefined };
      });
      this.data = this.parseStorageData(content);
      this.loadError = null;
    } catch (error) {
      this.loadError = error;
      this.recordError(error);
    }
  }

  persistProviderChange(provider, credential) {
    if (this.loadError) {
      return;
    }

    try {
      this.storage.withLock((current) => {
        const currentData = this.parseStorageData(current);
        const merged = { ...currentData };
        if (credential) {
          merged[provider] = credential;
        } else {
          delete merged[provider];
        }
        return { result: undefined, next: JSON.stringify(merged, null, 2) };
      });
    } catch (error) {
      this.recordError(error);
    }
  }

  /**
   * Get credential for a provider.
   */
  get(provider) {
    return this.data[provider] ?? undefined;
  }

  /**
   * Get provider-scoped environment values for an API key credential.
   */
  getProviderEnv(provider) {
    const cred = this.data[provider];
    return cred?.type === "api_key" && cred.env ? { ...cred.env } : undefined;
  }

  /**
   * Set credential for a provider.
   */
  set(provider, credential) {
    this.data[provider] = credential;
    this.persistProviderChange(provider, credential);
  }

  /**
   * Remove credential for a provider.
   */
  remove(provider) {
    delete this.data[provider];
    this.persistProviderChange(provider, undefined);
  }

  /**
   * List all providers with credentials.
   */
  list() {
    return Object.keys(this.data);
  }

  /**
   * Check if credentials exist for a provider in auth.json.
   */
  has(provider) {
    return provider in this.data;
  }

  /**
   * Check if any form of auth is configured for a provider.
   * Unlike getApiKey(), this doesn't refresh OAuth tokens.
   */
  hasAuth(provider) {
    if (this.runtimeOverrides.has(provider)) return true;
    if (this.data[provider]) return true;
    if ((0, _piAi.getEnvApiKey)(provider)) return true;
    if (this.fallbackResolver?.(provider)) return true;
    return false;
  }

  /**
   * Return auth status without exposing credential values or refreshing tokens.
   */
  getAuthStatus(provider) {
    if (this.data[provider]) {
      return { configured: true, source: "stored" };
    }

    if (this.runtimeOverrides.has(provider)) {
      return { configured: false, source: "runtime", label: "--api-key" };
    }

    const envKeys = (0, _piAi.findEnvKeys)(provider);
    if (envKeys?.[0]) {
      return { configured: false, source: "environment", label: envKeys[0] };
    }

    if (this.fallbackResolver?.(provider)) {
      return { configured: false, source: "fallback", label: "custom provider config" };
    }

    return { configured: false };
  }

  /**
   * Get all credentials (for passing to getOAuthApiKey).
   */
  getAll() {
    return { ...this.data };
  }

  drainErrors() {
    const drained = [...this.errors];
    this.errors = [];
    return drained;
  }

  /**
   * Login to an OAuth provider.
   */
  async login(providerId, callbacks) {
    const provider = (0, _oauth.getOAuthProvider)(providerId);
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const credentials = await provider.login(callbacks);
    this.set(providerId, { type: "oauth", ...credentials });
  }

  /**
   * Logout from a provider.
   */
  logout(provider) {
    this.remove(provider);
  }

  /**
   * Refresh OAuth token with backend locking to prevent race conditions.
   * Multiple pi instances may try to refresh simultaneously when tokens expire.
   */
  async refreshOAuthTokenWithLock(
  providerId)
  {
    const provider = (0, _oauth.getOAuthProvider)(providerId);
    if (!provider) {
      return null;
    }

    const result = await this.storage.withLockAsync(async (current) => {
      const currentData = this.parseStorageData(current);
      this.data = currentData;
      this.loadError = null;

      const cred = currentData[providerId];
      if (cred?.type !== "oauth") {
        return { result: null };
      }

      if (Date.now() < cred.expires) {
        return { result: { apiKey: provider.getApiKey(cred), newCredentials: cred } };
      }

      const oauthCreds = {};
      for (const [key, value] of Object.entries(currentData)) {
        if (value.type === "oauth") {
          oauthCreds[key] = value;
        }
      }

      const refreshed = await (0, _oauth.getOAuthApiKey)(providerId, oauthCreds);
      if (!refreshed) {
        return { result: null };
      }

      const merged = {
        ...currentData,
        [providerId]: { type: "oauth", ...refreshed.newCredentials }
      };
      this.data = merged;
      this.loadError = null;
      return { result: refreshed, next: JSON.stringify(merged, null, 2) };
    });

    return result;
  }

  /**
   * Get API key for a provider.
   * Priority:
   * 1. Runtime override (CLI --api-key)
   * 2. API key from auth.json
   * 3. OAuth token from auth.json (auto-refreshed with locking)
   * 4. Environment variable
   * 5. Fallback resolver (models.json custom providers)
   */
  async getApiKey(providerId, options) {
    // Runtime override takes highest priority
    const runtimeKey = this.runtimeOverrides.get(providerId);
    if (runtimeKey) {
      return runtimeKey;
    }

    const cred = this.data[providerId];

    if (cred?.type === "api_key") {
      return (0, _resolveConfigValue.resolveConfigValue)(cred.key, cred.env);
    }

    if (cred?.type === "oauth") {
      const provider = (0, _oauth.getOAuthProvider)(providerId);
      if (!provider) {
        // Unknown OAuth provider, can't get API key
        return undefined;
      }

      // Check if token needs refresh
      const needsRefresh = Date.now() >= cred.expires;

      if (needsRefresh) {
        // Use locked refresh to prevent race conditions
        try {
          const result = await this.refreshOAuthTokenWithLock(providerId);
          if (result) {
            return result.apiKey;
          }
        } catch (error) {
          this.recordError(error);
          // Refresh failed - re-read file to check if another instance succeeded
          this.reload();
          const updatedCred = this.data[providerId];

          if (updatedCred?.type === "oauth" && Date.now() < updatedCred.expires) {
            // Another instance refreshed successfully, use those credentials
            return provider.getApiKey(updatedCred);
          }

          // Refresh truly failed - return undefined so model discovery skips this provider
          // User can /login to re-authenticate (credentials preserved for retry)
          return undefined;
        }
      } else {
        // Token not expired, use current access token
        return provider.getApiKey(cred);
      }
    }

    // Fall back to environment variable
    const envKey = (0, _piAi.getEnvApiKey)(providerId);
    if (envKey) return envKey;

    // Fall back to custom resolver (e.g., models.json custom providers)
    if (options?.includeFallback !== false) {
      return this.fallbackResolver?.(providerId) ?? undefined;
    }

    return undefined;
  }

  /**
   * Get all registered OAuth providers
   */
  getOAuthProviders() {
    return (0, _oauth.getOAuthProviders)();
  }
}exports.AuthStorage = AuthStorage; /* v9-9b8d0db8b5cd6ddb */
