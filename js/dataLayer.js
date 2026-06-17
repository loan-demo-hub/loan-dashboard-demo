/**
 * Data Layer — contract storage & selection state.
 */
const DataLayer = (() => {
  let datasetRules = null;
  let contracts = [];
  let selectedContractId = null;

  async function init(datasetUrl) {
    datasetRules = await YamlLoader.loadWithFallback(datasetUrl);
    contracts = ContractGenerator.generate(datasetRules);
    selectedContractId = null;
    return contracts;
  }

  function getRules() {
    return datasetRules;
  }

  function getAll() {
    return contracts;
  }

  function getById(contractId) {
    return contracts.find((c) => c.contractId === contractId) || null;
  }

  function getSelected() {
    return selectedContractId ? getById(selectedContractId) : null;
  }

  function select(contractId) {
    if (!getById(contractId)) return false;
    selectedContractId = contractId;
    return true;
  }

  function updateRisk(contractId, riskScore, riskLevel, scoreDelta) {
    const c = getById(contractId);
    if (!c) return null;
    c.riskScore = ContractGenerator.clampScore(riskScore);
    c.riskLevel = riskLevel;
    if (typeof scoreDelta === "number") {
      c.lastRiskScoreDelta = scoreDelta;
    }
    return c;
  }

  function getRiskLabel(level) {
    return datasetRules?.risk_labels?.[level] || level;
  }

  function formatAmount(n) {
    return "¥" + n.toLocaleString("zh-CN");
  }

  function getOverdueAmount(contract) {
    if (!contract) return 0;
    if (contract.overdueAmount != null) return contract.overdueAmount;
    return ContractGenerator.computeOverdueAmount(contract.loanAmount, contract.overdueDays);
  }

  function resolveRiskLevel(score) {
    return ContractGenerator.deriveRiskLevel(ContractGenerator.clampScore(score));
  }

  return {
    init,
    getRules,
    getAll,
    getById,
    getSelected,
    select,
    updateRisk,
    getRiskLabel,
    formatAmount,
    getOverdueAmount,
    resolveRiskLevel,
  };
})();
