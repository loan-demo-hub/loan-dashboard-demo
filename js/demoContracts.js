/**
 * Demo showcase contracts — predefined presentation scenarios with full field coverage.
 */
const DemoContracts = (() => {
  const COUNT = 5;

  const SCENARIO_LABELS = {
    job_loss: "失业案例",
    negative_equity: "负资产",
    anti_collection: "反催收",
    fraud_suspicion: "欺诈嫌疑",
    temporary_hardship: "暂时困难",
  };

  function reason(code, name, category, dpdHint, riskIntensity) {
    return { code, name, category, dpdHint, riskIntensity };
  }

  const TEMPLATES = [
    {
      demoScenario: "job_loss",
      contractId: "CR900000001",
      customerName: "王建国",
      vehicleBrand: "丰田",
      vehicleModel: "凯美瑞",
      vehicleYear: 2020,
      loanAmount: 185000,
      outstandingBalance: 148000,
      vehicleMarketValue: 168000,
      overdueDays: 72,
      riskScore: 85,
      riskLevel: "red",
      overdueReason: reason("JOB_UNEMPLOY", "失业", "JOB", "全周期", "高"),
      recentCommunication:
        "4月10日电话回访：客户确认原工厂于2月底裁员，目前靠外卖兼职维持，表达还款意愿但短期无力一次性偿还，希望协商分期并提交失业证明。",
      recommendedActionCategory: "negotiation",
      customerProfile: {
        age: 38,
        gender: "男",
        occupation: "制造业工人",
        city: "武汉",
        incomeLevel: "5-15万",
        maritalStatus: "已婚",
        contactPreference: "电话",
        repaymentWillingness: "中",
        complaintTendency: "低",
      },
      history: [
        {
          date: offsetDate(3),
          action: "电话催收",
          result: "客户说明被裁员，请求分期并承诺补交失业证明",
          operator: "催收员A",
        },
        {
          date: offsetDate(11),
          action: "短信提醒",
          result: "客户回复已知悉，称正在找新工作",
          operator: "系统自动",
        },
        {
          date: offsetDate(28),
          action: "电话催收",
          result: "客户接通，称兼职收入不稳定，希望宽限两期",
          operator: "催收员B",
        },
        {
          date: offsetDate(45),
          action: "短信提醒",
          result: "已发送，无回复",
          operator: "系统自动",
        },
      ],
    },
    {
      demoScenario: "negative_equity",
      contractId: "CR900000002",
      customerName: "李志强",
      vehicleBrand: "宝马",
      vehicleModel: "3系",
      vehicleYear: 2021,
      loanAmount: 328000,
      outstandingBalance: 302000,
      vehicleMarketValue: 248000,
      overdueDays: 108,
      riskScore: 85,
      riskLevel: "red",
      overdueReason: reason("FIN_ASSET_DISPOSAL", "待卖车筹款/待执行财产", "FINANCIAL", "60+", "高"),
      recentCommunication:
        "4月6日外访前电话：客户承认车辆贬值严重，贷款余额高于市场价，担心处置后仍有大额缺口，情绪较为抵触，询问能否待卖车筹款后再结清。",
      recommendedActionCategory: "field_follow_up",
      customerProfile: {
        age: 34,
        gender: "男",
        occupation: "企业职员",
        city: "上海",
        incomeLevel: "15-30万",
        maritalStatus: "已婚",
        contactPreference: "微信",
        repaymentWillingness: "低",
        complaintTendency: "中",
      },
      history: [
        {
          date: offsetDate(2),
          action: "上门拜访",
          result: "客户拒见面，要求书面说明估值依据及处置流程",
          operator: "催收员B",
        },
        {
          date: offsetDate(9),
          action: "电话催收",
          result: "客户称负资产不愿卖车，担心处置后仍欠大额",
          operator: "催收员A",
        },
        {
          date: offsetDate(24),
          action: "短信提醒",
          result: "已发送外访通知，客户未回复",
          operator: "系统自动",
        },
        {
          date: offsetDate(38),
          action: "电话催收",
          result: "无人接听",
          operator: "催收员A",
        },
      ],
    },
    {
      demoScenario: "anti_collection",
      contractId: "CR900000003",
      customerName: "陈志远",
      vehicleBrand: "大众",
      vehicleModel: "帕萨特",
      vehicleYear: 2019,
      loanAmount: 168000,
      outstandingBalance: 112000,
      vehicleMarketValue: 118000,
      overdueDays: 45,
      riskScore: 55,
      riskLevel: "yellow",
      overdueReason: reason("JOB_BUSINESS_HARD", "生意困难", "JOB", "全周期", "中"),
      recentCommunication:
        "4月1日短信回复：客户称门店生意困难回款慢，同时认为催收频率过高，已录音并表示将向12378投诉，要求提供催收员工号与授权文件，并停止非工作时间联系。",
      recommendedActionCategory: "soft_reminder",
      customerProfile: {
        age: 42,
        gender: "男",
        occupation: "个体经营",
        city: "广州",
        incomeLevel: "15-30万",
        maritalStatus: "离异",
        contactPreference: "短信",
        repaymentWillingness: "中",
        complaintTendency: "高",
      },
      history: [
        {
          date: offsetDate(1),
          action: "短信提醒",
          result: "客户回复投诉威胁，要求主管回电并提供工号凭证",
          operator: "系统自动",
        },
        {
          date: offsetDate(6),
          action: "电话催收",
          result: "客户拒接并拉黑号码，称征信不会有问题",
          operator: "催收员A",
        },
        {
          date: offsetDate(14),
          action: "电话催收",
          result: "换号联系，客户称已咨询律师了解法律程序",
          operator: "催收员B",
        },
        {
          date: offsetDate(22),
          action: "短信提醒",
          result: "客户要求书面说明联络频次依据",
          operator: "系统自动",
        },
      ],
    },
    {
      demoScenario: "fraud_suspicion",
      contractId: "CR900000004",
      customerName: "赵海涛",
      vehicleBrand: "比亚迪",
      vehicleModel: "汉",
      vehicleYear: 2022,
      loanAmount: 246000,
      outstandingBalance: 198000,
      vehicleMarketValue: 192000,
      overdueDays: 135,
      riskScore: 85,
      riskLevel: "red",
      overdueReason: reason("OTHER_UNKNOWN", "未知", "OTHER", "全周期", "mid"),
      recentCommunication:
        "4月5日核实：紧急联系人电话失效，GPS近30天高频出现于城南二手车市场，客户本人电话间歇性关机，登记地址无人，邻居称已搬离。",
      recommendedActionCategory: "legal_warning",
      customerProfile: {
        age: 31,
        gender: "男",
        occupation: "自由职业",
        city: "深圳",
        incomeLevel: "5-15万",
        maritalStatus: "未婚",
        contactPreference: "电话",
        repaymentWillingness: "低",
        complaintTendency: "中",
      },
      history: [
        {
          date: offsetDate(4),
          action: "上门拜访",
          result: "登记地址无人，邻居称客户已搬离且车辆少见",
          operator: "催收员B",
        },
        {
          date: offsetDate(12),
          action: "电话催收",
          result: "关机，紧急联系人号码失效",
          operator: "催收员A",
        },
        {
          date: offsetDate(28),
          action: "GPS核查",
          result: "车辆近30天多次出现于城南二手车市场",
          operator: "风控岗",
        },
        {
          date: offsetDate(52),
          action: "电话催收",
          result: "短暂接通后挂断，疑似换号联系",
          operator: "催收员A",
        },
      ],
    },
    {
      demoScenario: "temporary_hardship",
      contractId: "CR900000005",
      customerName: "孙丽娟",
      vehicleBrand: "本田",
      vehicleModel: "CR-V",
      vehicleYear: 2019,
      loanAmount: 158000,
      outstandingBalance: 96000,
      vehicleMarketValue: 132000,
      overdueDays: 22,
      riskScore: 55,
      riskLevel: "yellow",
      overdueReason: reason("HEALTH_HOSPITAL", "住院", "HEALTH", "全周期", "高"),
      recentCommunication:
        "4月8日电话：客户称家人突发住院产生额外支出，预计4月15日工资到账后先还一期，态度配合，已发送住院缴费单截图。",
      recommendedActionCategory: "payment_nudge",
      customerProfile: {
        age: 36,
        gender: "女",
        occupation: "企业职员",
        city: "杭州",
        incomeLevel: "15-30万",
        maritalStatus: "已婚",
        contactPreference: "电话",
        repaymentWillingness: "高",
        complaintTendency: "低",
      },
      history: [
        {
          date: offsetDate(2),
          action: "电话催收",
          result: "客户说明家人住院，承诺工资到账后3日内还款",
          operator: "催收员A",
        },
        {
          date: offsetDate(7),
          action: "短信提醒",
          result: "客户回复已知悉，补充住院情况说明",
          operator: "系统自动",
        },
        {
          date: offsetDate(14),
          action: "电话催收",
          result: "客户配合，确认4月15日发薪日后还款",
          operator: "催收员A",
        },
        {
          date: offsetDate(19),
          action: "短信提醒",
          result: "已发送还款提醒，客户回复收到",
          operator: "系统自动",
        },
      ],
    },
  ];

  function offsetDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }

  function getScenarioLabel(scenario) {
    return SCENARIO_LABELS[scenario] || "演示案例";
  }

  return {
    COUNT,
    TEMPLATES,
    SCENARIO_LABELS,
    getScenarioLabel,
  };
})();
