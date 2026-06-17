/**
 * Rule Engine — loads rules from mock-data/collection_rules.yaml only.
 * No rules are hardcoded in JavaScript.
 */
const RuleEngine = (() => {
  const OUTPUT_DIVIDER = "──────────────────────────────";

  let config = null;

  async function init(rulesUrl) {
    config = await YamlLoader.loadWithFallback(rulesUrl);
    const defaultRule = getDefaultRule();
    if (!defaultRule) {
      throw new Error(`default_rule_id "${config.default_rule_id}" not found in collection_rules.yaml`);
    }
    return config;
  }

  function getRules() {
    return config?.rules || [];
  }

  function getDefaultRule() {
    if (!config) return null;
    return config.rules.find((r) => r.id === config.default_rule_id) || null;
  }

  function getMatchedKeywords(input, rule) {
    const keywords = rule.keywords;
    if (!keywords || keywords.length === 0) return [];
    const text = input.toLowerCase();
    return keywords.filter((kw) => text.includes(String(kw).toLowerCase()));
  }

  function ruleHasKeywordMatch(input, rule) {
    return getMatchedKeywords(input, rule).length > 0;
  }

  /**
   * Select rule:
   * - Collect all keyword-matching rules (YAML order, excluding default)
   * - 0 matches → default neutral rule from YAML
   * - 1 match   → that rule
   * - 2+ matches → highest |score_delta|; tie → first in YAML order
   */
  function selectRule(userInput) {
    const input = (userInput || "").trim();
    const defaultRule = getDefaultRule();

    const candidates = config.rules.filter(
      (r) => r.id !== config.default_rule_id && ruleHasKeywordMatch(input, r)
    );

    if (candidates.length === 0) return defaultRule;
    if (candidates.length === 1) return candidates[0];

    let best = candidates[0];
    let bestSeverity = Math.abs(best.score_delta);

    for (let i = 1; i < candidates.length; i++) {
      const severity = Math.abs(candidates[i].score_delta);
      if (severity > bestSeverity) {
        best = candidates[i];
        bestSeverity = severity;
      }
    }

    return best;
  }

  function fillTemplate(template, contract, dataLayer) {
    const labels = {
      green: dataLayer.getRiskLabel("green"),
      yellow: dataLayer.getRiskLabel("yellow"),
      red: dataLayer.getRiskLabel("red"),
    };
    return String(template)
      .replace(/\{customerName\}/g, contract.customerName)
      .replace(/\{contractId\}/g, contract.contractId)
      .replace(/\{loanAmount\}/g, dataLayer.formatAmount(contract.loanAmount))
      .replace(/\{overdueDays\}/g, String(contract.overdueDays))
      .replace(/\{riskScore\}/g, String(contract.riskScore))
      .replace(/\{riskLevel\}/g, labels[contract.riskLevel] || contract.riskLevel)
      .trim();
  }

  function clampScore(score) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function buildAnalysisOutput(
    rule,
    matchedKeywords,
    scoreChange,
    collectionScript,
    contract,
    recommendedActionCategory,
    reasonContext,
    antiCollection
  ) {
    const p = contract.customerProfile;
    const overdueReason =
      reasonContext?.tag
        ? {
            code: reasonContext.tag.code,
            name: reasonContext.tag.name,
            category: reasonContext.tag.category,
          }
        : contract.overdueReason || null;

    return {
      ruleId: rule.id,
      matchedKeywords: [...matchedKeywords],
      reasonMatchedKeywords: reasonContext?.matchedKeywords || [],
      riskScoreDelta: scoreChange.newScore - scoreChange.oldScore,
      finalRiskScore: scoreChange.newScore,
      recommendedActionCategory,
      actionLabel: ActionCategoryPicker.getLabel(recommendedActionCategory),
      collectionScript,
      reasonScripts: reasonContext?.reasonScripts || null,
      overdueReason,
      nextStep: ActionCategoryPicker.getNextStep(recommendedActionCategory),
      customerProfile: {
        genderAge: `${p.gender}, ${p.age}岁`,
        occupation: p.occupation,
        city: p.city,
        incomeLevel: p.incomeLevel,
        maritalStatus: p.maritalStatus,
        contactPreference: p.contactPreference,
        repaymentWillingness: p.repaymentWillingness,
      },
      antiCollection,
    };
  }

  function noContractMessage() {
    return "请先从左侧选择一笔逾期合同，再向 AI 助手发送消息。";
  }

  function applyScoreDelta(contract, rule, dataLayer) {
    const oldScore = contract.riskScore;
    const oldLevel = contract.riskLevel;
    const newScore = clampScore(oldScore + rule.score_delta);
    const newLevel = dataLayer.resolveRiskLevel(newScore);

    dataLayer.updateRisk(contract.contractId, newScore, newLevel, newScore - oldScore);

    const levelText =
      oldLevel === newLevel
        ? dataLayer.getRiskLabel(newLevel)
        : `${dataLayer.getRiskLabel(oldLevel)} → ${dataLayer.getRiskLabel(newLevel)}`;

    return { oldScore, newScore, oldLevel, newLevel, levelText };
  }

  function process(userInput, contract, dataLayer, options = {}) {
    if (!contract) {
      return {
      ok: false,
      message: noContractMessage(),
    };
    }

    const input = (userInput || "").trim();
    const followUp = options.followUp === true;
    const rule = selectRule(input);
    const matchedKeywords = getMatchedKeywords(input, rule);
    let script = fillTemplate(rule.script_template, contract, dataLayer);

    const reasonContext = ReasonTagEngine.matchFromInput(input, contract);
    if (reasonContext?.reasonScripts?.combined) {
      script = reasonContext.reasonScripts.combined;
    }

    const scoreChange = followUp
      ? {
          oldScore: contract.riskScore,
          newScore: contract.riskScore,
          oldLevel: contract.riskLevel,
          newLevel: contract.riskLevel,
          levelText: dataLayer.getRiskLabel(contract.riskLevel),
        }
      : applyScoreDelta(contract, rule, dataLayer);

    const recommendedActionCategory = followUp
      ? contract.recommendedActionCategory
      : ActionCategoryPicker.pick(contract.overdueDays, dataLayer.getRules());

    const antiCollection = AntiCollectionDetector.analyze(input, {
      recentCommunication: contract.recentCommunication,
      history: contract.history,
    });
    const structured = buildAnalysisOutput(
      rule,
      matchedKeywords,
      scoreChange,
      script,
      contract,
      recommendedActionCategory,
      reasonContext,
      antiCollection
    );

    return {
      ok: true,
      structured,
    };
  }

  return {
    init,
    getRules,
    getDefaultRule,
    selectRule,
    process,
    getMatchedKeywords,
    ruleHasKeywordMatch,
  };
})();
