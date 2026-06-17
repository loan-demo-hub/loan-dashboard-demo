/**
 * UI Layer — rendering & event binding only. No business rules.
 */
const UI = (() => {
  let els = {};
  let chatHistory = [];
  let onSendMessage = null;

  function cacheElements() {
    els = {
      contractList: document.getElementById("contractList"),
      contractCount: document.getElementById("contractCount"),
      contractSummary: document.getElementById("contractSummary"),
      searchInput: document.getElementById("searchInput"),
      riskFilter: document.getElementById("riskFilter"),
      sortOrder: document.getElementById("sortOrder"),
      chatMessages: document.getElementById("chatMessages"),
      chatForm: document.getElementById("chatForm"),
      chatInput: document.getElementById("chatInput"),
      sendBtn: document.getElementById("sendBtn"),
      clearChatBtn: document.getElementById("clearChatBtn"),
      quickPrompts: document.getElementById("quickPrompts"),
      loadStatus: document.getElementById("loadStatus"),
      aiModeBadge: document.getElementById("aiModeBadge"),
      longcatSettingsBtn: document.getElementById("longcatSettingsBtn"),
      longcatSettingsDialog: document.getElementById("longcatSettingsDialog"),
      longcatSettingsForm: document.getElementById("longcatSettingsForm"),
      longcatSettingsCancel: document.getElementById("longcatSettingsCancel"),
      longcatEnabled: document.getElementById("longcatEnabled"),
      longcatApiKey: document.getElementById("longcatApiKey"),
      longcatModel: document.getElementById("longcatModel"),
      longcatUseProxy: document.getElementById("longcatUseProxy"),
      longcatBaseUrl: document.getElementById("longcatBaseUrl"),
      adoptionMetrics: document.getElementById("adoptionMetrics"),
    };
  }

  function createMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function buildAssistantMessage(payload, contractId) {
    const messageId = createMessageId();
    FeedbackStore.registerMessage(messageId, { contractId });
    const storedFeedback = FeedbackStore.getFeedback(messageId);
    return {
      role: "assistant",
      messageId,
      feedback: storedFeedback,
      ...payload,
    };
  }

  function syncMessageFeedback(message) {
    if (message?.messageId && message.feedback == null) {
      message.feedback = FeedbackStore.getFeedback(message.messageId);
    }
    return message;
  }

  function renderFeedbackButtons(message) {
    if (!message.messageId) return "";
    syncMessageFeedback(message);
    const adoptedActive = message.feedback === "adopted" ? " active" : "";
    const notAdoptedActive = message.feedback === "not_adopted" ? " active" : "";
    return `
      <div class="message-feedback" data-message-id="${escapeHtml(message.messageId)}">
        <button
          type="button"
          class="btn-feedback btn-feedback--adopted${adoptedActive}"
          data-feedback="adopted"
          aria-pressed="${message.feedback === "adopted"}"
          aria-label="Adopted">
          👍 Adopted
        </button>
        <button
          type="button"
          class="btn-feedback btn-feedback--not-adopted${notAdoptedActive}"
          data-feedback="not_adopted"
          aria-pressed="${message.feedback === "not_adopted"}"
          aria-label="Not adopted">
          👎 Not adopted
        </button>
      </div>`;
  }

  function updateAdoptionMetrics() {
    if (!els.adoptionMetrics) return;
    const m = FeedbackStore.getMetrics();
    els.adoptionMetrics.innerHTML = `
      <div class="adoption-metric">
        <span class="adoption-metric-label">AI累计建议：</span>
        <span class="adoption-metric-value">${m.totalAssistantResponses}<span class="adoption-metric-unit">条</span></span>
      </div>
      <div class="adoption-metric">
        <span class="adoption-metric-label">已评价：</span>
        <span class="adoption-metric-value">${m.ratedCount}<span class="adoption-metric-unit">条</span></span>
      </div>
      <div class="adoption-metric adoption-metric--rate">
        <span class="adoption-metric-label">整体采纳率：</span>
        <span class="adoption-metric-value">${escapeHtml(m.adoptionRatePercent)}</span>
      </div>`;
  }

  function applyFeedbackToMessage(messageId, feedback) {
    const msg = chatHistory.find((m) => m.messageId === messageId);
    if (msg) msg.feedback = feedback;
    FeedbackStore.setFeedback(messageId, feedback);
    updateAdoptionMetrics();
  }

  function updateFeedbackButtonsInDom(container, feedback) {
    container.querySelectorAll(".btn-feedback").forEach((btn) => {
      const isActive = btn.dataset.feedback === feedback;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightScriptMetrics(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(
      /(\d+(?:\.\d+)?(?:%|元|天|分|笔)?)/g,
      '<span class="script-highlight">$1</span>'
    );
  }

  function renderRiskGauge(score, level) {
    const clamped = Math.max(0, Math.min(100, Number(score) || 0));
    const arcLen = Math.round((clamped / 100) * 157);
    return `
      <div class="risk-gauge risk-${level}" aria-label="风险评分 ${clamped}">
        <svg viewBox="0 0 120 68" class="risk-gauge-svg" aria-hidden="true">
          <defs>
            <linearGradient id="gaugeGrad-${level}" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#22c55e"/>
              <stop offset="55%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#ef4444"/>
            </linearGradient>
          </defs>
          <path class="risk-gauge-track" d="M12 58 A48 48 0 0 1 108 58" />
          <path class="risk-gauge-fill" d="M12 58 A48 48 0 0 1 108 58"
            stroke="url(#gaugeGrad-${level})" stroke-dasharray="${arcLen} 157" />
        </svg>
        <span class="risk-gauge-value">${clamped}</span>
        <span class="risk-gauge-label">风险评分</span>
      </div>`;
  }

  function formatLastContactDisplay(contract) {
    if (contract.recentCommunication) return escapeHtml(contract.recentCommunication);
    const d = new Date();
    d.setDate(d.getDate() - Math.min(Math.max(contract.overdueDays - 7, 1), 45));
    return d.toLocaleDateString("zh-CN");
  }

  function renderContractCard(c, isActive, dataLayer) {
    const label = dataLayer.getRiskLabel(c.riskLevel);
    const demoBadge = c.isDemo
      ? `<span class="card-demo-badge">${escapeHtml(DemoContracts.getScenarioLabel(c.demoScenario))}</span>`
      : "";
    return `
      <article
        class="contract-card${isActive ? " active" : ""}${c.isDemo ? " contract-card--demo" : ""}"
        role="option"
        aria-selected="${isActive}"
        tabindex="0"
        data-id="${c.contractId}">
        <div class="card-row card-row--top">
          <span class="card-id">${escapeHtml(c.contractId)}</span>
          ${demoBadge}
          <span class="card-risk risk-${c.riskLevel}">${escapeHtml(label)}</span>
        </div>
        <div class="card-row card-row--mid">
          <span class="card-customer">${escapeHtml(c.customerName)}</span>
          <span class="card-amount">${dataLayer.formatAmount(c.loanAmount)}</span>
        </div>
        <div class="card-row card-row--bot">
          <span class="card-overdue risk-text-${c.riskLevel}">逾期 ${c.overdueDays} 天</span>
          <span class="card-score">风险评分 <strong>${c.riskScore}</strong></span>
        </div>
      </article>`;
  }

  function sortContracts(list, order) {
    const demos = list.filter((c) => c.isDemo);
    const rest = list.filter((c) => !c.isDemo);
    const sorted = [...rest];
    switch (order) {
      case "score_desc":
        sorted.sort((a, b) => b.riskScore - a.riskScore);
        break;
      case "amount_desc":
        sorted.sort((a, b) => b.loanAmount - a.loanAmount);
        break;
      default:
        sorted.sort((a, b) => b.overdueDays - a.overdueDays);
    }
    return [...demos, ...sorted];
  }

  function renderContractList(dataLayer) {
    const q = els.searchInput.value.trim().toLowerCase();
    const risk = els.riskFilter?.value || "";
    const order = els.sortOrder?.value || "overdue_desc";
    const selected = dataLayer.getSelected();

    let filtered = dataLayer.getAll().filter((c) => {
      const matchText =
        c.contractId.toLowerCase().includes(q) || c.customerName.toLowerCase().includes(q);
      const matchRisk = !risk || c.riskLevel === risk;
      return matchText && matchRisk;
    });

    filtered = sortContracts(filtered, order);

    els.contractList.innerHTML = filtered.length
      ? filtered.map((c) => renderContractCard(c, selected?.contractId === c.contractId, dataLayer)).join("")
      : `<div class="list-empty">无匹配合同</div>`;

    els.contractCount.textContent = `${dataLayer.getAll().length} 笔`;
  }

  function traitLevelClass(value, kind) {
    const v = String(value || "");
    if (v === "高") return kind === "complaint" ? "trait-complaint-high" : "trait-will-high";
    if (v === "低") return kind === "complaint" ? "trait-complaint-low" : "trait-will-low";
    return kind === "complaint" ? "trait-complaint-mid" : "trait-will-mid";
  }

  function renderTraitValue(value, kind) {
    const cls = traitLevelClass(value, kind);
    return `<span class="summary-trait ${cls}">${escapeHtml(String(value || "—"))}</span>`;
  }

  function renderOverdueReason(reason) {
    if (!reason?.name) {
      return `<span class="summary-trait trait-reason-unknown">待识别</span>`;
    }
    const intensity = reason.riskIntensity && reason.riskIntensity !== "--" ? reason.riskIntensity : "";
    const badge = intensity
      ? `<span class="reason-intensity reason-intensity--${intensity === "高" ? "high" : intensity === "低" ? "low" : "mid"}">${escapeHtml(intensity)}</span>`
      : "";
    return `<span class="summary-trait trait-reason">${escapeHtml(reason.name)}</span>${badge}`;
  }

  function renderAntiCollectionAnalysis(assessment) {
    if (!assessment || assessment.level === 0) return "";

    const signals =
      assessment.matchedSignalLabels?.length > 0
        ? assessment.matchedSignalLabels.join("、")
        : "—";
    const behaviorLabel = assessment.isAntiCollectionBehavior ? "是" : "否（合法维权）";

    return `
      <section class="anti-collection-analysis" aria-label="Anti-Collection Assessment">
        <div class="anti-collection-head">
          <h3 class="anti-collection-title">Anti-Collection Assessment</h3>
          <span class="anti-collection-risk-badge ${assessment.riskCss}">${escapeHtml(assessment.risk)} Risk</span>
        </div>
        <dl class="anti-collection-metrics">
          <div class="anti-collection-metric">
            <dt>Level</dt>
            <dd>L${assessment.level} · ${escapeHtml(assessment.classificationZh)}</dd>
          </div>
          <div class="anti-collection-metric">
            <dt>Matched Signals</dt>
            <dd>${escapeHtml(signals)}</dd>
          </div>
          <div class="anti-collection-metric">
            <dt>Confidence</dt>
            <dd class="anti-collection-confidence">${assessment.confidenceScore}%</dd>
          </div>
          <div class="anti-collection-metric">
            <dt>Anti-Collection?</dt>
            <dd>${behaviorLabel}</dd>
          </div>
        </dl>
        <div class="anti-collection-action">
          <span class="anti-collection-action-label">Recommended Action</span>
          <p>${escapeHtml(assessment.recommendedAction)}</p>
        </div>
      </section>`;
  }

  function renderCollateralAnalysis(c, dataLayer) {
    const analysis = CollateralAnalyzer.analyze(c);
    if (!analysis) return "";

    const risk = analysis.collateralRisk;
    return `
      <section class="collateral-analysis" aria-label="Collateral Analysis">
        <div class="collateral-head">
          <h3 class="collateral-title">Collateral Analysis</h3>
          <span class="collateral-risk-badge ${risk.cssClass}">${escapeHtml(risk.label)}</span>
        </div>
        <dl class="collateral-metrics">
          <div class="collateral-metric">
            <dt>Vehicle Information</dt>
            <dd>${escapeHtml(c.vehicleBrand)} ${escapeHtml(c.vehicleModel)} · ${c.vehicleYear}</dd>
          </div>
          <div class="collateral-metric">
            <dt>Outstanding Balance</dt>
            <dd>${dataLayer.formatAmount(c.outstandingBalance)}</dd>
          </div>
          <div class="collateral-metric">
            <dt>Market Value</dt>
            <dd>${dataLayer.formatAmount(c.vehicleMarketValue)}</dd>
          </div>
          <div class="collateral-metric">
            <dt>LTV</dt>
            <dd class="collateral-ltv collateral-ltv--${risk.level}">${escapeHtml(analysis.ltvPercent)}</dd>
          </div>
          <div class="collateral-metric">
            <dt>Recommended Asset Strategy</dt>
            <dd class="collateral-strategy-label">${escapeHtml(analysis.strategyLabel)}</dd>
          </div>
        </dl>
        <div class="collateral-strategy-reason">
          <span class="collateral-strategy-reason-label">Strategy rationale</span>
          <p>${escapeHtml(analysis.strategyReason)}</p>
        </div>
      </section>`;
  }

  function renderContractSummary(dataLayer) {
    if (!els.contractSummary) return;
    const c = dataLayer.getSelected();
    if (!c) {
      els.contractSummary.innerHTML = `<div class="contract-summary-empty">请从左侧选择一笔逾期合同</div>`;
      els.contractSummary.className = "contract-summary";
      return;
    }

    const label = dataLayer.getRiskLabel(c.riskLevel);
    const score = c.riskScore;

    const p = c.customerProfile;

    els.contractSummary.className = `contract-summary has-contract risk-${c.riskLevel}`;
    els.contractSummary.innerHTML = `
      <div class="summary-body">
        <div class="summary-main">
          <div class="summary-head">
            <span class="summary-tag">当前合同</span>
            <span class="summary-id">${escapeHtml(c.contractId)}</span>
            ${c.isDemo ? `<span class="summary-demo-badge">${escapeHtml(DemoContracts.getScenarioLabel(c.demoScenario))}</span>` : ""}
            <span class="summary-risk risk-${c.riskLevel}">${escapeHtml(label)}</span>
          </div>
          <dl class="summary-metrics">
            <div class="summary-metric">
              <dt>客户姓名</dt>
              <dd>${escapeHtml(c.customerName)}</dd>
            </div>
            <div class="summary-metric">
              <dt>逾期天数</dt>
              <dd class="risk-text-${c.riskLevel}">${c.overdueDays} 天</dd>
            </div>
            <div class="summary-metric">
              <dt>逾期金额</dt>
              <dd class="risk-text-${c.riskLevel}">${dataLayer.formatAmount(dataLayer.getOverdueAmount(c))}</dd>
            </div>
            <div class="summary-metric">
              <dt>贷款金额</dt>
              <dd>${dataLayer.formatAmount(c.loanAmount)}</dd>
            </div>
            <div class="summary-metric">
              <dt>风险评分</dt>
              <dd class="risk-text-${c.riskLevel}">${score}</dd>
            </div>
            <div class="summary-metric">
              <dt>建议行动</dt>
              <dd>${renderActionBadge(c.recommendedActionCategory)}</dd>
            </div>
            <div class="summary-metric">
              <dt>还款意愿</dt>
              <dd>${renderTraitValue(p.repaymentWillingness, "will")}</dd>
            </div>
            <div class="summary-metric">
              <dt>投诉倾向</dt>
              <dd>${renderTraitValue(p.complaintTendency, "complaint")}</dd>
            </div>
            <div class="summary-metric">
              <dt>逾期原因</dt>
              <dd>${renderOverdueReason(c.overdueReason)}</dd>
            </div>
          </dl>
          <div class="summary-communication">
            <span class="summary-communication-label">最近沟通</span>
            <p class="summary-communication-text">${formatLastContactDisplay(c)}</p>
          </div>
        </div>
        ${renderAntiCollectionAnalysis(AntiCollectionDetector.analyzeContract(c))}
        ${renderCollateralAnalysis(c, dataLayer)}
      </div>
      <div class="summary-gauge">${renderRiskGauge(score, c.riskLevel)}</div>`;
  }

  function formatScoreDelta(delta) {
    if (delta === 0) return "0";
    return delta > 0 ? `+${delta}` : String(delta);
  }

  function renderActionBadge(categoryId) {
    return ActionCategoryPicker.renderBadgeHtml(categoryId, escapeHtml);
  }

  function getLatestActionCategory() {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.role === "assistant" && msg.structured?.recommendedActionCategory) {
        return msg.structured.recommendedActionCategory;
      }
    }
    return null;
  }

  function extractEmbeddedJson(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;

    const attempts = [text];
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      attempts.push(text.slice(start, end + 1));
    }

    for (const candidate of attempts) {
      try {
        return LongCatClient.extractJson(candidate);
      } catch {
        /* try next */
      }
    }
    return null;
  }

  function unescapeJsonString(value) {
    return String(value || "")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
  }

  function extractJsonStringField(text, field) {
    const source = String(text || "");
    const keyMatch = source.match(new RegExp(`"${field}"\\s*:`, "i"));
    if (!keyMatch || keyMatch.index == null) return null;

    const tail = source.slice(keyMatch.index);
    const openMatch = tail.match(new RegExp(`"${field}"\\s*:\\s*"`, "i"));
    if (!openMatch) return null;

    let i = openMatch.index + openMatch[0].length;
    let out = "";
    while (i < tail.length) {
      const ch = tail[i];
      if (ch === "\\" && i + 1 < tail.length) {
        out += tail[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') break;
      out += ch;
      i += 1;
    }
    return out || null;
  }

  function stripJsonArtifacts(text) {
    return String(text || "")
      .replace(/^\s*\{?\s*"collectionScript"\s*:\s*"?/gi, "")
      .replace(/^\s*\{?\s*"collection_script"\s*:\s*"?/gi, "")
      .replace(/^\s*\{?\s*"script"\s*:\s*"?/gi, "")
      .replace(/"\s*,?\s*"nextStep"\s*:\s*"[\s\S]*?"?\s*\}?\s*$/gi, "")
      .replace(/"\s*,?\s*"next_step"\s*:\s*"[\s\S]*?"?\s*\}?\s*$/gi, "")
      .replace(/^[\s"'{]+|[\s"'}]+$/g, "")
      .trim();
  }

  function looksLikeJsonPayload(text) {
    const raw = String(text || "").trim();
    return (
      raw.startsWith("{") ||
      /"collectionScript"\s*:/i.test(raw) ||
      /"nextStep"\s*:/i.test(raw) ||
      /"collection_script"\s*:/i.test(raw)
    );
  }

  function parseScriptPayload(raw) {
    const text = String(raw || "").trim();
    if (!text) return { script: "", nextStep: "" };

    if (!looksLikeJsonPayload(text)) {
      return { script: stripJsonArtifacts(text), nextStep: "" };
    }

    const parsed = extractEmbeddedJson(text);
    if (parsed) {
      return {
        script: unescapeJsonString(
          parsed.collectionScript || parsed.collection_script || parsed.script || ""
        ),
        nextStep: unescapeJsonString(parsed.nextStep || parsed.next_step || ""),
      };
    }

    const script =
      extractJsonStringField(text, "collectionScript") ||
      extractJsonStringField(text, "collection_script") ||
      extractJsonStringField(text, "script");
    const nextStep =
      extractJsonStringField(text, "nextStep") || extractJsonStringField(text, "next_step");

    if (script) {
      return {
        script: unescapeJsonString(script),
        nextStep: unescapeJsonString(nextStep || ""),
      };
    }

    return { script: stripJsonArtifacts(text), nextStep: unescapeJsonString(nextStep || "") };
  }

  function cleanChineseText(text) {
    let result = stripJsonArtifacts(parseScriptPayload(text).script || String(text || ""));
    result = result.replace(/^nextStep\s*[:：]\s*/i, "").trim();
    return result;
  }

  function cleanNextStep(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const parsed = parseScriptPayload(raw);
    if (parsed.nextStep) return parsed.nextStep;
    if (looksLikeJsonPayload(raw)) return stripJsonArtifacts(raw);
    return raw;
  }

  function normalizeDisplayFields(data) {
    const combined = [data.collectionScript, data.nextStep].filter(Boolean).join("\n");
    const merged = parseScriptPayload(combined);
    const fromScript = parseScriptPayload(data.collectionScript);

    let script =
      fromScript.script ||
      merged.script ||
      cleanChineseText(data.collectionScript);
    let nextStep = merged.nextStep || fromScript.nextStep || "";

    if (!nextStep || looksLikeJsonPayload(nextStep)) {
      nextStep = parseScriptPayload(data.nextStep).nextStep || merged.nextStep || "";
    }

    if (looksLikeJsonPayload(script)) {
      script = parseScriptPayload(script).script || stripJsonArtifacts(script);
    }

    nextStep = stripJsonArtifacts(nextStep).replace(/^nextStep\s*[:：]\s*/i, "").trim();

    if (!nextStep) {
      nextStep = String(data.nextStep || "").trim();
      if (looksLikeJsonPayload(nextStep)) {
        nextStep = parseScriptPayload(nextStep).nextStep;
      }
      nextStep = stripJsonArtifacts(nextStep);
    }

    return { ...data, collectionScript: script, nextStep };
  }

  function formatLayeredScripts(reasonScripts) {
    if (!reasonScripts) return formatScriptParagraphs("");

    const layers = [
      { label: "开场", text: reasonScripts.open },
      { label: "共情", text: reasonScripts.empathy },
      { label: "引导", text: reasonScripts.solution },
    ].filter((layer) => String(layer.text || "").trim());

    if (!layers.length) return formatScriptParagraphs(reasonScripts.combined || "");

    return layers
      .map(
        (layer) => `
        <div class="script-layer">
          <span class="script-layer-label">${escapeHtml(layer.label)}</span>
          <p class="script-quote-text">${highlightScriptMetrics(cleanChineseText(layer.text))}</p>
        </div>`
      )
      .join("");
  }

  function formatScriptParagraphs(text) {
    const normalized = cleanChineseText(text);
    if (!normalized) {
      return `<p class="script-quote-text script-quote-text--empty">暂无可用话术，请稍后重试或查看左侧建议行动。</p>`;
    }

    const parts = normalized
      .split(/(?<=[。！？!?])\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length <= 1) {
      return `<p class="script-quote-text">${highlightScriptMetrics(normalized)}</p>`;
    }

    return parts
      .map((part) => `<p class="script-quote-text">${highlightScriptMetrics(part)}</p>`)
      .join("");
  }

  function renderStructuredPanel(data, message = {}, contract, dataLayer) {
    const display = normalizeDisplayFields(data);
    const cp = display.customerProfile;
    const kwDisplay = display.matchedKeywords.length ? display.matchedKeywords.join("、") : "无";
    const reasonKwDisplay =
      display.reasonMatchedKeywords?.length ? display.reasonMatchedKeywords.join("、") : null;
    const overdueReasonDisplay = display.overdueReason?.name
      ? `${display.overdueReason.name}${display.overdueReason.code ? ` (${display.overdueReason.code})` : ""}`
      : "—";
    const executionPlan =
      cleanNextStep(display.nextStep) ||
      ActionCategoryPicker.getNextStep(display.recommendedActionCategory);
    const riskLevel = contract?.riskLevel || "yellow";
    const riskLabel = contract ? dataLayer.getRiskLabel(riskLevel) : "—";
    const scoreDelta = formatScoreDelta(display.riskScoreDelta);
    const deltaClass =
      display.riskScoreDelta > 0 ? "kv-delta--up" : display.riskScoreDelta < 0 ? "kv-delta--down" : "";

    const finalScoreHtml = `
      <span class="kv-score-display">
        <span class="kv-score-num risk-text-${riskLevel}">${escapeHtml(String(display.finalRiskScore))}</span>
        <span class="kv-score-level risk-${riskLevel}">${escapeHtml(riskLabel)}</span>
      </span>`;

    const scoreDeltaHtml = `
      <span class="kv-delta ${deltaClass}">${escapeHtml(scoreDelta)}</span>`;

    const kvItem = (label, value) => {
      const ddContent =
        value && typeof value === "object" && value.__html != null
          ? value.__html
          : escapeHtml(String(value ?? ""));
      return `
      <div class="kv-item">
        <dt>${escapeHtml(label)}</dt>
        <dd>${ddContent}</dd>
      </div>`;
    };

    return `
      <div class="response-card">
        ${message.apiWarning ? `<div class="response-alert">${escapeHtml(message.apiWarning)}</div>` : ""}
        <section class="response-col response-col--rules">
          <h3 class="response-col-title">规则引擎输出</h3>
          <dl class="kv-list">
            ${kvItem("识别规则 ID", display.ruleId)}
            ${kvItem("匹配类关键词", kwDisplay)}
            ${reasonKwDisplay ? kvItem("逾期原因关键词", reasonKwDisplay) : ""}
            ${kvItem("逾期原因标签", overdueReasonDisplay)}
            ${kvItem("风险评分变化", { __html: scoreDeltaHtml })}
            ${kvItem("最终风险评分", { __html: finalScoreHtml })}
            ${kvItem("建议行动类别", { __html: renderActionBadge(display.recommendedActionCategory) })}
          </dl>
          <div class="rule-action-callout">
            <span class="rule-action-callout-label">建议行动</span>
            <p class="rule-action-callout-text">${escapeHtml(executionPlan)}</p>
          </div>
          ${renderAntiCollectionAnalysis(display.antiCollection)}
        </section>
        <section class="response-col">
          <h3 class="response-col-title">客户特征</h3>
          <dl class="kv-list kv-list--traits">
            ${kvItem("性别/年龄", cp.genderAge)}
            ${kvItem("职业", cp.occupation)}
            ${kvItem("所在城市", cp.city)}
            ${kvItem("收入水平", cp.incomeLevel)}
            ${kvItem("婚姻状况", cp.maritalStatus)}
            ${kvItem("联系偏好", cp.contactPreference)}
            ${kvItem("逾期原因", overdueReasonDisplay)}
          </dl>
        </section>
        <section class="response-col response-col--action">
          <h3 class="response-col-title response-col-title--accent">催收话术</h3>
          <div class="script-box">
            <div class="script-box-head">
              <span class="script-box-title">话术建议</span>
              <button type="button" class="btn-copy-script" aria-label="复制话术">复制</button>
            </div>
            <div class="script-box-body">
              ${
                display.reasonScripts
                  ? formatLayeredScripts(display.reasonScripts)
                  : formatScriptParagraphs(display.collectionScript)
              }
            </div>
          </div>
        </section>
      </div>`;
  }

  function formatAssistantText(text) {
    const normalized = String(text || "").trim();
    if (!normalized) return "";
    return normalized
      .split(/\n{2,}|\n/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p class="assistant-text-p">${escapeHtml(part)}</p>`)
      .join("");
  }

  function renderMessageHTML(message, contract, dataLayer) {
    const isUser = message.role === "user";
    const time = message.time || "";

    if (!isUser && message.structured) {
      return `
        <div class="message-row assistant structured" data-message-id="${escapeHtml(message.messageId || "")}">
          <div class="assistant-avatar" aria-hidden="true">AI</div>
          <div class="assistant-content">
            <span class="assistant-name">AI 催收助手</span>
            <div class="message-panel">${renderStructuredPanel(message.structured, message, contract, dataLayer)}</div>
            ${renderFeedbackButtons(message)}
            ${time ? `<span class="message-time">${time}</span>` : ""}
          </div>
        </div>`;
    }

    if (!isUser && message.text) {
      return `
        <div class="message-row assistant conversation" data-message-id="${escapeHtml(message.messageId || "")}">
          <div class="assistant-avatar" aria-hidden="true">AI</div>
          <div class="assistant-content">
            <span class="assistant-name">AI 催收助手</span>
            ${message.apiWarning ? `<div class="response-alert response-alert--inline">${escapeHtml(message.apiWarning)}</div>` : ""}
            <div class="message-bubble message-bubble--conversation">
              <div class="message-content">${formatAssistantText(message.text)}</div>
            </div>
            ${renderFeedbackButtons(message)}
            ${time ? `<span class="message-time">${time}</span>` : ""}
          </div>
        </div>`;
    }

    return `
      <div class="message-row ${message.role}">
        <div class="message-bubble">
          <div class="message-content">${escapeHtml(message.text)}</div>
          ${time ? `<span class="message-time">${time}</span>` : ""}
        </div>
      </div>`;
  }

  function scrollChatToBottom() {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function renderChat(dataLayer) {
    const contract = dataLayer.getSelected();

    if (!contract) {
      els.chatMessages.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48"><path fill="currentColor" opacity="0.35" d="M8 10h32v24H8V10zm4 4v16h24V14H12zm6 20h12v3H18v-3z"/></svg>
          </div>
          <p class="chat-empty-title">选择逾期合同</p>
          <p class="chat-empty-hint">从左侧列表选择一笔合同，开始智能催收分析</p>
        </div>`;
      return;
    }

    if (chatHistory.length === 0) {
      els.chatMessages.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48"><path fill="currentColor" opacity="0.35" d="M24 4C12.95 4 4 11.85 4 21.5c0 5.2 2.55 9.85 6.55 12.95L8 40l6.85-2.45C16.75 38.5 20.3 39 24 39c11.05 0 20-7.85 20-17.5S35.05 4 24 4zm-8 15h16v3H16v-3zm0 7h11v3H16v-3z"/></svg>
          </div>
          <p class="chat-empty-title">已选中 <strong>${escapeHtml(contract.contractId)}</strong></p>
          <p class="chat-empty-sub">${escapeHtml(contract.customerName)} · ${escapeHtml(dataLayer.formatAmount(contract.loanAmount))}</p>
          <p class="chat-empty-hint">首次提问将展示合同分析信息卡，后续对话为自然语言交互</p>
        </div>`;
      return;
    }

    els.chatMessages.innerHTML = chatHistory.map((msg) => renderMessageHTML(msg, contract, dataLayer)).join("");
    scrollChatToBottom();
  }

  function updateActiveContractBar(dataLayer) {
    renderContractSummary(dataLayer);
  }

  function refresh(dataLayer) {
    renderContractSummary(dataLayer);
    renderContractList(dataLayer);
    renderChat(dataLayer);
    updateAdoptionMetrics();
    els.clearChatBtn.disabled = chatHistory.length === 0;
  }

  function clearChat(dataLayer) {
    chatHistory = [];
    refresh(dataLayer);
  }

  function selectContract(contractId, dataLayer) {
    if (!dataLayer.select(contractId)) return;
    chatHistory = [];
    window.selectedContract = dataLayer.getSelected();
    refresh(dataLayer);
  }

  function showTyping() {
    const empty = els.chatMessages.querySelector(".chat-empty");
    if (empty) empty.remove();

    const row = document.createElement("div");
    row.className = "message-row assistant typing";
    row.id = "typingIndicator";
    row.innerHTML = `
      <div class="assistant-avatar" aria-hidden="true">AI</div>
      <div class="assistant-content">
        <div class="message-bubble">
          <div class="message-content"><span class="typing-dots"><span></span><span></span><span></span></span></div>
        </div>
      </div>`;
    els.chatMessages.appendChild(row);
    scrollChatToBottom();
  }

  function hideTyping() {
    document.getElementById("typingIndicator")?.remove();
  }

  function appendMessages(userText, assistantPromise, dataLayer) {
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    chatHistory.push({ role: "user", text: userText, time });
    renderChat(dataLayer);
    showTyping();
    els.sendBtn.disabled = true;

    Promise.resolve(assistantPromise)
      .then((assistantResult) => {
        hideTyping();
        const contractId = dataLayer.getSelected()?.contractId;
        if (assistantResult.ok && assistantResult.structured) {
          chatHistory.push(
            buildAssistantMessage(
              {
                structured: assistantResult.structured,
                time,
                source: assistantResult.source,
                apiWarning: assistantResult.apiWarning,
              },
              contractId
            )
          );
        } else if (assistantResult.ok && assistantResult.text) {
          chatHistory.push(
            buildAssistantMessage(
              {
                text: assistantResult.text,
                time,
                source: assistantResult.source,
                apiWarning: assistantResult.apiWarning,
              },
              contractId
            )
          );
        } else {
          chatHistory.push(
            buildAssistantMessage(
              {
                text: assistantResult.message || "处理失败",
                time,
              },
              contractId
            )
          );
        }
        refresh(dataLayer);
        els.chatInput.focus();
      })
      .catch((err) => {
        hideTyping();
        chatHistory.push(
          buildAssistantMessage(
            {
              text: `请求失败：${err.message}`,
              time,
            },
            dataLayer.getSelected()?.contractId
          )
        );
        refresh(dataLayer);
        els.chatInput.focus();
      })
      .finally(() => {
        els.sendBtn.disabled = false;
      });
  }

  function populateLongCatSettingsForm() {
    const cfg = LongCatConfig.load();
    els.longcatEnabled.checked = cfg.enabled;
    els.longcatApiKey.value = cfg.apiKey || "";
    els.longcatModel.value = LongCatConfig.MODEL;
    els.longcatUseProxy.checked = cfg.useProxy !== false;
    els.longcatBaseUrl.value =
      cfg.baseUrl || (cfg.useProxy !== false ? LongCatConfig.PROXY_BASE : LongCatConfig.DIRECT_BASE);
  }

  function openLongCatSettings() {
    populateLongCatSettingsForm();
    els.longcatSettingsDialog.showModal();
  }

  function saveLongCatSettings(e) {
    e.preventDefault();
    const useProxy = els.longcatUseProxy.checked;
    LongCatConfig.save({
      enabled: els.longcatEnabled.checked,
      apiKey: els.longcatApiKey.value.trim(),
      model: LongCatConfig.MODEL,
      useProxy,
      baseUrl: (
        els.longcatBaseUrl.value.trim() ||
        (useProxy ? LongCatConfig.PROXY_BASE : LongCatConfig.DIRECT_BASE)
      ).replace(/\/$/, ""),
    });
    els.longcatSettingsDialog.close();
    updateAiModeBadge();
  }

  function updateAiModeBadge() {
    if (!els.aiModeBadge) return;
    if (LongCatConfig.isConfigured()) {
      els.aiModeBadge.hidden = false;
      els.aiModeBadge.textContent = "LongCat";
      els.aiModeBadge.className = "ai-mode-badge ai-mode-longcat";
    } else {
      els.aiModeBadge.hidden = false;
      els.aiModeBadge.textContent = "本地规则";
      els.aiModeBadge.className = "ai-mode-badge ai-mode-local";
    }
  }

  function bindLongCatSettings() {
    els.longcatSettingsBtn?.addEventListener("click", openLongCatSettings);
    els.longcatSettingsCancel?.addEventListener("click", () => els.longcatSettingsDialog.close());
    els.longcatSettingsForm?.addEventListener("submit", saveLongCatSettings);
    els.longcatUseProxy?.addEventListener("change", () => {
      if (els.longcatUseProxy.checked && !els.longcatBaseUrl.value.trim()) {
        els.longcatBaseUrl.value = LongCatConfig.PROXY_BASE;
      }
    });
  }

  function showToast(text) {
    const existing = document.querySelector(".ui-toast");
    existing?.remove();
    const toast = document.createElement("div");
    toast.className = "ui-toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("ui-toast--visible"));
    setTimeout(() => {
      toast.classList.remove("ui-toast--visible");
      setTimeout(() => toast.remove(), 200);
    }, 2200);
  }

  function handlePanelAction(e) {
    const feedbackBtn = e.target.closest(".btn-feedback");
    if (feedbackBtn) {
      const container = feedbackBtn.closest(".message-feedback");
      const messageId = container?.dataset.messageId;
      const feedback = feedbackBtn.dataset.feedback;
      if (messageId && (feedback === "adopted" || feedback === "not_adopted")) {
        applyFeedbackToMessage(messageId, feedback);
        updateFeedbackButtonsInDom(container, feedback);
      }
      return;
    }

    const copyBtn = e.target.closest(".btn-copy-script");
    if (copyBtn) {
      const paragraphs = copyBtn.closest(".script-box")?.querySelectorAll(".script-quote-text");
      const text = paragraphs?.length
        ? Array.from(paragraphs)
            .map((p) => p.textContent.trim())
            .join("\n")
        : "";
      navigator.clipboard?.writeText(text).then(
        () => showToast("话术已复制到剪贴板"),
        () => showToast("复制失败，请手动选择文本")
      );
    }
  }

  function bindEvents(dataLayer) {
    els.chatMessages.addEventListener("click", handlePanelAction);

    els.contractList.addEventListener("click", (e) => {
      const card = e.target.closest(".contract-card");
      if (card?.dataset.id) selectContract(card.dataset.id, dataLayer);
    });

    els.contractList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".contract-card");
      if (card?.dataset.id) {
        e.preventDefault();
        selectContract(card.dataset.id, dataLayer);
      }
    });

    els.searchInput.addEventListener("input", () => renderContractList(dataLayer));
    els.riskFilter?.addEventListener("change", () => renderContractList(dataLayer));
    els.sortOrder?.addEventListener("change", () => renderContractList(dataLayer));

    els.quickPrompts?.addEventListener("click", (e) => {
      const btn = e.target.closest(".quick-prompt");
      if (!btn?.dataset.prompt) return;
      els.chatInput.value = btn.dataset.prompt;
      els.chatInput.focus();
      els.chatInput.style.height = "auto";
      els.chatInput.style.height = `${Math.min(els.chatInput.scrollHeight, 120)}px`;
    });

    els.chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = els.chatInput.value.trim();
      if (!text || !onSendMessage || els.sendBtn.disabled) return;
      els.chatInput.value = "";
      els.chatInput.style.height = "auto";
      onSendMessage(text);
    });

    els.clearChatBtn.addEventListener("click", () => clearChat(dataLayer));

    els.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        els.chatForm.requestSubmit();
      }
    });

    els.chatInput.addEventListener("input", () => {
      els.chatInput.style.height = "auto";
      els.chatInput.style.height = `${Math.min(els.chatInput.scrollHeight, 120)}px`;
    });
  }

  function init(dataLayer, sendHandler) {
    cacheElements();
    FeedbackStore.load();
    onSendMessage = sendHandler;
    bindEvents(dataLayer);
    bindLongCatSettings();
    updateAiModeBadge();
    updateAdoptionMetrics();
  }

  function setLoadStatus(text, isError = false) {
    if (!els.loadStatus) return;
    els.loadStatus.textContent = text;
    els.loadStatus.classList.toggle("load-error", isError);
  }

  return {
    init,
    refresh,
    appendMessages,
    setLoadStatus,
    updateAiModeBadge,
    getChatHistory: () => chatHistory,
  };
})();
