/** Pre-parsed mock data — used when fetch / YAML parse fails (e.g. file://) */
window.__MOCK_DATA_BUNDLE__ = {
  "mock-data/dataset_rules.yaml": {
    version: "1.0",
    contract_count: 25,
    contract_id: { prefix: "CR", digits: 9, seed_base: 100000001 },
    customer_names: [
      "张伟", "李娜", "王强", "陈静", "刘洋", "赵敏", "孙磊", "周婷", "吴刚", "郑丽",
      "黄浩", "林雪", "徐鹏", "马超", "胡芳", "郭亮", "何静", "高峰", "罗敏", "梁宇",
      "宋佳", "唐勇", "韩梅", "冯涛", "曹阳",
    ],
    loan_amount: { base: 20000, step: 37000, modulo: 480000 },
    overdue_days: { base: 3, step: 7, modulo: 90 },
    initial_risk_score: {
      tiers: [
        { max_overdue: 9, score: 25 },
        { max_overdue: 29, score: 55 },
        { max_overdue: 999, score: 85 },
      ],
    },
    risk_thresholds: { green_max: 40, yellow_max: 70 },
    history: {
      count_base: 2,
      count_step: 1,
      count_modulo: 4,
      actions: [
        { action: "电话催收", results: ["无人接听", "承诺3日内还款", "客户拒接"] },
        { action: "短信提醒", results: ["已发送", "客户回复将还款"] },
        { action: "上门拜访", results: ["未找到本人", "签署还款承诺书"] },
      ],
      operators: ["催收员A", "催收员B", "系统自动"],
    },
    risk_labels: { green: "低风险", yellow: "中风险", red: "高风险" },
    customer_traits: {
      genders: ["男", "女"],
      occupations: ["企业职员", "个体经营", "自由职业", "公务员", "制造业工人", "服务业从业", "小微企业主"],
      cities: ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安"],
      income_levels: ["5万以下", "5-15万", "15-30万", "30万以上"],
      marital_status: ["已婚", "未婚", "离异"],
      contact_preferences: ["电话", "短信", "微信", "邮件"],
      repayment_willingness: ["高", "中", "低"],
      age: { min: 26, max: 58 },
    },
    complaint_tendency: {
      levels: ["低", "中", "高"],
      action_map: [
        { level: "低", action: "按常规催收节奏跟进，语气温和专业，完整留存通话录音即可。" },
        { level: "中", action: "联系前复核话术合规性，避免高频打扰；优先短信与单次电话，预留客服升级通道。" },
        { level: "高", action: "升级至投诉敏感队列，须主管审核后再联系；禁用威胁性措辞，准备监管报备材料。" },
      ],
    },
    recommended_action_category: {
      allowed: [
        "soft_reminder",
        "payment_nudge",
        "negotiation",
        "warning_notice",
        "escalation",
        "legal_warning",
        "field_follow_up",
      ],
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
    },
  },

  "mock-data/collection_rules.yaml": {
    version: "1.0",
    default_rule_id: "general_inquiry",
    risk_thresholds: { green_max: 40, yellow_max: 70 },
    rules: [
      {
        id: "polite_reminder",
        intent: "友好提醒",
        action_category: "温和提醒",
        keywords: ["提醒", "短信", "通知"],
        score_delta: -5,
        recommended_action: "发送友好还款提醒短信或电话，确认客户是否知悉账单及还款渠道。",
        script_template:
          "您好，{customerName}先生/女士，我是 XX 银行贷后服务专员。\n" +
          "温馨提醒：合同 {contractId} 已逾期 {overdueDays} 天，当前欠款 {loanAmount}，风险评分 {riskScore} 分。\n" +
          "请问是否方便今日内安排还款？如有困难，可协助了解延期或分期选项。",
      },
      {
        id: "payment_plan",
        intent: "协商分期",
        action_category: "协商谈判",
        keywords: ["分期", "协商", "方案", "减免"],
        score_delta: -8,
        recommended_action: "评估客户还款能力，提供 2–3 期分期方案，首期不低于欠款 30%，并签署书面承诺。",
        script_template:
          "{customerName}先生/女士，关于合同 {contractId}，欠款 {loanAmount}，逾期 {overdueDays} 天。\n" +
          "我行为您申请分期还款方案，首期需不低于欠款的 30%。\n" +
          "请问您希望分几期？预计何时可以支付首期？",
      },
      {
        id: "risk_warning",
        intent: "风险警示",
        action_category: "升级催收",
        keywords: ["风险", "征信", "逾期", "等级"],
        score_delta: 10,
        recommended_action: "正式告知征信影响及罚息后果，要求客户在 3 个工作日内给出明确还款计划。",
        script_template:
          "{customerName}先生/女士，合同 {contractId} 已逾期 {overdueDays} 天，欠款 {loanAmount}。\n" +
          "当前风险评分 {riskScore} 分，等级为 {riskLevel}。\n" +
          "继续逾期将影响个人征信并产生额外费用，请本周内至少偿还部分款项。",
      },
      {
        id: "legal_threat",
        intent: "法律威胁应对",
        action_category: "法律警告",
        keywords: ["要起诉", "起诉我", "告你们"],
        score_delta: -30,
        recommended_action:
          "客户表达诉讼意向时，切换合规安抚话术，记录诉求并转交法务复核，避免激化冲突。",
        script_template:
          "{customerName}先生/女士，理解您的关切。关于合同 {contractId}（逾期 {overdueDays} 天，欠款 {loanAmount}），\n" +
          "我们重视您的反馈，可先为您说明当前账单明细与可选还款/协商方案。\n" +
          "如需正式投诉或法律咨询，我将为您登记并安排专人回电，请问您方便的时间？",
      },
      {
        id: "escalation",
        intent: "升级催收",
        action_category: "法律警告",
        keywords: ["升级", "法务", "起诉", "严重", "专项"],
        score_delta: 15,
        recommended_action: "升级至专项催收组，发送正式催款通知书，评估法律途径并整理证据链。",
        script_template:
          "{customerName}先生/女士，我是 XX 银行专项催收组。\n" +
          "合同 {contractId} 逾期 {overdueDays} 天，欠款 {loanAmount}，风险评分 {riskScore} 分。\n" +
          "请于 3 个工作日内结清或签订书面还款协议，否则将依法采取进一步措施。",
      },
      {
        id: "contact_customer",
        intent: "联系客户",
        action_category: "温和提醒",
        keywords: ["联系", "电话", "沟通", "上门"],
        score_delta: 0,
        recommended_action: "通过已登记渠道联系客户，确认还款意愿，全程录音并记录跟进结果。",
        script_template:
          "您好，{customerName}先生/女士，这里是 XX 银行贷后中心。\n" +
          "就合同 {contractId}（逾期 {overdueDays} 天，欠款 {loanAmount}）与您确认还款安排。\n" +
          "请问您目前是否有明确的还款计划？",
      },
      {
        id: "general_inquiry",
        intent: "综合咨询",
        action_category: "温和提醒",
        keywords: [],
        score_delta: 0,
        recommended_action: "结合合同当前风险评分与逾期天数，选择适当的催收强度并记录本次沟通。",
        script_template:
          "{customerName}先生/女士，关于合同 {contractId}：\n" +
          "逾期 {overdueDays} 天，欠款 {loanAmount}，风险评分 {riskScore} 分（{riskLevel}）。\n" +
          "请问您需要了解还款方式、分期方案，还是其他协助？",
      },
    ],
  },
};
