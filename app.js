/**
 * Application bootstrap — wires data layer, rule engine, LongCat AI, and UI.
 */
(async function bootstrap() {
  UI.init(DataLayer, handleUserMessage);

  try {
    await DataLayer.init("mock-data/dataset_rules.yaml");
    await RuleEngine.init("mock-data/collection_rules.yaml");
    await ReasonTagEngine.init("mock-data/overdue_reason_tags.yaml");
    ReasonTagEngine.assignToAll(DataLayer.getAll());
    window.selectedContract = null;
    UI.refresh(DataLayer);
    UI.updateAiModeBadge();
    const mode = YamlLoader.wasFallbackUsed() ? "（离线回退）" : "";
    const aiHint = LongCatConfig.isConfigured() ? " · LongCat 已启用" : "";
    const tagCount = ReasonTagEngine.getTags().length;
    UI.setLoadStatus(
      `规则 ${RuleEngine.getRules().length} 条 · 逾期原因标签 ${tagCount} 条${mode}${aiHint}`
    );
  } catch (err) {
    UI.refresh(DataLayer);
    UI.setLoadStatus(`加载失败：${err.message}`, true);
  }
})();

/** Chat → first turn analysis card; follow-ups natural conversation */
function handleUserMessage(userText) {
  const contract = DataLayer.getSelected();
  const chatHistory = UI.getChatHistory();
  const isFirstTurn = !chatHistory.some((m) => m.role === "assistant");
  const assistantPromise = AIService.process(userText, contract, DataLayer, {
    isFirstTurn,
    chatHistory,
  }).then((result) => {
    window.selectedContract = DataLayer.getSelected();
    return result;
  });
  UI.appendMessages(userText, assistantPromise, DataLayer);
}
