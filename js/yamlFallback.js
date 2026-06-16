/** Offline fallback — same content as mock-data/*.yaml for file:// or no-server use */
window.__YAML_FALLBACK__ = {
  "mock-data/dataset_rules.yaml": `version: "1.0"
contract_count: 25

contract_id:
  prefix: CR
  digits: 9
  seed_base: 100000001

customer_names:
  - 张伟
  - 李娜
  - 王强
  - 陈静
  - 刘洋
  - 赵敏
  - 孙磊
  - 周婷
  - 吴刚
  - 郑丽
  - 黄浩
  - 林雪
  - 徐鹏
  - 马超
  - 胡芳
  - 郭亮
  - 何静
  - 高峰
  - 罗敏
  - 梁宇
  - 宋佳
  - 唐勇
  - 韩梅
  - 冯涛
  - 曹阳

loan_amount:
  base: 20000
  step: 37000
  modulo: 480000

overdue_days:
  base: 3
  step: 7
  modulo: 90

initial_risk_score:
  tiers:
    - max_overdue: 9
      score: 25
    - max_overdue: 29
      score: 55
    - max_overdue: 999
      score: 85

risk_thresholds:
  green_max: 40
  yellow_max: 70

history:
  count_base: 2
  count_step: 1
  count_modulo: 4
  actions:
    - action: 电话催收
      results:
        - 无人接听
        - 承诺3日内还款
        - 客户拒接
    - action: 短信提醒
      results:
        - 已发送
        - 客户回复将还款
    - action: 上门拜访
      results:
        - 未找到本人
        - 签署还款承诺书
  operators:
    - 催收员A
    - 催收员B
    - 系统自动

risk_labels:
  green: 低风险
  yellow: 中风险
  red: 高风险

customer_traits:
  genders:
    - 男
    - 女
  occupations:
    - 企业职员
    - 个体经营
    - 自由职业
    - 公务员
    - 制造业工人
    - 服务业从业
    - 小微企业主
  cities:
    - 北京
    - 上海
    - 广州
    - 深圳
    - 杭州
    - 成都
    - 武汉
    - 西安
  income_levels:
    - 5万以下
    - 5-15万
    - 15-30万
    - 30万以上
  marital_status:
    - 已婚
    - 未婚
    - 离异
  contact_preferences:
    - 电话
    - 短信
    - 微信
    - 邮件
  repayment_willingness:
    - 高
    - 中
    - 低
  age:
    min: 26
    max: 58

complaint_tendency:
  levels:
    - 低
    - 中
    - 高
  action_map:
    - level: 低
      action: 按常规催收节奏跟进，语气温和专业，完整留存通话录音即可。
    - level: 中
      action: 联系前复核话术合规性，避免高频打扰；优先短信与单次电话，预留客服升级通道。
    - level: 高
      action: 升级至投诉敏感队列，须主管审核后再联系；禁用威胁性措辞，准备监管报备材料。

recommended_action_category:
  allowed:
    - soft_reminder
    - payment_nudge
    - negotiation
    - warning_notice
    - escalation
    - legal_warning
    - field_follow_up
  global_weights:
    - id: soft_reminder
      weight: 22
    - id: payment_nudge
      weight: 18
    - id: negotiation
      weight: 25
    - id: warning_notice
      weight: 20
    - id: escalation
      weight: 10
    - id: legal_warning
      weight: 3
    - id: field_follow_up
      weight: 2
  overdue_affinity:
    - max_overdue: 9
      multipliers:
        soft_reminder: 3.2
        payment_nudge: 2.6
        negotiation: 0.45
        warning_notice: 0.18
        escalation: 0.07
        legal_warning: 0.04
        field_follow_up: 0.04
    - max_overdue: 30
      multipliers:
        soft_reminder: 1.4
        payment_nudge: 1.9
        negotiation: 2.4
        warning_notice: 0.75
        escalation: 0.28
        legal_warning: 0.1
        field_follow_up: 0.08
    - max_overdue: 60
      multipliers:
        soft_reminder: 0.55
        payment_nudge: 0.85
        negotiation: 1.15
        warning_notice: 2.1
        escalation: 1.7
        legal_warning: 0.45
        field_follow_up: 0.35
    - max_overdue: 999
      multipliers:
        soft_reminder: 0.2
        payment_nudge: 0.35
        negotiation: 0.65
        warning_notice: 1.4
        escalation: 2.6
        legal_warning: 2.2
        field_follow_up: 1.9`,

  "mock-data/collection_rules.yaml": `version: "1.0"
default_rule_id: general_inquiry

risk_thresholds:
  green_max: 40
  yellow_max: 70

rules:
  - id: polite_reminder
    intent: 友好提醒
    action_category: 温和提醒
    keywords:
      - 提醒
      - 短信
      - 通知
    score_delta: -5
    recommended_action: 发送友好还款提醒短信或电话，确认客户是否知悉账单及还款渠道。
    script_template: |
      您好，{customerName}先生/女士，我是 XX 银行贷后服务专员。
      温馨提醒：合同 {contractId} 已逾期 {overdueDays} 天，当前欠款 {loanAmount}，风险评分 {riskScore} 分。
      请问是否方便今日内安排还款？如有困难，可协助了解延期或分期选项。

  - id: payment_plan
    intent: 协商分期
    action_category: 协商谈判
    keywords:
      - 分期
      - 协商
      - 方案
      - 减免
    score_delta: -8
    recommended_action: 评估客户还款能力，提供 2–3 期分期方案，首期不低于欠款 30%，并签署书面承诺。
    script_template: |
      {customerName}先生/女士，关于合同 {contractId}，欠款 {loanAmount}，逾期 {overdueDays} 天。
      我行为您申请分期还款方案，首期需不低于欠款的 30%。
      请问您希望分几期？预计何时可以支付首期？

  - id: risk_warning
    intent: 风险警示
    action_category: 升级催收
    keywords:
      - 风险
      - 征信
      - 逾期
      - 等级
    score_delta: 10
    recommended_action: 正式告知征信影响及罚息后果，要求客户在 3 个工作日内给出明确还款计划。
    script_template: |
      {customerName}先生/女士，合同 {contractId} 已逾期 {overdueDays} 天，欠款 {loanAmount}。
      当前风险评分 {riskScore} 分，等级为 {riskLevel}。
      继续逾期将影响个人征信并产生额外费用，请本周内至少偿还部分款项。

  - id: legal_threat
    intent: 法律威胁应对
    action_category: 法律警告
    keywords:
      - 要起诉
      - 起诉我
      - 告你们
    score_delta: -30
    recommended_action: 客户表达诉讼意向时，切换合规安抚话术，记录诉求并转交法务复核，避免激化冲突。
    script_template: |
      {customerName}先生/女士，理解您的关切。关于合同 {contractId}（逾期 {overdueDays} 天，欠款 {loanAmount}），
      我们重视您的反馈，可先为您说明当前账单明细与可选还款/协商方案。
      如需正式投诉或法律咨询，我将为您登记并安排专人回电，请问您方便的时间？

  - id: escalation
    intent: 升级催收
    action_category: 法律警告
    keywords:
      - 升级
      - 法务
      - 起诉
      - 严重
      - 专项
    score_delta: 15
    recommended_action: 升级至专项催收组，发送正式催款通知书，评估法律途径并整理证据链。
    script_template: |
      {customerName}先生/女士，我是 XX 银行专项催收组。
      合同 {contractId} 逾期 {overdueDays} 天，欠款 {loanAmount}，风险评分 {riskScore} 分。
      请于 3 个工作日内结清或签订书面还款协议，否则将依法采取进一步措施。

  - id: contact_customer
    intent: 联系客户
    action_category: 温和提醒
    keywords:
      - 联系
      - 电话
      - 沟通
      - 上门
    score_delta: 0
    recommended_action: 通过已登记渠道联系客户，确认还款意愿，全程录音并记录跟进结果。
    script_template: |
      您好，{customerName}先生/女士，这里是 XX 银行贷后中心。
      就合同 {contractId}（逾期 {overdueDays} 天，欠款 {loanAmount}）与您确认还款安排。
      请问您目前是否有明确的还款计划？

  - id: general_inquiry
    intent: 综合咨询
    action_category: 温和提醒
    keywords: []
    score_delta: 0
    recommended_action: 结合合同当前风险评分与逾期天数，选择适当的催收强度并记录本次沟通。
    script_template: |
      {customerName}先生/女士，关于合同 {contractId}：
      逾期 {overdueDays} 天，欠款 {loanAmount}，风险评分 {riskScore} 分（{riskLevel}）。
      请问您需要了解还款方式、分期方案，还是其他协助？`,

  "mock-data/overdue_reason_tags.yaml": `version: "1.1"
source: yuqi_reason_tags_merged_v1_1_with_flag.md
tags:
  - category: FINANCIAL
    code: FIN_INCOME_UNSTABLE
    name: 无稳定收入
    keywords:
      - 无稳定收入
      - 自由职业
      - 临时工
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "我看到您最近收入有些不稳定，是吗？方便简单说一下现在的大致情况吗？"
    script_empathy: "收入不固定的时候，每个月都要平衡很多支出，会挺辛苦的，我理解。"
    script_solution: "我们可以先按您当前能承受的金额做一个小额还款安排，后续再根据收入恢复情况逐步调整。"
    realtime_priority: true
  - category: FINANCIAL
    code: FIN_INCOME_DROP
    name: 收入下降
    keywords:
      - 收入下降
      - 月收入降低
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "最近这段时间您的收入是有明显下降吗？方便说一下大概从多少降到多少？"
    script_empathy: "收入下降会直接影响家庭开支和还款安排，这种压力我非常理解。"
    script_solution: "我们可以根据您现在的实际收入水平，重新测算一个您可以接受的月还金额。"
    realtime_priority: true
  - category: FINANCIAL
    code: FIN_INCOME_DELAY
    name: 等工资/工资拖欠/工程款拖欠
    keywords:
      - 等工资
      - 工资拖欠
      - 工程款拖欠
    dpd_hint: 30+
    loan_purpose: 商用更高、自用适用
    risk_intensity: 高
    script_open: "您这边提到现在在等公司发工资或工程款，是预计哪一天能到账呢？"
    script_empathy: "工资或工程款一延后，确实会打乱原来的安排，这种情况我能理解。"
    script_solution: "我们可以先约定一个到账后的具体还款日，同时看是否能先还一部分，减轻后面一次性压力。"
    realtime_priority: true
  - category: FINANCIAL
    code: FIN_CASH_INSUFFICIENT
    name: 资金不足
    keywords:
      - 现在没有钱
      - 手上没钱
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您刚才说现在手上比较紧，是支出突然多了，还是收入这边减少了？"
    script_empathy: "资金一紧张，很多账单都会排队，您愿意接电话说明还是很重视这笔款项的。"
    script_solution: "为了避免逾期继续升级，我们可以先定一个您当前能承受的最低还款金额，剩余部分再按节奏安排。"
    realtime_priority: true
  - category: FINANCIAL
    code: FIN_DEPOSIT_INSUFFICIENT
    name: 存款不足
    keywords:
      - 存款不够
      - 没有积蓄
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您提到这边存款也不多，目前有没有可以动用的存量资金？"
    script_empathy: "现在很多家庭都是月光状态，有突发支出时确实很难一下子拿出存款。"
    script_solution: "我们可以不要求一次性大额偿还，而是先用较小金额维护账户，避免风险进一步放大。"
    realtime_priority: true
  - category: FINANCIAL
    code: FIN_BORROWING
    name: 正在借钱
    keywords:
      - 正在借钱
      - 想办法筹钱
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您现在正在想办法筹钱，是打算向亲友借还是通过其他方式周转？"
    script_empathy: "您在积极想办法处理这笔欠款，这一点本身就说明您有还款意愿。"
    script_solution: "在您筹钱的同时，我们可以先约定一个时间节点，并看能否先部分还款，减少后续压力。"
    realtime_priority: true
  - category: FINANCIAL
    code: FIN_ASSET_DISPOSAL
    name: 待卖车筹款/待执行财产
    keywords:
      - 待卖车筹款
      - 待执行财产
    dpd_hint: 60+
    loan_purpose: 商用较多
    risk_intensity: 高
    script_open: "您提到打算通过卖车或处理资产来还款，现在大概进行到哪一步了？"
    script_empathy: "处理资产本身就很麻烦，再叠加还款时间压力，心理负担会更重。"
    script_solution: "在资产真正成交前，可以先按较低金额维持账户状态，避免逾期级别继续上升。"
    realtime_priority: true
  - category: FINANCIAL
    code: FIN_BANKRUPTCY
    name: 破产
    keywords:
      - 破产
      - 倒闭
    dpd_hint: 180+
    loan_purpose: 商用为主
    risk_intensity: 高
    script_open: "您刚才提到经营或财务已经到了接近破产的程度，方便概括一下目前整体情况吗？"
    script_empathy: "发展到破产这一步，说明之前已经承受了很长时间的压力，这点我能体会。"
    script_solution: "我们先把您目前能接受的最低处理方案讨论清楚，避免再出现额外的法律和费用风险。"
    realtime_priority: true
  - category: JOB
    code: JOB_UNEMPLOY
    name: 失业
    keywords:
      - 失业
      - 被裁员
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 高
    script_open: "看到您这边提到最近失业了，方便说一下预计多久能有新的工作机会吗？"
    script_empathy: "失业本身压力就很大，再叠加还款压力，确实不容易。"
    script_solution: "在重新找到工作之前，我们可以先把还款金额调整到您能够接受的最低水平，只要您愿意保持沟通，我们会尽量配合。"
    realtime_priority: true
  - category: JOB
    code: JOB_JOB_CHANGE
    name: 换工作/离职
    keywords:
      - 换工作
      - 离职
    dpd_hint: 30+
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您现在是在工作交接期吗？一般预计什么时候新单位的收入能稳定下来？"
    script_empathy: "换工作期间支出多、收入又不稳定，这点我完全理解。"
    script_solution: "我们可以按照您新工资发放的节奏调整还款日，先约定一个缓冲期结束的时间点。"
    realtime_priority: true
  - category: JOB
    code: JOB_BUSINESS_HARD
    name: 生意困难
    keywords:
      - 生意困难
      - 生意不好
    dpd_hint: 全周期
    loan_purpose: 商用为主
    risk_intensity: 中
    script_open: "您说最近生意不太好，是订单减少了，还是回款慢了？"
    script_empathy: "做生意波动大，回款一慢，资金链就会很紧，这种压力我能理解。"
    script_solution: "我们先根据您当前的回款节奏安排一个更现实的还款计划，避免账户持续恶化。"
    realtime_priority: true
  - category: JOB
    code: JOB_CONSTRUCTION
    name: 工地工作
    keywords:
      - 工地
      - 外包工
    dpd_hint: 全周期
    loan_purpose: 商用为主
    risk_intensity: 中
    script_open: "您现在还是在工地类工作吗？最近收入结算是按月还是按项目回款？"
    script_empathy: "工地类工作收入波动和结算周期都不稳定，这种情况确实容易影响还款。"
    script_solution: "可以结合您的结算周期，把还款时间点往收入到账节点上靠，先稳住账户。"
    realtime_priority: true
  - category: JOB
    code: JOB_RIDE_HAILING
    name: 网约车
    keywords:
      - 网约车
      - 打车平台
    dpd_hint: 60+
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您现在主要靠网约车收入吗？最近接单和流水情况怎么样？"
    script_empathy: "网约车收入受平台和时段影响很大，不稳定是很常见的。"
    script_solution: "我们可以按您近期的平均流水来定一个更贴近现实的小额还款方案。"
    realtime_priority: true
  - category: JOB
    code: JOB_UNSTABLE
    name: 工作不稳定
    keywords:
      - 工作不稳定
      - 收入不固定
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您说工作不太稳定，是工作时有时无，还是收入浮动比较大？"
    script_empathy: "工作和收入都不稳定的时候，确实很难按固定节奏去还款。"
    script_solution: "我们可以优先考虑弹性更高的还款安排，先保证您能够持续履约。"
    realtime_priority: true
  - category: MULTI_DEBT
    code: DEBT_OTHER
    name: 其他负债
    keywords:
      - 其他负债
      - 民间借贷
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "听下来您这边除了这笔之外，还有其他负债在同时处理，对吗？"
    script_empathy: "多笔负债同时压在一起，确实会让现金流非常紧张。"
    script_solution: "我们可以一起梳理优先级，先把这边安排成您当前能承受的水平，避免全面失控。"
    realtime_priority: true
  - category: MULTI_DEBT
    code: DEBT_MORTGAGE
    name: 房贷
    keywords:
      - 房贷
      - 按揭
    dpd_hint: 全周期
    loan_purpose: 自用为主
    risk_intensity: 中
    script_open: "您这边除了车贷还有房贷在身上，最近哪个压力更大一些？"
    script_empathy: "房贷和车贷同时在还，负担确实不轻。"
    script_solution: "我们可以先把本期金额拆小，优先维持账户状态，减轻您当下的月度压力。"
    realtime_priority: true
  - category: MULTI_DEBT
    code: DEBT_CREDITCARD
    name: 信用卡
    keywords:
      - 信用卡
      - 信用卡分期
    dpd_hint: 全周期
    loan_purpose: 自用为主
    risk_intensity: 中
    script_open: "您现在信用卡这边压力也比较大，是账单集中到期了吗？"
    script_empathy: "多张卡同时到期时，很容易顾不过来，这种情况很常见。"
    script_solution: "我们可以结合您信用卡账单周期，尽量把这边的还款安排错峰，减少同一时间的压力。"
    realtime_priority: true
  - category: HEALTH
    code: HEALTH_SICK
    name: 生病
    keywords:
      - 生病
      - 身体不好
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您刚才提到最近身体不太好，现在情况有好一些吗？"
    script_empathy: "身体不舒服的时候，工作和收入都会受影响，这点我很理解。"
    script_solution: "我们先看是否能按较小金额维持账户，等身体恢复后再做后续安排。"
    realtime_priority: true
  - category: HEALTH
    code: HEALTH_HOSPITAL
    name: 住院
    keywords:
      - 住院
      - 做手术
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 高
    script_open: "刚刚听您说家里有人在住院或做治疗，现在情况还好吗？"
    script_empathy: "医疗支出一下子上来，对谁来说都会有很大压力。"
    script_solution: "我们可以先约定一个小额维持还款，让账户不要继续恶化，后面再根据情况调整。"
    realtime_priority: true
  - category: HEALTH
    code: HEALTH_SERIOUS
    name: 重大疾病
    keywords:
      - 重大疾病
      - 大病
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 高
    script_open: "您提到是重大疾病相关支出，现在治疗是不是还在持续？"
    script_empathy: "遇到重大疾病，肯定是先保障家人的身体和治疗，我非常理解。"
    script_solution: "在这个特殊阶段，我们先把还款目标定得更现实一些，优先避免风险进一步升级。"
    realtime_priority: true
  - category: EVENT
    code: EVENT_ACCIDENT
    name: 事故
    keywords:
      - 车祸
      - 事故
    dpd_hint: 30+
    loan_purpose: 自用/商用通用
    risk_intensity: 高
    script_open: "您说最近发生了事故，现在处理进展到哪一步了？"
    script_empathy: "突发事故带来的支出和精力消耗都很大，这种情况确实会影响还款安排。"
    script_solution: "我们先按照您目前能承受的节奏做阶段性安排，等事故处理告一段落再调整。"
    realtime_priority: true
  - category: EVENT
    code: EVENT_FRAUD
    name: 被诈骗
    keywords:
      - 被骗
      - 被诈骗
    dpd_hint: 60+
    loan_purpose: 自用/商用通用
    risk_intensity: 高
    script_open: "您说之前遇到诈骗，方便简单讲一下目前资金受影响的情况吗？"
    script_empathy: "被骗本身就很难受，再叠加还款压力，心理上肯定更焦虑。"
    script_solution: "虽然被骗资金短期难追回，但我们可以先定一个阶段性计划，避免这边继续滚动增加压力。"
    realtime_priority: true
  - category: EVENT
    code: EVENT_DEATH
    name: 去世
    keywords:
      - 去世
      - 过世
    dpd_hint: 60+
    loan_purpose: 自用/商用通用
    risk_intensity: 高
    script_open: "听您提到家里最近有亲人去世，这段时间一定很不容易。"
    script_empathy: "这种家庭变故对情绪和生活的影响都很大，我能理解您现在的处境。"
    script_solution: "我们先不把目标定得太高，优先确认一个您能接受的后续沟通和小额安排。"
    realtime_priority: true
  - category: EVENT
    code: EVENT_FESTIVAL
    name: 节日
    keywords:
      - 过节
      - 节日支出
    dpd_hint: 30+
    loan_purpose: 自用为主
    risk_intensity: 低
    script_open: "这次主要是因为节日期间支出比较集中，对吗？"
    script_empathy: "节日期间支出增加很常见，很多客户都会遇到类似情况。"
    script_solution: "那我们就尽量把本期处理掉，并同步规划下期提醒，避免类似问题重复发生。"
    realtime_priority: false
  - category: EVENT
    code: EVENT_REMOTE
    name: 在外地/异地
    keywords:
      - 在外地
      - 异地
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 低
    script_open: "您现在人在外地吗？这对您处理还款是不是带来了一些不方便？"
    script_empathy: "人在异地时，很多事情确实不如在本地处理方便。"
    script_solution: "我们可以优先确认线上可操作的方式，把手续和还款路径尽量简化。"
    realtime_priority: false
  - category: EVENT
    code: EVENT_DEALER
    name: 经销商倒闭
    keywords:
      - 经销商倒闭
      - 门店关门
    dpd_hint: 30+
    loan_purpose: 商用专属
    risk_intensity: 高
    script_open: "您提到经销商或门店出了问题，现在对您经营影响大吗？"
    script_empathy: "渠道或门店出问题，会直接影响现金流和经营安排，这个压力我理解。"
    script_solution: "我们先基于您当前经营恢复情况设一个现实的还款节奏，避免一刀切地要求。"
    realtime_priority: true
  - category: EVENT
    code: EVENT_CAR_QUALITY
    name: 汽车质量问题
    keywords:
      - 汽车质量
      - 车辆问题
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您说车辆本身有质量问题，现在还在维修或协商处理吗？"
    script_empathy: "车辆有问题不仅影响使用，也会影响收入和还款意愿，这点可以理解。"
    script_solution: "我们先把情况记录清楚，同时确认您当前最可行的付款节奏，先避免账户继续升级。"
    realtime_priority: true
  - category: CHANNEL
    code: CHANNEL_CARD_ERROR
    name: 银行卡异常
    keywords:
      - 银行卡异常
      - 扣款失败
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您这次主要是银行卡状态异常或扣款失败，对吗？"
    script_empathy: "这种技术性问题确实比较让人着急，尤其不是主观不想还的情况。"
    script_solution: "我们现在先确认可用银行卡或其他支付路径，尽快把这期补上，避免继续逾期。"
    realtime_priority: true
  - category: CHANNEL
    code: CHANNEL_CHANGE
    name: 还款渠道/还款日变更
    keywords:
      - 还款渠道变更
      - 还款日变更
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 低
    script_open: "您这边是对还款渠道或还款日期有调整需求，是吗？"
    script_empathy: "渠道或日期变化如果没同步好，确实容易影响正常扣款。"
    script_solution: "我们可以先帮您确认最新的还款方式，同时把后续节点重新对齐。"
    realtime_priority: false
  - category: METHOD
    code: METHOD_ISSUE
    name: 还款方式问题
    keywords:
      - 还款方式
      - 扣款方式
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 低
    script_open: "您是对当前还款方式有疑问，还是操作上遇到问题？"
    script_empathy: "操作不顺的时候，确实会让人更抗拒继续处理账单。"
    script_solution: "我们可以一步一步把当前可操作的方式确认下来，先把本期问题解决。"
    realtime_priority: false
  - category: FAMILY
    code: FAMILY_DIVORCE
    name: 离婚
    keywords:
      - 离婚
    dpd_hint: 60+
    loan_purpose: 自用为主
    risk_intensity: 中
    script_open: "您提到最近经历离婚，这段时间生活节奏应该变化挺大吧？"
    script_empathy: "家庭关系变化带来的情绪和财务压力都会很明显，这点我能理解。"
    script_solution: "我们先按您当前的实际承受能力来安排，后续再根据生活稳定情况调整。"
    realtime_priority: true
  - category: FAMILY
    code: FAMILY_MARRIAGE
    name: 结婚
    keywords:
      - 结婚
      - 办婚礼
    dpd_hint: 60+
    loan_purpose: 自用为主
    risk_intensity: 低
    script_open: "您这边最近因为结婚相关支出比较集中，是吗？"
    script_empathy: "婚礼、彩礼、家庭安排叠加起来，资金压力确实会很明显。"
    script_solution: "我们可以先按短期现金流承受能力做安排，避免一次性要求过高。"
    realtime_priority: false
  - category: FAMILY
    code: FAMILY_CHILD
    name: 子女支出
    keywords:
      - 孩子
      - 学费
    dpd_hint: 全周期
    loan_purpose: 自用为主
    risk_intensity: 中
    script_open: "您说最近孩子相关支出比较多，是教育还是生活方面的支出增加了？"
    script_empathy: "家庭里有孩子时，很多支出都是刚性的，这一点完全可以理解。"
    script_solution: "我们可以先在不影响家庭基本支出的前提下，确认一个您能持续执行的金额。"
    realtime_priority: true
  - category: BEHAVIOR
    code: BEHAV_FORGET
    name: 忘记还款
    keywords:
      - 忘记还款
      - 忘记了
    dpd_hint: 30内
    loan_purpose: 自用/商用通用
    risk_intensity: 低
    script_open: "这次主要是忘记还款日了吗？您平时是靠短信提醒还是自己记账？"
    script_empathy: "现在账单多，偶尔忘记一期其实很常见。"
    script_solution: "我们可以先把这期补上，同时帮您确认提醒方式，尽量避免下次再遗漏。"
    realtime_priority: false
  - category: OTHER
    code: OTHER_MISC
    name: 其他
    keywords:
      - 其他
      - 说不清
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: 中
    script_open: "您刚才提到的情况比较复杂，方便再简单说一下最主要的原因吗？"
    script_empathy: "每个人遇到的情况都不太一样，我先把您的重点困难听清楚。"
    script_solution: "我们先抓最影响当前还款的那个问题，再看怎么做一个能执行的安排。"
    realtime_priority: true
  - category: OTHER
    code: OTHER_UNKNOWN
    name: 未知
    keywords:
      - 未触达
      - 未提及原因
    dpd_hint: 全周期
    loan_purpose: 自用/商用通用
    risk_intensity: mid
    script_open: "目前还没有获取到您这边的具体原因，我这边想先确认一下您的基本情况，可以吗？"
    script_empathy: "现在原因还不明确，我这边先不过多假设，主要是想了解您真实的困难。"
    script_solution: "建议先完成一次有效沟通，弄清是否存在实质性还款障碍，再一起讨论后续方案。"
    realtime_priority: false
`,
};