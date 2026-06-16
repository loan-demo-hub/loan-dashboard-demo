/**
 * Mock analysis — recommendedActionCategory with portfolio-weighted distribution
 * and overdue-day affinity (real-world collections bias, not uniform random).
 * Config: dataset_rules.yaml → recommended_action_category
 */
const ActionCategoryPicker = (() => {
  const LABELS = Object.freeze({
    soft_reminder: "温和提醒",
    payment_nudge: "还款引导",
    negotiation: "协商分期",
    warning_notice: "风险提示",
    escalation: "升级催收",
    legal_warning: "法律提示",
    field_follow_up: "外访/线下跟进",
  });

  const NEXT_STEPS = Object.freeze({
    soft_reminder: "建议发送温和还款提醒",
    payment_nudge: "建议引导客户尽快还款",
    negotiation: "建议启动分期协商流程",
    warning_notice: "建议进行温和风险提醒",
    escalation: "建议升级至专项催收组跟进",
    legal_warning: "建议发送正式法律告知函",
    field_follow_up: "建议安排外访或线下核实",
  });

  const ALLOWED = Object.freeze(Object.keys(LABELS));

  /** CSS modifier suffixes — one per allowed category */
  const BADGE_VARIANTS = Object.freeze({ ...ALLOWED.reduce((acc, k) => ({ ...acc, [k]: k }), {}) });

  const ACTION_BADGE_ICON = `<svg class="action-badge-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 1.5a.75.75 0 0 1 .67.415l1.214 2.458 2.714.394a.75.75 0 0 1 .416 1.279l-1.964 1.914.464 2.703a.75.75 0 0 1-1.088.791L8 9.978l-2.426 1.276a.75.75 0 0 1-1.088-.79l.464-2.704-1.964-1.914a.75.75 0 0 1 .416-1.28l2.714-.393L7.33 1.915A.75.75 0 0 1 8 1.5z"/></svg>`;

  const DEFAULT_CONFIG = {
    allowed: [...ALLOWED],
    global_weights: [
      { id: "soft_reminder", weight: 22 },
      { id: "payment_nudge", weight: 18 },
      { id: "negotiation", weight: 25 },
      { id: "warning_notice", weight: 20 },
      { id: "escalation", weight: 10 },
      { id: "legal_warning", weight: 3 },
      { id: "field_follow_up", weight: 2 },
    ],
    overdue_affinity: [
      {
        max_overdue: 9,
        multipliers: {
          soft_reminder: 3.2,
          payment_nudge: 2.6,
          negotiation: 0.45,
          warning_notice: 0.18,
          escalation: 0.07,
          legal_warning: 0.04,
          field_follow_up: 0.04,
        },
      },
      {
        max_overdue: 30,
        multipliers: {
          soft_reminder: 1.4,
          payment_nudge: 1.9,
          negotiation: 2.4,
          warning_notice: 0.75,
          escalation: 0.28,
          legal_warning: 0.1,
          field_follow_up: 0.08,
        },
      },
      {
        max_overdue: 60,
        multipliers: {
          soft_reminder: 0.55,
          payment_nudge: 0.85,
          negotiation: 1.15,
          warning_notice: 2.1,
          escalation: 1.7,
          legal_warning: 0.45,
          field_follow_up: 0.35,
        },
      },
      {
        max_overdue: 999,
        multipliers: {
          soft_reminder: 0.2,
          payment_nudge: 0.35,
          negotiation: 0.65,
          warning_notice: 1.4,
          escalation: 2.6,
          legal_warning: 2.2,
          field_follow_up: 1.9,
        },
      },
    ],
  };

  function getConfig(datasetRules) {
    const cfg = datasetRules?.recommended_action_category;
    if (!cfg?.global_weights?.length) return DEFAULT_CONFIG;
    return cfg;
  }

  function resolveAffinityTier(overdueDays, tiers) {
    const days = Number(overdueDays) || 0;
    for (const tier of tiers) {
      if (days <= tier.max_overdue) return tier;
    }
    return tiers[tiers.length - 1];
  }

  function buildEffectiveWeights(globalWeights, multipliers, allowedSet) {
    return globalWeights
      .filter((entry) => allowedSet.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        weight: (entry.weight || 0) * (multipliers[entry.id] ?? 1),
      }))
      .filter((entry) => entry.weight > 0);
  }

  function pickWeighted(options, allowedSet) {
    const valid = options.filter((o) => allowedSet.has(o.id) && o.weight > 0);
    if (!valid.length) {
      throw new Error("No valid recommendedActionCategory options with positive weight");
    }

    const total = valid.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * total;

    for (const opt of valid) {
      roll -= opt.weight;
      if (roll <= 0) return opt.id;
    }

    return valid[valid.length - 1].id;
  }

  /**
   * Global portfolio weights × overdue affinity → realistic collections bias.
   * @param {number} overdueDays
   * @param {object} datasetRules — from DataLayer.getRules()
   */
  function pick(overdueDays, datasetRules) {
    const cfg = getConfig(datasetRules);
    const allowedSet = new Set(cfg.allowed || ALLOWED);
    const tier = resolveAffinityTier(overdueDays, cfg.overdue_affinity || DEFAULT_CONFIG.overdue_affinity);
    const effective = buildEffectiveWeights(
      cfg.global_weights || DEFAULT_CONFIG.global_weights,
      tier.multipliers || {},
      allowedSet
    );
    const category = pickWeighted(effective, allowedSet);

    if (!allowedSet.has(category)) {
      throw new Error(`Invalid recommendedActionCategory: ${category}`);
    }

    return category;
  }

  function getLabel(categoryId) {
    return LABELS[categoryId] || categoryId;
  }

  function getNextStep(categoryId) {
    return NEXT_STEPS[categoryId] || getLabel(categoryId);
  }

  function getBadgeVariant(categoryId) {
    return BADGE_VARIANTS[categoryId] ? categoryId : null;
  }

  function renderBadgeHtml(categoryId, escapeHtml) {
    const variant = getBadgeVariant(categoryId);
    if (!variant) return "";

    const label = getLabel(categoryId);
    const safeLabel = escapeHtml ? escapeHtml(label) : label;

    return `<span class="action-badge action-badge--${variant}" title="${safeLabel}">${ACTION_BADGE_ICON}<span class="action-badge-label">${safeLabel}</span></span>`;
  }

  return {
    ALLOWED,
    LABELS,
    NEXT_STEPS,
    BADGE_VARIANTS,
    pick,
    getLabel,
    getNextStep,
    getBadgeVariant,
    renderBadgeHtml,
    getConfig,
  };
})();
