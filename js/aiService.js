/**
 * AI Service — first turn: structured analysis card; follow-ups: natural language chat.
 */
const AIService = (() => {
  function buildLocalFollowUpText(ruleResult, userText) {
    const s = ruleResult.structured;
    if (!s) return ruleResult.message || "暂时无法回答，请稍后重试。";

    const question = String(userText || "").trim();
    const parts = [];

    if (s.reasonMatchedKeywords?.length && s.overdueReason?.name) {
      parts.push(
        `结合您提到的「${s.reasonMatchedKeywords.join("、")}」，当前识别逾期原因为「${s.overdueReason.name}」。`
      );
    } else if (s.matchedKeywords?.length) {
      parts.push(`本轮命中关键词：${s.matchedKeywords.join("、")}。`);
    }

    if (s.antiCollection?.level >= 2) {
      parts.push(
        `注意反催收信号（L${s.antiCollection.level}），建议：${s.antiCollection.recommendedAction}`
      );
    }

    const nextStep = String(
      s.nextStep || ActionCategoryPicker.getNextStep(s.recommendedActionCategory)
    ).trim();

    if (question && nextStep) {
      parts.push(`针对「${question}」：${nextStep}`);
    } else if (nextStep) {
      parts.push(nextStep);
    }

    if (parts.length) return parts.join("\n\n");

    return "请结合右侧 Intelligence 面板的合同与抵押物信息，针对具体问题选择合规跟进方式。";
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
          antiCollection: ruleResult.structured.antiCollection,
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
    const ruleResult = RuleEngine.process(userText, contract, dataLayer, { followUp: true });

    if (!ruleResult.ok) {
      return ruleResult;
    }

    if (!LongCatConfig.isConfigured()) {
      return {
        ok: true,
        source: "rule_engine",
        mode: "conversation",
        text: buildLocalFollowUpText(ruleResult, userText),
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
        text: buildLocalFollowUpText(ruleResult, userText),
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
