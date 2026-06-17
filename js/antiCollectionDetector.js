/**
 * Anti-Collection Detector — three-level classification.
 * Level 1: legitimate rights protection (NOT anti-collection).
 * Level 2: suspicious avoidance. Level 3: high-risk anti-collection.
 */
const AntiCollectionDetector = (() => {
  const LEVEL_META = {
    0: {
      level: 0,
      label: "No significant signal",
      labelZh: "未检测到明显信号",
      risk: "None",
      riskCss: "anti-col-risk-none",
      isAntiCollectionBehavior: false,
    },
    1: {
      level: 1,
      label: "Legitimate customer rights protection",
      labelZh: "合法维权沟通",
      risk: "Low",
      riskCss: "anti-col-risk-low",
      isAntiCollectionBehavior: false,
    },
    2: {
      level: 2,
      label: "Suspicious avoidance behavior",
      labelZh: "可疑规避行为",
      risk: "Medium",
      riskCss: "anti-col-risk-medium",
      isAntiCollectionBehavior: true,
    },
    3: {
      level: 3,
      label: "High-risk anti-collection behavior",
      labelZh: "高风险反催收",
      risk: "High",
      riskCss: "anti-col-risk-high",
      isAntiCollectionBehavior: true,
    },
  };

  const RECOMMENDED_ACTIONS = {
    0: "未检测到明显信号，按常规催收策略跟进并记录沟通结果。",
    1: "属正常维权沟通，非反催收行为。建议合规回应：可提供授权材料与流程说明，控制联络频次，完整留存录音，必要时转合规岗复核。",
    2: "存在可疑规避迹象。建议主管复核话术、降低联络频次、优先书面通知，记录通道阻断情况，避免激化冲突。",
    3: "检测到高风险反催收信号。建议升级专项队列、立即保全证据链，评估法务介入与资产核查，暂停激进催收动作。",
  };

  const SIGNALS = [
    // Level 1 — legitimate rights (NOT anti-collection)
    { level: 1, id: "complaint", label: "Complaint / regulatory report", labelZh: "投诉举报", weight: 1.0, patterns: [/投诉/, /举报/, /12378/, /监管/, /银保监/, /消费者协会/, /信访/] },
    { level: 1, id: "lawyer_consultation", label: "Lawyer consultation", labelZh: "律师咨询", weight: 1.1, patterns: [/咨询律师/, /请了律师/, /律师函/, /委托律师/, /法律途径/, /找律师/] },
    { level: 1, id: "authorization_documents", label: "Authorization documents request", labelZh: "要求授权文件", weight: 1.0, patterns: [/授权/, /委托书/, /资质证明/, /工号/, /工作证/, /授权文件/, /凭证/, /身份证明/] },
    { level: 1, id: "legal_process", label: "Legal process discussion", labelZh: "法律程序讨论", weight: 1.0, patterns: [/法律程序/, /诉讼流程/, /法院/, /起诉/, /应诉/, /合法渠道/, /司法途径/] },

    // Level 2 — suspicious avoidance
    { level: 2, id: "refusing_communication", label: "Refusing communication", labelZh: "拒绝沟通", weight: 1.3, patterns: [/拒接/, /不接/, /拒绝沟通/, /拒绝接电话/, /不愿沟通/, /拒听/, /客户拒/] },
    { level: 2, id: "blocking_channels", label: "Blocking collection channels", labelZh: "阻断催收通道", weight: 1.4, patterns: [/拉黑/, /屏蔽/, /换号联系/, /停机/, /关机/, /号码失效/, /无法接通/] },
    { level: 2, id: "delay_tactics", label: "Encouraging delay tactics", labelZh: "拖延策略", weight: 1.2, patterns: [/再等等/, /拖一拖/, /先缓一缓/, /宽限/, /拖延/, /暂不处理/, /以后再说/] },
    { level: 2, id: "misleading_credit", label: "Misleading credit bureau statements", labelZh: "误导征信说法", weight: 1.5, patterns: [/征信没问题/, /不上征信/, /不影响信用/, /征信可以洗/, /征信记录会消除/, /征信能改/, /不会上征信/] },

    // Level 3 — high-risk anti-collection
    { level: 3, id: "anti_collection_agency", label: "Anti-collection agency involvement", labelZh: "反催收机构介入", weight: 2.2, patterns: [/反催收/, /代理维权/, /债务优化/, /停息挂账/, /停催服务/, /第三方处理/, /债务顾问/, /征信修复机构/] },
    { level: 3, id: "asset_transfer", label: "Asset transfer attempts", labelZh: "资产转移企图", weight: 2.0, patterns: [/过户/, /转移资产/, /转卖车辆/, /换名/, /资产转移/, /假卖/, /私下交易/, /转移车辆/] },
    { level: 3, id: "fake_hardship", label: "Fake hardship documents", labelZh: "虚假困难材料", weight: 2.1, patterns: [/假证明/, /伪造/, /套证/, /虚假材料/, /假病历/, /假离婚/, /造假/, /PS证明/] },
    { level: 3, id: "debt_evasion", label: "Debt evasion strategies", labelZh: "逃废债策略", weight: 2.0, patterns: [/逃废债/, /躲债/, /跑路/, /失联躲避/, /恶意逃债/, /故意不还/, /蓄意拖欠/] },
    { level: 3, id: "coordinated_tactics", label: "Coordinated anti-collection tactics", labelZh: "协同反催收", weight: 2.3, patterns: [/统一话术/, /群里教/, /教程/, /攻略/, /组团/, /集体维权/, /组织维权/, /反催收群/] },
  ];

  function normalize(text) {
    return String(text || "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function collectTextSources(text, context = {}) {
    const parts = [text, context.recentCommunication];
    if (Array.isArray(context.history)) {
      for (const entry of context.history) {
        if (entry?.result) parts.push(entry.result);
        if (entry?.action) parts.push(entry.action);
      }
    }
    return parts.filter(Boolean).join("\n");
  }

  function matchSignals(combined) {
    const normalized = normalize(combined);
    if (!normalized) return [];

    const matched = [];
    for (const signal of SIGNALS) {
      if (signal.patterns.some((re) => re.test(normalized) || re.test(combined))) {
        matched.push(signal);
      }
    }
    return matched;
  }

  function sumWeights(matches, level) {
    return matches.filter((m) => m.level === level).reduce((sum, m) => sum + m.weight, 0);
  }

  function resolveDominantLevel(matches) {
    if (!matches.length) return 0;

    const w1 = sumWeights(matches, 1);
    const w2 = sumWeights(matches, 2);
    const w3 = sumWeights(matches, 3);

    // Level 3 takes precedence when any high-risk signal is present
    if (w3 > 0) return 3;

    // Level 2 when avoidance signals present (even alongside L1 complaint language)
    if (w2 > 0) return 2;

    // Only level 1 signals → legitimate rights, NOT anti-collection
    if (w1 > 0) return 1;

    return 0;
  }

  function computeConfidence(level, levelMatches, allMatches) {
    if (!level || !levelMatches.length) return 0;

    const weightSum = levelMatches.reduce((sum, m) => sum + m.weight, 0);
    let score = 35 + weightSum * 18 + (levelMatches.length - 1) * 10;

    // Boost when multiple levels aren't diluting (pure L1 = clearer low-risk read)
    if (level === 1 && allMatches.every((m) => m.level === 1)) score += 8;

    // L2/L3 with multiple corroborating signals
    if (level >= 2 && levelMatches.length >= 2) score += 12;

    return Math.max(0, Math.min(98, Math.round(score)));
  }

  function analyze(text, context = {}) {
    const combined = collectTextSources(text, context);
    const allMatches = matchSignals(combined);

    if (!allMatches.length) {
      const meta = LEVEL_META[0];
      return {
        level: 0,
        classification: meta.label,
        classificationZh: meta.labelZh,
        risk: meta.risk,
        riskCss: meta.riskCss,
        isAntiCollectionBehavior: false,
        matchedSignals: [],
        matchedSignalLabels: [],
        confidenceScore: 0,
        recommendedAction: RECOMMENDED_ACTIONS[0],
      };
    }

    const level = resolveDominantLevel(allMatches);
    const levelMatches = allMatches.filter((m) => m.level === level);
    const meta = LEVEL_META[level];
    const confidenceScore = computeConfidence(level, levelMatches, allMatches);

    return {
      level,
      classification: meta.label,
      classificationZh: meta.labelZh,
      risk: meta.risk,
      riskCss: meta.riskCss,
      isAntiCollectionBehavior: meta.isAntiCollectionBehavior,
      matchedSignals: levelMatches.map((m) => m.id),
      matchedSignalLabels: levelMatches.map((m) => m.labelZh),
      allMatchedSignals: allMatches.map((m) => ({
        id: m.id,
        level: m.level,
        label: m.labelZh,
      })),
      confidenceScore,
      recommendedAction: RECOMMENDED_ACTIONS[level],
    };
  }

  function analyzeContract(contract) {
    if (!contract) return analyze("");
    return analyze(contract.recentCommunication, {
      recentCommunication: "",
      history: contract.history,
    });
  }

  return {
    analyze,
    analyzeContract,
    LEVEL_META,
    SIGNALS,
  };
})();
