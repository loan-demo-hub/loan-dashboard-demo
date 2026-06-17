/**
 * Collateral Analyzer — LTV, collateral risk, and asset strategy recommendations.
 */
const CollateralAnalyzer = (() => {
  const STRATEGIES = {
    continue_collection: {
      label: "Continue collection",
      labelZh: "继续催收",
    },
    negotiate_repayment: {
      label: "Negotiate repayment",
      labelZh: "协商还款",
    },
    monitor_collateral: {
      label: "Monitor collateral",
      labelZh: "监控抵押物",
    },
    asset_preservation_review: {
      label: "Asset preservation review",
      labelZh: "资产保全审查",
    },
    repossession_candidate: {
      label: "Repossession candidate",
      labelZh: "收车候选",
    },
  };

  function calculateLtv(outstandingBalance, vehicleMarketValue) {
    const balance = Number(outstandingBalance) || 0;
    const marketValue = Number(vehicleMarketValue) || 0;
    if (marketValue <= 0) return null;
    return balance / marketValue;
  }

  function formatLtvPercent(ltv) {
    if (ltv == null || !Number.isFinite(ltv)) return "—";
    return `${(ltv * 100).toFixed(1)}%`;
  }

  function deriveCollateralRisk(ltv) {
    if (ltv == null || !Number.isFinite(ltv)) {
      return { level: "unknown", label: "Unknown", cssClass: "collateral-risk-unknown" };
    }
    if (ltv < 0.9) {
      return { level: "low", label: "Low Risk", cssClass: "collateral-risk-low" };
    }
    if (ltv < 1.1) {
      return { level: "medium", label: "Medium Risk", cssClass: "collateral-risk-medium" };
    }
    return { level: "high", label: "High Risk", cssClass: "collateral-risk-high" };
  }

  function overdueTier(overdueDays) {
    const days = Number(overdueDays) || 0;
    if (days <= 15) return "early";
    if (days <= 45) return "medium";
    if (days <= 75) return "late";
    return "severe";
  }

  function ltvTier(ltv) {
    if (ltv == null) return "medium";
    if (ltv < 0.9) return "low";
    if (ltv < 1.1) return "medium";
    return "high";
  }

  function pickStrategy(overdueDays, ltv) {
    const o = overdueTier(overdueDays);
    const l = ltvTier(ltv);

    const matrix = {
      early: {
        low: "continue_collection",
        medium: "monitor_collateral",
        high: "monitor_collateral",
      },
      medium: {
        low: "negotiate_repayment",
        medium: "negotiate_repayment",
        high: "asset_preservation_review",
      },
      late: {
        low: "negotiate_repayment",
        medium: "asset_preservation_review",
        high: "repossession_candidate",
      },
      severe: {
        low: "asset_preservation_review",
        medium: "repossession_candidate",
        high: "repossession_candidate",
      },
    };

    return matrix[o][l];
  }

  function buildStrategyReason(strategyKey, overdueDays, ltv, collateralRisk) {
    const ltvText = formatLtvPercent(ltv);
    const riskLabel = collateralRisk.label;
    const days = Number(overdueDays) || 0;

    const reasons = {
      continue_collection: `逾期 ${days} 天，仍处于早期阶段；LTV ${ltvText}（${riskLabel}），抵押物覆盖率充足，优先维持常规催收节奏并跟踪还款意愿。`,
      negotiate_repayment: `逾期 ${days} 天，LTV ${ltvText}（${riskLabel}），车辆仍有一定价值缓冲，建议主动协商分期或部分还款方案，降低进一步恶化风险。`,
      monitor_collateral: `逾期 ${days} 天，LTV ${ltvText}（${riskLabel}），贷款余额接近或超过车辆估值，需加强抵押物状态监控并核实车辆位置与保管情况。`,
      asset_preservation_review: `逾期 ${days} 天，LTV ${ltvText}（${riskLabel}），回收价值与敞口匹配度下降，建议启动资产保全审查，评估法律程序与处置成本。`,
      repossession_candidate: `逾期 ${days} 天，LTV ${ltvText}（${riskLabel}），长期逾期且抵押覆盖率不足，车辆处置收益可能无法完全覆盖余额，建议纳入收车候选并同步评估司法/处置路径。`,
    };

    return reasons[strategyKey] || `逾期 ${days} 天，LTV ${ltvText}，请结合抵押物状态制定处置方案。`;
  }

  function analyze(contract) {
    if (!contract) return null;

    const ltv = calculateLtv(contract.outstandingBalance, contract.vehicleMarketValue);
    const collateralRisk = deriveCollateralRisk(ltv);
    const strategyKey = pickStrategy(contract.overdueDays, ltv);
    const strategy = STRATEGIES[strategyKey];

    return {
      ltv,
      ltvPercent: formatLtvPercent(ltv),
      collateralRisk,
      strategyKey,
      strategyLabel: strategy.label,
      strategyLabelZh: strategy.labelZh,
      strategyReason: buildStrategyReason(strategyKey, contract.overdueDays, ltv, collateralRisk),
      vehicleInfo: `${contract.vehicleBrand} ${contract.vehicleModel} (${contract.vehicleYear})`,
    };
  }

  return {
    analyze,
    calculateLtv,
    formatLtvPercent,
    deriveCollateralRisk,
    STRATEGIES,
  };
})();
