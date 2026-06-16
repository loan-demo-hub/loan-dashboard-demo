/**
 * Contract Generator — mock dataset with random customer profiles.
 *
 * Contract fields:
 *   contractId, customerName, loanAmount, overdueAmount, overdueDays, riskScore, riskLevel,
 *   customerProfile, history
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

  function computeOverdueAmount(loanAmount, overdueDays) {
    const monthlyPayment = Math.max(1, Math.round(loanAmount / 36));
    const overdueMonths = Math.max(1, Math.ceil(overdueDays / 30));
    const penalty = Math.round(loanAmount * 0.0005 * overdueDays);
    const amount = monthlyPayment * overdueMonths + penalty;
    return Math.min(loanAmount, Math.max(monthlyPayment, amount));
  }

  function buildContract(index, rules) {
    const {
      contract_id,
      customer_names,
      loan_amount,
      overdue_days,
      initial_risk_score,
      history,
      customer_traits,
    } = rules;

    const overdueDays =
      ((overdue_days.base + index * overdue_days.step) % overdue_days.modulo) + 1;
    const loanAmount =
      ((loan_amount.base + (index + 1) * loan_amount.step) % loan_amount.modulo) +
      loan_amount.base;
    const overdueAmount = computeOverdueAmount(loanAmount, overdueDays);
    const riskScore = initialRiskScore(overdueDays, initial_risk_score.tiers);
    const riskLevel = deriveRiskLevel(riskScore);
    const contractId = `${contract_id.prefix}${String(contract_id.seed_base + index).padStart(contract_id.digits, "0")}`;

    const contract = {
      contractId,
      customerName: customer_names[index % customer_names.length],
      loanAmount,
      overdueAmount,
      overdueDays,
      riskScore,
      riskLevel,
      customerProfile: generateCustomerProfile(customer_traits),
      history: generateHistory(index, overdueDays, history),
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
    if (count < 20 || count > 30) {
      throw new Error(`contract_count must be 20–30, got ${count}`);
    }
    if (!rules.customer_traits || !rules.complaint_tendency) {
      throw new Error("customer_traits or complaint_tendency missing from dataset_rules.yaml");
    }
    const traits = { ...rules.customer_traits, complaint_tendency: rules.complaint_tendency };
    return Array.from({ length: count }, (_, i) => buildContract(i, { ...rules, customer_traits: traits }));
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
