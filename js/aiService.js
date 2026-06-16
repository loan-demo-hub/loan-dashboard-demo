/**
 * AI Service — first turn: structured analysis card; follow-ups: natural language chat.
 */
const AIService = (() => {
  function buildLocalFollowUpText(ruleResult) {
    const s = ruleResult.structured;
    if (!s) return ruleResult.message || "暂时无法回答，请稍后重试。";

    const script = String(s.collectionScript || "").trim();
    const nextStep = String(s.nextStep || ActionCategoryPicker.getNextStep(s.recommendedActionCategory)).trim();
    const parts = [];

    if (script) parts.push(script);
    if (nextStep && nextStep !== script) parts.push(nextStep);

    if (parts.length) return parts.join("\n\n");

    return ActionCategoryPicker.getNextStep(s.recommendedActionCategory);
  }

  async function processFirstTurn(userText, contract, dataLayer) {
    const ruleResult = RuleEngine.process(userText, contract, dataLayer);

    if (!ruleResult.ok || !ruleResult.structured) {
      return ruleResult;
    }

    if (!LongCatConfig.isConfigured()) {
      return { ...ruleResult, source: "rule_engine", mode: "analysis_card" };
    }

    try {
      const enhanced = await LongCatClient.enhanceAnalysis(
        userText,
        dataLayer.getSelected() || contract,
        ruleResult.structured,
        dataLayer
      );

      return {
        ok: true,
        source: "longcat",
        mode: "analysis_card",
        structured: {
          ...ruleResult.structured,
          collectionScript: enhanced.collectionScript,
          nextStep: enhanced.nextStep,
          reasonScripts: ruleResult.structured.reasonScripts,
          overdueReason: ruleResult.structured.overdueReason,
        },
      };
    } catch (err) {
      const hasBaseline =
        ruleResult.structured.collectionScript && ruleResult.structured.nextStep;
      return {
        ...ruleResult,
        source: "rule_engine",
        mode: "analysis_card",
        apiWarning: hasBaseline
          ? `LongCat 增强未生效（${err.message}），已显示本地规则引擎结果`
          : err.message || "LongCat 调用失败，已使用本地规则引擎",
      };
    }
  }

  async function processFollowUp(userText, contract, dataLayer, chatHistory) {
    const ruleResult = RuleEngine.process(userText, contract, dataLayer);

    if (!ruleResult.ok) {
      return ruleResult;
    }

    if (!LongCatConfig.isConfigured()) {
      return {
        ok: true,
        source: "rule_engine",
        mode: "conversation",
        text: buildLocalFollowUpText(ruleResult),
      };
    }

    try {
      const text = await LongCatClient.chatConversation(
        userText,
        dataLayer.getSelected() || contract,
        dataLayer,
        chatHistory,
        ruleResult.structured
      );

      return {
        ok: true,
        source: "longcat",
        mode: "conversation",
        text,
      };
    } catch (err) {
      return {
        ok: true,
        source: "rule_engine",
        mode: "conversation",
        text: buildLocalFollowUpText(ruleResult),
        apiWarning: `LongCat 对话未生效（${err.message}），已使用本地回复`,
      };
    }
  }

  async function process(userText, contract, dataLayer, options = {}) {
    const { isFirstTurn = true, chatHistory = [] } = options;

    if (!contract) {
      return RuleEngine.process(userText, contract, dataLayer);
    }

    if (isFirstTurn) {
      return processFirstTurn(userText, contract, dataLayer);
    }

    return processFollowUp(userText, contract, dataLayer, chatHistory);
  }

  return { process };
})();
