/**
 * Contract Generator — mock dataset with demo showcase + random profiles.
 */
const ContractGenerator = (() => {
  const SCHEMA_KEYS = [
    "contractId",
    "customerName",
    "loanAmount",
    "overdueAmount",
    "overdueDays",
    "riskScore",
    "riskLevel",
    "vehicleBrand",
    "vehicleModel",
    "vehicleYear",
    "outstandingBalance",
    "vehicleMarketValue",
    "recentCommunication",
    "recommendedActionCategory",
    "isDemo",
    "demoScenario",
    "customerProfile",
    "history",
  ];

  const PROFILE_KEYS = [
    "age",
    "gender",
    "occupation",
    "city",
    "incomeLevel",
    "maritalStatus",
    "contactPreference",
    "repaymentWillingness",
    "complaintTendency",
    "complaintSuggestedAction",
  ];

  const HISTORY_KEYS = ["date", "action", "result", "operator"];

  function clampScore(score) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function deriveRiskLevel(riskScore) {
    if (riskScore <= 40) return "green";
    if (riskScore <= 70) return "yellow";
    return "red";
  }

  function formatDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }

  function initialRiskScore(overdueDays, tiers) {
    for (const tier of tiers) {
      if (overdueDays <= tier.max_overdue) return clampScore(tier.score);
    }
    return clampScore(tiers[tiers.length - 1].score);
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function lookupComplaintAction(tendency, complaintRules) {
    const entry = complaintRules.action_map.find((item) => item.level === tendency);
    if (!entry) {
      throw new Error(`No complaint action defined for level: ${tendency}`);
    }
    return entry.action;
  }

  function generateCustomerProfile(traits) {
    const complaintTendency = pickRandom(traits.complaint_tendency.levels);
    const profile = {
      age: randomInt(traits.age.min, traits.age.max),
      gender: pickRandom(traits.genders),
      occupation: pickRandom(traits.occupations),
      city: pickRandom(traits.cities),
      incomeLevel: pickRandom(traits.income_levels),
      maritalStatus: pickRandom(traits.marital_status),
      contactPreference: pickRandom(traits.contact_preferences),
      repaymentWillingness: pickRandom(traits.repayment_willingness),
      complaintTendency,
      complaintSuggestedAction: lookupComplaintAction(complaintTendency, traits.complaint_tendency),
    };

    const keys = Object.keys(profile);
    if (keys.length !== PROFILE_KEYS.length || !PROFILE_KEYS.every((k) => keys.includes(k))) {
      throw new Error(`Customer profile schema violation: expected ${PROFILE_KEYS.join(", ")}`);
    }
    return profile;
  }

  function generateHistory(index, overdueDays, historyRules) {
    const count =
      historyRules.count_base + (index * historyRules.count_step) % historyRules.count_modulo;
    const entries = [];

    for (let h = 0; h < count; h++) {
      const actionDef = historyRules.actions[(index + h) % historyRules.actions.length];
      const result = actionDef.results[(index + h * 2) % actionDef.results.length];
      entries.push({
        date: formatDate(((index + h) * 3 + 1) % (overdueDays + 5) + 1),
        action: actionDef.action,
        result,
        operator: historyRules.operators[(index + h) % historyRules.operators.length],
      });
    }

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }

  function deriveRecentCommunication(history) {
    if (!history?.length) return "暂无沟通记录";
    const latest = history[0];
    return `${latest.date} ${latest.action}：${latest.result}`;
  }

  function computeOverdueAmount(loanAmount, overdueDays) {
    const monthlyPayment = Math.max(1, Math.round(loanAmount / 36));
    const overdueMonths = Math.max(1, Math.ceil(overdueDays / 30));
    const penalty = Math.round(loanAmount * 0.0005 * overdueDays);
    const amount = monthlyPayment * overdueMonths + penalty;
    return Math.min(loanAmount, Math.max(monthlyPayment, amount));
  }

  function generateCollateral(index, collateralRules, loanAmount) {
    if (!collateralRules?.brands?.length) {
      throw new Error("collateral.brands missing from dataset_rules.yaml");
    }

    const brands = collateralRules.brands;
    const brandEntry = brands[index % brands.length];
    const model =
      brandEntry.models[(index + Math.floor(index / brands.length)) % brandEntry.models.length];
    const yearSpan = collateralRules.year.max - collateralRules.year.min + 1;
    const vehicleYear = collateralRules.year.min + ((index * 2) % yearSpan);

    const targetLtv = 0.72 + ((index * 17) % 58) / 100;
    const outstandingBalance = Math.round(loanAmount * (0.52 + (index % 9) * 0.05));
    const vehicleMarketValue = Math.max(10000, Math.round(outstandingBalance / targetLtv));

    return {
      vehicleBrand: brandEntry.name,
      vehicleModel: model,
      vehicleYear,
      outstandingBalance,
      vehicleMarketValue,
    };
  }

  function computeOverdueDays(index, rules, randomCount) {
    const od = rules.overdue_days;
    const count = randomCount;
    if (od.max != null) {
      const min = od.min ?? 1;
      const max = od.max;
      if (count <= 1) return max;
      return min + Math.round((index * (max - min)) / (count - 1));
    }
    return ((od.base + index * od.step) % od.modulo) + 1;
  }

  function buildDemoContract(template, complaintRules) {
    const profile = {
      ...template.customerProfile,
      complaintSuggestedAction: lookupComplaintAction(
        template.customerProfile.complaintTendency,
        complaintRules
      ),
    };
    const history = [...template.history].sort((a, b) => b.date.localeCompare(a.date));

    const contract = {
      contractId: template.contractId,
      customerName: template.customerName,
      loanAmount: template.loanAmount,
      overdueAmount: computeOverdueAmount(template.loanAmount, template.overdueDays),
      overdueDays: template.overdueDays,
      riskScore: clampScore(template.riskScore),
      riskLevel: template.riskLevel || deriveRiskLevel(template.riskScore),
      vehicleBrand: template.vehicleBrand,
      vehicleModel: template.vehicleModel,
      vehicleYear: template.vehicleYear,
      outstandingBalance: template.outstandingBalance,
      vehicleMarketValue: template.vehicleMarketValue,
      recentCommunication: template.recentCommunication,
      recommendedActionCategory: template.recommendedActionCategory,
      isDemo: true,
      demoScenario: template.demoScenario,
      customerProfile: profile,
      history,
    };

    assertSchema(contract);

    if (template.overdueReason?.code) {
      contract.overdueReason = { ...template.overdueReason };
    }

    return contract;
  }

  function buildContract(index, rules) {
    const {
      contract_id,
      customer_names,
      loan_amount,
      initial_risk_score,
      history,
      customer_traits,
    } = rules;

    const randomCount = rules._randomCount ?? rules.contract_count;
    const randomIndex = index - DemoContracts.COUNT;
    const overdueDays = computeOverdueDays(randomIndex, rules, randomCount);
    const loanAmount =
      ((loan_amount.base + (index + 1) * loan_amount.step) % loan_amount.modulo) +
      loan_amount.base;
    const overdueAmount = computeOverdueAmount(loanAmount, overdueDays);
    const riskScore = initialRiskScore(overdueDays, initial_risk_score.tiers);
    const riskLevel = deriveRiskLevel(riskScore);
    const contractId = `${contract_id.prefix}${String(contract_id.seed_base + index).padStart(contract_id.digits, "0")}`;
    const collateral = generateCollateral(index, rules.collateral, loanAmount);
    const historyEntries = generateHistory(index, overdueDays, history);

    const contract = {
      contractId,
      customerName: customer_names[index % customer_names.length],
      loanAmount,
      overdueAmount,
      overdueDays,
      riskScore,
      riskLevel,
      ...collateral,
      recentCommunication: deriveRecentCommunication(historyEntries),
      recommendedActionCategory: ActionCategoryPicker.pick(overdueDays, rules),
      isDemo: false,
      demoScenario: "",
      customerProfile: generateCustomerProfile(customer_traits),
      history: historyEntries,
    };

    assertSchema(contract);
    return contract;
  }

  function assertSchema(contract) {
    const keys = Object.keys(contract);
    if (keys.length !== SCHEMA_KEYS.length || !SCHEMA_KEYS.every((k) => keys.includes(k))) {
      throw new Error(`Contract schema violation: expected ${SCHEMA_KEYS.join(", ")}`);
    }
    const pKeys = Object.keys(contract.customerProfile);
    if (pKeys.length !== PROFILE_KEYS.length || !PROFILE_KEYS.every((k) => pKeys.includes(k))) {
      throw new Error(`Customer profile schema violation: expected ${PROFILE_KEYS.join(", ")}`);
    }
    for (const entry of contract.history) {
      const hKeys = Object.keys(entry);
      if (hKeys.length !== HISTORY_KEYS.length || !HISTORY_KEYS.every((k) => hKeys.includes(k))) {
        throw new Error(`History entry schema violation: expected ${HISTORY_KEYS.join(", ")}`);
      }
    }
  }

  function generate(rules) {
    const count = rules.contract_count;
    if (count < 20 || count > 50) {
      throw new Error(`contract_count must be 20–50, got ${count}`);
    }
    if (!rules.customer_traits || !rules.complaint_tendency) {
      throw new Error("customer_traits or complaint_tendency missing from dataset_rules.yaml");
    }

    const demoCount = DemoContracts.COUNT;
    const randomCount = count - demoCount;
    if (randomCount < 1) {
      throw new Error(`contract_count must exceed demo count (${demoCount})`);
    }

    const traits = { ...rules.customer_traits, complaint_tendency: rules.complaint_tendency };
    const enrichedRules = { ...rules, customer_traits: traits, _randomCount: randomCount };

    const demos = DemoContracts.TEMPLATES.map((template) =>
      buildDemoContract(template, rules.complaint_tendency)
    );
    const random = Array.from({ length: randomCount }, (_, i) =>
      buildContract(i + demoCount, enrichedRules)
    );

    return [...demos, ...random];
  }

  function formatProfileSummary(profile) {
    return [
      `${profile.gender} · ${profile.age}岁`,
      profile.occupation,
      profile.city,
      `收入${profile.incomeLevel}`,
      `还款意愿${profile.repaymentWillingness}`,
      `投诉倾向${profile.complaintTendency}`,
    ].join(" · ");
  }

  return {
    generate,
    deriveRiskLevel,
    clampScore,
    computeOverdueAmount,
    formatProfileSummary,
    SCHEMA_KEYS,
    PROFILE_KEYS,
  };
})();
