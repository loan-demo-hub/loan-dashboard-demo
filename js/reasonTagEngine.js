/**
 * Overdue Reason Tag Engine — DPD filter, keyword match, contract assignment, layered scripts.
 */
const ReasonTagEngine = (() => {
  let config = null;

  const OCCUPATION_HINTS = {
    自由职业: ["FIN_INCOME_UNSTABLE", "FIN_CASH_INSUFFICIENT", "JOB_UNSTABLE"],
    个体经营: ["JOB_BUSINESS_HARD", "FIN_INCOME_DELAY", "FIN_CASH_INSUFFICIENT"],
    小微企业主: ["JOB_BUSINESS_HARD", "FIN_INCOME_DELAY", "DEBT_OTHER"],
    制造业工人: ["FIN_INCOME_DELAY", "FIN_INCOME_DROP", "JOB_UNSTABLE"],
    服务业从业: ["FIN_INCOME_UNSTABLE", "FIN_INCOME_DROP", "JOB_UNSTABLE"],
    企业职员: ["FIN_INCOME_DELAY", "FIN_INCOME_DROP", "DEBT_MORTGAGE"],
    公务员: ["FIN_INCOME_DROP", "FIN_DEPOSIT_INSUFFICIENT", "DEBT_MORTGAGE"],
  };

  async function init(tagsUrl) {
    config = await YamlLoader.loadWithFallback(tagsUrl);
    const tags = getTags();
    if (!tags.length) {
      throw new Error("overdue_reason_tags.yaml contains no tags");
    }
    return config;
  }

  function getTags() {
    return config?.tags || [];
  }

  function getTagByCode(code) {
    return getTags().find((t) => t.code === code) || null;
  }

  function dpdMatches(dpdHint, overdueDays) {
    const hint = String(dpdHint || "").trim();
    const dpd = Number(overdueDays) || 0;
    if (!hint || hint === "全周期") return true;
    if (hint === "30内") return dpd <= 30;
    const plus = hint.match(/^(\d+)\+$/);
    if (plus) return dpd >= parseInt(plus[1], 10);
    const range = hint.match(/^(\d+)\s*[-~–]\s*(\d+)$/);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      return dpd >= lo && dpd <= hi;
    }
    return true;
  }

  function filterByDpd(overdueDays) {
    return getTags().filter((tag) => dpdMatches(tag.dpd_hint, overdueDays));
  }

  function getMatchedKeywords(input, tag) {
    const text = String(input || "").toLowerCase();
    const keywords = tag.keywords || [];
    return keywords.filter((kw) => text.includes(String(kw).toLowerCase()));
  }

  function scoreTagForInput(input, tag) {
    const matched = getMatchedKeywords(input, tag);
    if (!matched.length) return null;
    let score = matched.length;
    if (tag.realtime_priority) score += 2;
    const intensity = String(tag.risk_intensity || "");
    if (intensity === "高") score += 1;
    else if (intensity === "中") score += 0.5;
    return { tag, matched, score };
  }

  function matchFromInput(userInput, contract) {
    const input = String(userInput || "").trim();
    if (!input || !contract) return null;

    const candidates = filterByDpd(contract.overdueDays)
      .map((tag) => scoreTagForInput(input, tag))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) return null;

    const best = candidates[0];
    return {
      tag: best.tag,
      matchedKeywords: best.matched,
      reasonScripts: buildLayeredScripts(best.tag),
    };
  }

  function buildLayeredScripts(tag) {
    if (!tag) return null;
    const open = String(tag.script_open || "").trim();
    const empathy = String(tag.script_empathy || "").trim();
    const solution = String(tag.script_solution || "").trim();
    const combined = [open, empathy, solution].filter(Boolean).join("\n");
    return { open, empathy, solution, combined };
  }

  function pickAssignTag(contract, index) {
    const pool = filterByDpd(contract.overdueDays);
    if (!pool.length) return getTags()[index % getTags().length];

    const occupation = contract.customerProfile?.occupation || "";
    const preferredCodes = OCCUPATION_HINTS[occupation] || [];
    const weighted = [];

    for (const tag of pool) {
      let weight = 1;
      if (preferredCodes.includes(tag.code)) weight += 3;
      if (tag.realtime_priority) weight += 1;
      for (let w = 0; w < weight; w++) weighted.push(tag);
    }

    return weighted[(index * 7 + contract.overdueDays) % weighted.length];
  }

  function assignToContract(contract, index = 0) {
    if (contract.isDemo && contract.overdueReason?.code) return contract;

    const tag = pickAssignTag(contract, index);
    contract.overdueReason = {
      code: tag.code,
      name: tag.name,
      category: tag.category,
      dpdHint: tag.dpd_hint,
      riskIntensity: tag.risk_intensity,
    };
    return contract;
  }

  function assignToAll(contracts) {
    contracts.forEach((c, i) => assignToContract(c, i));
    return contracts;
  }

  function resolveForContract(contract) {
    if (!contract?.overdueReason?.code) return null;
    const tag = getTagByCode(contract.overdueReason.code);
    if (!tag) return null;
    return {
      tag,
      matchedKeywords: [],
      reasonScripts: buildLayeredScripts(tag),
      fromAssignment: true,
    };
  }

  return {
    init,
    getTags,
    getTagByCode,
    dpdMatches,
    filterByDpd,
    matchFromInput,
    buildLayeredScripts,
    assignToContract,
    assignToAll,
    resolveForContract,
    getMatchedKeywords,
  };
})();
