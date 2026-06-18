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
      intelligencePanel: document.getElementById("intelligencePanel"),
      workspaceContext: document.getElementById("workspaceContext"),
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
          Useful
        </button>
        <button
          type="button"
          class="btn-feedback btn-feedback--not-adopted${notAdoptedActive}"
          data-feedback="not_adopted"
          aria-pressed="${message.feedback === "not_adopted"}"
          aria-label="Not adopted">
          Not useful
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

  function formatLastContactDisplay(contract) {
    if (contract.recentCommunication) return escapeHtml(contract.recentCommunication);
    const d = new Date();
    d.setDate(d.getDate() - Math.min(Math.max(contract.overdueDays - 7, 1), 45));
    return d.toLocaleDateString("zh-CN");
  }

  function renderContractCard(c, isActive, dataLayer) {
    const demoBadge = c.isDemo
      ? `<span class="rail-demo-tag">${escapeHtml(DemoContracts.getScenarioLabel(c.demoScenario))}</span>`
      : "";
    return `
      <article
        class="contract-card${isActive ? " active" : ""}${c.isDemo ? " contract-card--demo" : ""}"
        role="option"
        aria-selected="${isActive}"
        tabindex="0"
        data-id="${c.contractId}">
        <div class="rail-item-top">
          <span class="rail-item-name">${escapeHtml(c.customerName)}</span>
          <span class="rail-risk-dot risk-${c.riskLevel}" aria-label="${escapeHtml(dataLayer.getRiskLabel(c.riskLevel))}"></span>
        </div>
        <div class="rail-item-meta">
          <span class="rail-item-overdue risk-text-${c.riskLevel}">${c.overdueDays}d overdue</span>
          <span class="rail-item-score risk-text-${c.riskLevel}">${renderRiskScoreWithDelta(c.riskScore, c.lastRiskScoreDelta)}</span>
          <span class="rail-item-id">${escapeHtml(c.contractId)}</span>
          ${demoBadge}
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
      : `<div class="list-empty">No matching contracts</div>`;

    els.contractCount.textContent = String(dataLayer.getAll().length);
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

  function renderAntiCollectionIntel(assessment) {
    if (!assessment || assessment.level === 0) return "";

    const signals =
      assessment.matchedSignalLabels?.length > 0
        ? assessment.matchedSignalLabels.join(" · ")
        : "—";
    const behaviorLabel = assessment.isAntiCollectionBehavior
      ? "Anti-collection behavior"
      : "Legitimate rights protection";

    return `
      <div class="intel-insight">
        <div class="intel-insight-head">
          <span class="intel-insight-title">Anti-Collection</span>
          <span class="intel-badge ${assessment.riskCss}">${escapeHtml(assessment.risk)}</span>
        </div>
        <p class="intel-insight-detail">L${assessment.level} · ${escapeHtml(assessment.classificationZh)}</p>
        <p class="intel-insight-meta">${escapeHtml(behaviorLabel)} · ${assessment.confidenceScore}% confidence</p>
        <p class="intel-insight-detail">${escapeHtml(signals)}</p>
      </div>`;
  }

  function renderCollateralIntel(c, dataLayer) {
    const analysis = CollateralAnalyzer.analyze(c);
    if (!analysis) return "";

    const risk = analysis.collateralRisk;
    return `
      <div class="intel-insight">
        <div class="intel-insight-head">
          <span class="intel-insight-title">Collateral</span>
          <span class="intel-badge ${risk.cssClass}">${escapeHtml(risk.label)}</span>
        </div>
        <p class="intel-insight-detail">
          ${escapeHtml(c.vehicleBrand)} ${escapeHtml(c.vehicleModel)} · LTV
          <span class="collateral-ltv--${risk.level}">${escapeHtml(analysis.ltvPercent)}</span>
        </p>
        <p class="intel-insight-meta">${escapeHtml(analysis.strategyLabel)}</p>
        <p class="intel-insight-detail">${escapeHtml(analysis.strategyReason)}</p>
      </div>`;
  }

  function renderWorkspaceContext(dataLayer) {
    if (!els.workspaceContext) return;
    const c = dataLayer.getSelected();
    if (!c) {
      els.workspaceContext.innerHTML = `<p class="workspace-context-empty">Select a contract to begin</p>`;
      return;
    }

    const label = dataLayer.getRiskLabel(c.riskLevel);
    const demoBadge = c.isDemo
      ? `<span class="workspace-demo-badge">${escapeHtml(DemoContracts.getScenarioLabel(c.demoScenario))}</span>`
      : "";

    const overdueAmount = dataLayer.formatAmount(dataLayer.getOverdueAmount(c));

    els.workspaceContext.innerHTML = `
      <div class="workspace-context-active">
        <span class="workspace-customer">${escapeHtml(c.customerName)}</span>
        <div class="workspace-contract-meta">
          <span class="workspace-contract-id">${escapeHtml(c.contractId)}</span>
          <span class="workspace-risk-badge risk-${c.riskLevel}">${escapeHtml(label)}</span>
          <span>${c.overdueDays} days overdue</span>
          <span class="workspace-score risk-text-${c.riskLevel}">${renderRiskScoreWithDelta(c.riskScore, c.lastRiskScoreDelta)}</span>
          <span class="workspace-overdue-amount risk-text-${c.riskLevel}">Overdue ${escapeHtml(overdueAmount)}</span>
          ${demoBadge}
        </div>
      </div>`;
  }

  function renderIntelligencePanel(dataLayer) {
    if (!els.intelligencePanel) return;
    const c = dataLayer.getSelected();
    if (!c) {
      els.intelligencePanel.innerHTML = `
        <div class="intel-empty">
          <span class="intel-empty-label">Intelligence</span>
          <p>Select a contract to view context, insights, and recommended actions.</p>
        </div>`;
      return;
    }

    const p = c.customerProfile;
    const label = dataLayer.getRiskLabel(c.riskLevel);
    const actionPlan = ActionCategoryPicker.getNextStep(c.recommendedActionCategory);
    const antiCol = AntiCollectionDetector.analyzeContract(c);

    const overdueAmount = dataLayer.formatAmount(dataLayer.getOverdueAmount(c));

    els.intelligencePanel.innerHTML = `
      <div class="intel-panel">
        <section class="intel-section">
          <h3 class="intel-section-label">Information</h3>
          <dl class="intel-facts">
            <div class="intel-fact">
              <dt>Overdue days</dt>
              <dd class="risk-text-${c.riskLevel}">${c.overdueDays}</dd>
            </div>
            <div class="intel-fact">
              <dt>Overdue amount</dt>
              <dd class="risk-text-${c.riskLevel}">${overdueAmount}</dd>
            </div>
            <div class="intel-fact">
              <dt>Outstanding balance</dt>
              <dd>${dataLayer.formatAmount(c.outstandingBalance)}</dd>
            </div>
            <div class="intel-fact">
              <dt>Loan amount</dt>
              <dd>${dataLayer.formatAmount(c.loanAmount)}</dd>
            </div>
            <div class="intel-fact">
              <dt>Overdue reason</dt>
              <dd>${renderOverdueReason(c.overdueReason)}</dd>
            </div>
          </dl>
          <div class="intel-score-row">
            <span class="intel-score-label">Risk score · ${escapeHtml(label)}</span>
            <span class="intel-score-value risk-text-${c.riskLevel}">${renderRiskScoreWithDelta(c.riskScore, c.lastRiskScoreDelta)}</span>
          </div>
          <div class="intel-communication">
            <span class="intel-communication-label">Recent communication</span>
            <p class="intel-communication-text">${formatLastContactDisplay(c)}</p>
          </div>
        </section>

        <section class="intel-section">
          <h3 class="intel-section-label">客户特征</h3>
          <dl class="intel-facts">
            <div class="intel-fact">
              <dt>性别 / 年龄</dt>
              <dd>${escapeHtml(p.gender)} · ${p.age}岁</dd>
            </div>
            <div class="intel-fact">
              <dt>职业</dt>
              <dd>${escapeHtml(p.occupation)}</dd>
            </div>
            <div class="intel-fact">
              <dt>所在城市</dt>
              <dd>${escapeHtml(p.city)}</dd>
            </div>
            <div class="intel-fact">
              <dt>收入水平</dt>
              <dd>${escapeHtml(p.incomeLevel)}</dd>
            </div>
            <div class="intel-fact">
              <dt>婚姻状况</dt>
              <dd>${escapeHtml(p.maritalStatus)}</dd>
            </div>
            <div class="intel-fact">
              <dt>联系偏好</dt>
              <dd>${escapeHtml(p.contactPreference)}</dd>
            </div>
            <div class="intel-fact">
              <dt>还款意愿</dt>
              <dd>${renderTraitValue(p.repaymentWillingness, "will")}</dd>
            </div>
            <div class="intel-fact">
              <dt>投诉倾向</dt>
              <dd>${renderTraitValue(p.complaintTendency, "complaint")}</dd>
            </div>
            ${
              p.complaintSuggestedAction
                ? `<div class="intel-fact intel-fact--wide">
                    <dt>投诉应对建议</dt>
                    <dd class="intel-fact-note">${escapeHtml(p.complaintSuggestedAction)}</dd>
                  </div>`
                : ""
            }
          </dl>
        </section>

        <section class="intel-section">
          <h3 class="intel-section-label">Insight</h3>
          ${renderCollateralIntel(c, dataLayer)}
          ${renderAntiCollectionIntel(antiCol)}
        </section>

        <section class="intel-section intel-section--action">
          <h3 class="intel-section-label">Action</h3>
          <div class="intel-action-primary">${renderActionBadge(c.recommendedActionCategory)}</div>
          <p class="intel-action-plan">${escapeHtml(actionPlan)}</p>
        </section>
      </div>`;
  }

  function renderContractContext(dataLayer) {
    renderWorkspaceContext(dataLayer);
    renderIntelligencePanel(dataLayer);
  }

  function formatScoreDelta(delta) {
    if (delta === 0) return "0";
    return delta > 0 ? `+${delta}` : String(delta);
  }

  function renderRiskScoreWithDelta(score, delta) {
    const num = Number(score) || 0;
    if (delta == null || delta === 0) {
      return `<span class="risk-score-num">${num}</span>`;
    }
    const deltaClass = delta > 0 ? "score-delta--up" : "score-delta--down";
    return `<span class="risk-score-num">${num}</span><span class="score-delta ${deltaClass}">(${formatScoreDelta(delta)})</span>`;
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
      return `<p class="script-quote-text script-quote-text--empty">No script available. Review the recommended action in the intelligence panel.</p>`;
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
    const overdueReasonDisplay = display.overdueReason?.name
      ? `${display.overdueReason.name}${display.overdueReason.code ? ` (${display.overdueReason.code})` : ""}`
      : null;
    const executionPlan =
      cleanNextStep(display.nextStep) ||
      ActionCategoryPicker.getNextStep(display.recommendedActionCategory);
    const riskLevel = contract?.riskLevel || "yellow";
    const riskLabel = contract ? dataLayer.getRiskLabel(riskLevel) : "—";
    const scoreDelta = display.riskScoreDelta ?? 0;
    const scoreChip =
      scoreDelta !== 0
        ? `Score ${display.finalRiskScore} (${formatScoreDelta(scoreDelta)}) · ${riskLabel}`
        : `Score ${display.finalRiskScore} (${riskLabel})`;

    const insightChips = [
      display.ruleId ? `Rule ${display.ruleId}` : null,
      overdueReasonDisplay ? `Reason: ${overdueReasonDisplay}` : null,
      scoreChip,
      display.matchedKeywords?.length ? `Keywords: ${display.matchedKeywords.join(" · ")}` : null,
      display.antiCollection?.level
        ? `Anti-col L${display.antiCollection.level}`
        : null,
    ].filter(Boolean);

    const scriptBody = display.reasonScripts
      ? formatLayeredScripts(display.reasonScripts)
      : formatScriptParagraphs(display.collectionScript);

    return `
      <div class="copilot-response">
        ${message.apiWarning ? `<div class="response-alert">${escapeHtml(message.apiWarning)}</div>` : ""}
        <div class="copilot-action-block">
          <span class="copilot-action-label">Recommended Action</span>
          <div class="copilot-action-row">${renderActionBadge(display.recommendedActionCategory)}</div>
          <p class="copilot-action-plan">${escapeHtml(executionPlan)}</p>
        </div>
        <div class="copilot-script-block">
          <div class="copilot-script-head">
            <span class="copilot-script-title">Collection Script</span>
            <button type="button" class="btn-copy-script" aria-label="Copy script">Copy</button>
          </div>
          <div class="script-box-body">${scriptBody}</div>
        </div>
        <div class="copilot-insights">
          ${insightChips.map((chip) => `<span class="insight-chip">${escapeHtml(chip)}</span>`).join("")}
        </div>
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
            <span class="assistant-name">Collection Copilot</span>
            <div class="copilot-response-wrap">${renderStructuredPanel(message.structured, message, contract, dataLayer)}</div>
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
            <span class="assistant-name">Collection Copilot</span>
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
          <p class="chat-empty-title">Select a contract</p>
          <p class="chat-empty-hint">Choose a contract from the portfolio to start your collection analysis.</p>
        </div>`;
      return;
    }

    if (chatHistory.length === 0) {
      els.chatMessages.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48"><path fill="currentColor" opacity="0.35" d="M24 4C12.95 4 4 11.85 4 21.5c0 5.2 2.55 9.85 6.55 12.95L8 40l6.85-2.45C16.75 38.5 20.3 39 24 39c11.05 0 20-7.85 20-17.5S35.05 4 24 4zm-8 15h16v3H16v-3zm0 7h11v3H16v-3z"/></svg>
          </div>
          <p class="chat-empty-title">${escapeHtml(contract.customerName)}</p>
          <p class="chat-empty-sub">${escapeHtml(contract.contractId)} · Overdue ${escapeHtml(dataLayer.formatAmount(dataLayer.getOverdueAmount(contract)))}</p>
          <p class="chat-empty-hint">Ask a question to generate an action plan and collection script. Follow-up messages continue as natural conversation.</p>
        </div>`;
      return;
    }

    els.chatMessages.innerHTML = chatHistory.map((msg) => renderMessageHTML(msg, contract, dataLayer)).join("");
    scrollChatToBottom();
  }

  function updateActiveContractBar(dataLayer) {
    renderContractContext(dataLayer);
  }

  function refresh(dataLayer) {
    renderContractContext(dataLayer);
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
      const paragraphs =
        copyBtn.closest(".copilot-script-block")?.querySelectorAll(".script-quote-text") ||
        copyBtn.closest(".script-box")?.querySelectorAll(".script-quote-text");
      const text = paragraphs?.length
        ? Array.from(paragraphs)
            .map((p) => p.textContent.trim())
            .join("\n")
        : "";
      navigator.clipboard?.writeText(text).then(
        () => showToast("Script copied"),
        () => showToast("Copy failed")
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
      const btn = e.target.closest(".prompt-chip");
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
