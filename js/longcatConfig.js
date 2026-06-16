/**
 * LongCat API settings — persisted in localStorage (demo only; use server env in production).
 */
const LongCatConfig = (() => {
  const STORAGE_KEY = "loan_dashboard_longcat";
  /** 当前平台仅开放此模型 */
  const MODEL = "LongCat-2.0-Preview";
  const DIRECT_BASE = "https://api.longcat.chat/openai";
  const PROXY_BASE = "/api/longcat";

  let cache = null;

  function defaults() {
    const local = isLocalHost();
    return {
      enabled: false,
      apiKey: "",
      model: MODEL,
      useProxy: local,
      baseUrl: local ? PROXY_BASE : DIRECT_BASE,
      temperature: 0.3,
      maxTokens: 4096,
    };
  }

  function isLocalHost() {
    try {
      return /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    } catch {
      return false;
    }
  }

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
      parsed.model = MODEL;
      cache = parsed;
    } catch {
      cache = defaults();
    }
    return cache;
  }

  function save(partial) {
    cache = { ...load(), ...partial, model: MODEL };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    return cache;
  }

  function isConfigured() {
    const cfg = load();
    if (!cfg.enabled) return false;
    if (cfg.useProxy) return true;
    return Boolean(cfg.apiKey?.trim());
  }

  function getModel() {
    return MODEL;
  }

  function getBaseUrl() {
    const cfg = load();
    return (cfg.baseUrl || PROXY_BASE).replace(/\/$/, "");
  }

  function getChatCompletionsUrl() {
    return `${getBaseUrl()}/v1/chat/completions`;
  }

  function getAnthropicMessagesUrl() {
    return `${getBaseUrl()}/v1/messages`;
  }

  function getAuthHeader() {
    const cfg = load();
    const key = cfg.apiKey?.trim();
    return key ? `Bearer ${key}` : "";
  }

  return {
    STORAGE_KEY,
    MODEL,
    DIRECT_BASE,
    PROXY_BASE,
    load,
    save,
    isConfigured,
    getModel,
    getBaseUrl,
    getChatCompletionsUrl,
    getAnthropicMessagesUrl,
    getAuthHeader,
  };
})();
