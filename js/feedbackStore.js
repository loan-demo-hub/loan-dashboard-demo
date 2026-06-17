/**
 * Feedback Store — adoption rate tracking with localStorage persistence.
 */
const FeedbackStore = (() => {
  const STORAGE_KEY = "loan-dashboard-adoption-feedback";

  /** Demo baseline shown on first load (124 total · 89 rated · 76.4% adoption). */
  const DEMO_BASELINE = {
    totalAssistantResponses: 124,
    ratedCount: 89,
    adoptedCount: 68,
  };

  let data = { version: 1, messages: {} };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.messages && typeof parsed.messages === "object") {
        data = { version: 1, messages: parsed.messages };
      }
    } catch {
      data = { version: 1, messages: {} };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or unavailable */
    }
  }

  function registerMessage(messageId, meta = {}) {
    if (!messageId || data.messages[messageId]) return;
    data.messages[messageId] = {
      feedback: null,
      createdAt: new Date().toISOString(),
      contractId: meta.contractId || null,
    };
    save();
  }

  function setFeedback(messageId, feedback) {
    if (!messageId || !data.messages[messageId]) return;
    data.messages[messageId].feedback = feedback;
    save();
  }

  function getFeedback(messageId) {
    return data.messages[messageId]?.feedback ?? null;
  }

  function getMetrics() {
    const entries = Object.values(data.messages);
    const sessionTotal = entries.length;
    const sessionRated = entries.filter(
      (m) => m.feedback === "adopted" || m.feedback === "not_adopted"
    );
    const sessionAdopted = sessionRated.filter((m) => m.feedback === "adopted");

    const totalAssistantResponses = DEMO_BASELINE.totalAssistantResponses + sessionTotal;
    const ratedCount = DEMO_BASELINE.ratedCount + sessionRated.length;
    const adoptedCount = DEMO_BASELINE.adoptedCount + sessionAdopted.length;
    const adoptionRate = ratedCount > 0 ? adoptedCount / ratedCount : 0;

    return {
      totalAssistantResponses,
      ratedCount,
      adoptedCount,
      adoptionRate,
      adoptionRatePercent: ratedCount > 0 ? `${(adoptionRate * 100).toFixed(1)}%` : "—",
    };
  }

  return {
    load,
    registerMessage,
    setFeedback,
    getFeedback,
    getMetrics,
  };
})();
