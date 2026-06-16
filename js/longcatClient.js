/**
 * LongCat API client — optimized for LongCat-2.0-Preview (agentic model).
 * @see https://longcat.chat/platform/docs/
 */
const LongCatClient = (() => {
  const MAX_RETRIES = 2;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function extractJson(text) {
    const raw = String(text || "").trim();
    if (!raw) throw new Error("LongCat 返回内容为空");

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;

    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }

    return JSON.parse(candidate);
  }

  function normalizeApiResponse(data) {
    if (!data || typeof data !== "object") return data;

    if (data.code != null && data.code !== 0 && data.code !== 200 && !data.choices) {
      throw new Error(`LongCat API: ${data.message || data.msg || data.code}`);
    }

    if (data.choices?.length) return data;
    if (data.data?.choices?.length) return data.data;
    if (data.result?.choices?.length) return data.result;
    if (data.content?.length) return data;

    return data;
  }

  function collectText(value) {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (typeof part === "string") return part;
          return part?.text || part?.content || "";
        })
        .join("")
        .trim();
    }
    if (typeof value === "object") return collectText(value.text || value.content);
    return String(value).trim();
  }

  /** LongCat-2.0-Preview: content 可能为空，文本或在 reasoning_content / tool_calls */
  function extractMessageContent(data) {
    const normalized = normalizeApiResponse(data);
    if (!normalized || typeof normalized !== "object") return "";

    const choice = normalized.choices?.[0];
    if (choice) {
      const msg = choice.message || choice.delta || {};
      const parts = [
        collectText(msg.content),
        collectText(msg.reasoning_content),
        collectText(msg.reasoningContent),
        collectText(choice.text),
      ];

      if (msg.tool_calls?.length) {
        for (const call of msg.tool_calls) {
          parts.push(collectText(call?.function?.arguments));
          parts.push(collectText(call?.function?.name));
        }
      }

      const merged = parts.filter(Boolean).join("\n").trim();
      if (merged) return merged;
    }

    const anthropicText = normalized.content?.map((b) => b.text).join("");
    if (anthropicText?.trim()) return anthropicText.trim();

    if (normalized.output_text) return String(normalized.output_text).trim();
    if (normalized.result && typeof normalized.result === "string") {
      return normalized.result.trim();
    }

    return "";
  }

  function parseSsePayload(rawText) {
    let contentParts = "";
    let reasoningParts = "";

    for (const line of rawText.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices?.[0]?.delta || {};
        contentParts += delta.content || "";
        reasoningParts += delta.reasoning_content || delta.reasoningContent || "";
      } catch {
        /* ignore malformed chunks */
      }
    }

    return (contentParts.trim() || reasoningParts.trim() || `${contentParts}${reasoningParts}`.trim());
  }

  function describeEmptyResponse(data, rawText) {
    const choice = data?.choices?.[0];
    const reason = choice?.finish_reason || "unknown";
    const usage = data?.usage
      ? `tokens: ${data.usage.completion_tokens}/${data.usage.total_tokens}`
      : "";
    const preview = rawText ? rawText.slice(0, 200).replace(/\s+/g, " ") : "empty body";
    return `LongCat 返回内容为空 (finish_reason: ${reason}${usage ? ", " + usage : ""}, body: ${preview})`;
  }

  async function postJson(url, headers, body) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const rawText = await res.text();

    if (rawText.includes("data:") && rawText.includes("[DONE]")) {
      const streamed = parseSsePayload(rawText);
      if (streamed) return { ok: res.ok, status: res.status, data: { streamed }, rawText, isStream: true };
    }

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(`LongCat 返回非 JSON: ${rawText.slice(0, 160)}`);
    }

    if (!res.ok) {
      const msg = data.error?.message || data.message || res.statusText || "请求失败";
      throw new Error(`LongCat API ${res.status}: ${msg}`);
    }

    return { ok: true, status: res.status, data, rawText, isStream: false };
  }

  function buildRequestBody(messages, cfg, options, stream) {
    return {
      model: LongCatConfig.getModel(),
      messages,
      max_tokens: options.maxTokens ?? cfg.maxTokens,
      temperature: options.temperature ?? cfg.temperature,
      stream,
    };
  }

  async function chatCompletionOpenAI(messages, options = {}) {
    const cfg = LongCatConfig.load();
    const url = LongCatConfig.getChatCompletionsUrl();
    const headers = { "Content-Type": "application/json" };
    const auth = LongCatConfig.getAuthHeader();
    if (auth) headers.Authorization = auth;

    const attempts = [
      { stream: true, label: "stream" },
      { stream: false, label: "non-stream" },
    ];

    let lastError = null;

    for (const mode of attempts) {
      if (options.stream === false && mode.stream) continue;
      if (options.stream === true && !mode.stream) continue;

      for (let retry = 0; retry <= MAX_RETRIES; retry++) {
        try {
          const body = buildRequestBody(messages, cfg, options, mode.stream);
          const result = await postJson(url, headers, body);
          const content = result.isStream
            ? result.data.streamed
            : extractMessageContent(result.data);

          if (content) return content;

          throw new Error(describeEmptyResponse(result.data, result.rawText));
        } catch (err) {
          lastError = err;
          const msg = String(err.message || "");
          if (retry < MAX_RETRIES && /429|fetch|network|为空/i.test(msg)) {
            await sleep(1000 * (retry + 1));
            continue;
          }
          break;
        }
      }
    }

    throw lastError || new Error("LongCat OpenAI 请求失败");
  }

  async function chatCompletionAnthropic(messages, options = {}) {
    const cfg = LongCatConfig.load();
    const url = LongCatConfig.getAnthropicMessagesUrl();
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    const auth = LongCatConfig.getAuthHeader();
    if (auth) headers.Authorization = auth;

    const system = messages.find((m) => m.role === "system")?.content || "";
    const userMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

    const body = {
      model: LongCatConfig.getModel(),
      max_tokens: options.maxTokens ?? cfg.maxTokens,
      system,
      messages: userMessages,
    };

    const result = await postJson(url, headers, body);
    const content = extractMessageContent(result.data);
    if (!content) {
      throw new Error(describeEmptyResponse(result.data, result.rawText));
    }
    return content;
  }

  async function chatCompletion(messages, options = {}) {
    const errors = [];

    for (const fn of [
      () => chatCompletionOpenAI(messages, options),
      () => chatCompletionAnthropic(messages, options),
    ]) {
      try {
        return await fn();
      } catch (err) {
        errors.push(err.message);
      }
    }

    throw new Error(errors[errors.length - 1] || "LongCat 请求失败");
  }

  function buildContractContext(contract, dataLayer) {
    const p = contract.customerProfile;
    return [
      `合同 ${contract.contractId}，客户 ${contract.customerName}`,
      `逾期 ${contract.overdueDays} 天，逾期金额 ${dataLayer.formatAmount(dataLayer.getOverdueAmount(contract))}，贷款 ${dataLayer.formatAmount(contract.loanAmount)}，风险分 ${contract.riskScore}`,
      `客户：${p.gender}${p.age}岁，${p.occupation}，${p.city}，还款意愿${p.repaymentWillingness}，投诉倾向${p.complaintTendency}`,
      contract.overdueReason?.name
        ? `逾期原因：${contract.overdueReason.name}（${contract.overdueReason.code}）`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function structuredToHistorySummary(structured) {
    if (!structured) return "【已完成首轮分析】";
    const action = structured.nextStep || ActionCategoryPicker.getNextStep(structured.recommendedActionCategory);
    return `【首轮分析摘要】规则 ${structured.ruleId}，风险分 ${structured.finalRiskScore}，建议行动：${action}`;
  }

  function chatHistoryToMessages(chatHistory) {
    const messages = [];
    for (const msg of chatHistory) {
      if (msg.role === "user" && msg.text) {
        messages.push({ role: "user", content: msg.text });
      } else if (msg.role === "assistant") {
        if (msg.structured) {
          messages.push({ role: "assistant", content: structuredToHistorySummary(msg.structured) });
        } else if (msg.text) {
          messages.push({ role: "assistant", content: msg.text });
        }
      }
    }
    return messages;
  }

  function buildConversationPrompt(userText, contract, dataLayer, chatHistory, latestBaseline) {
    const historyMessages = chatHistoryToMessages(chatHistory);

    return [
      {
        role: "system",
        content: `你是银行贷款贷后智能催收助手（LongCat-2.0-Preview）。
第一轮对话已展示合同分析信息卡；当前为后续跟进对话。
请结合合同信息与对话历史，用自然、简洁的中文回答催收员（2-5句为宜）。
要求：直接输出正文，不要 JSON，不要重复完整信息卡结构，不要调用工具。
语气专业、合规、温和，可引用具体合同数据。`,
      },
      ...historyMessages,
      {
        role: "user",
        content: [
          buildContractContext(contract, dataLayer),
          latestBaseline?.actionLabel ? `本轮识别行动类别：${latestBaseline.actionLabel}` : null,
          `催收员追问：${userText}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
  }

  function buildEnhancePrompt(userText, contract, baseline, dataLayer) {
    return [
      {
        role: "system",
        content: `你是银行贷款贷后催收助手（LongCat-2.0-Preview）。
任务：根据合同信息生成催收话术与下一步建议。
必须直接在回复正文中输出 JSON 字符串，禁止调用任何工具，禁止只输出思考过程而不给最终 JSON。
格式严格为：{"collectionScript":"2-4句中文话术","nextStep":"建议..."}`,
      },
      {
        role: "user",
        content: [
          `催收员问题：${userText}`,
          buildContractContext(contract, dataLayer),
          baseline.overdueReason?.name && !contract.overdueReason?.name
            ? `识别逾期原因：${baseline.overdueReason.name}`
            : null,
          baseline.reasonScripts
            ? `参考话术-开场：${baseline.reasonScripts.open}\n共情：${baseline.reasonScripts.empathy}\n引导：${baseline.reasonScripts.solution}`
            : null,
          `当前行动类别：${baseline.actionLabel}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
  }

  function parseEnhancement(content, baseline) {
    try {
      const parsed = extractJson(content);
      const script = parsed.collectionScript || parsed.collection_script || parsed.script;
      const nextStep = parsed.nextStep || parsed.next_step;

      if (script && nextStep) {
        return {
          collectionScript: String(script).trim(),
          nextStep: String(nextStep).trim(),
        };
      }
    } catch {
      /* plain text fallback below */
    }

    const text = String(content || "").trim();
    if (text.length > 20) {
      return {
        collectionScript: text,
        nextStep: baseline.nextStep || ActionCategoryPicker.getNextStep(baseline.recommendedActionCategory),
      };
    }

    throw new Error("LongCat 返回 JSON 缺少 collectionScript 或 nextStep");
  }

  async function enhanceAnalysis(userText, contract, baseline, dataLayer) {
    const messages = buildEnhancePrompt(userText, contract, baseline, dataLayer);
    const content = await chatCompletion(messages, { temperature: 0.3, maxTokens: 2048 });
    return parseEnhancement(content, baseline);
  }

  function stripJsonFromConversation(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    if (raw.startsWith("{") && raw.includes("collectionScript")) {
      try {
        const parsed = extractJson(raw);
        const script = parsed.collectionScript || parsed.collection_script || parsed.script;
        const nextStep = parsed.nextStep || parsed.next_step;
        return [script, nextStep].filter(Boolean).join("\n\n").trim();
      } catch {
        /* use raw text */
      }
    }
    return raw;
  }

  async function chatConversation(userText, contract, dataLayer, chatHistory, latestBaseline) {
    const messages = buildConversationPrompt(
      userText,
      contract,
      dataLayer,
      chatHistory,
      latestBaseline
    );
    const content = await chatCompletion(messages, { temperature: 0.5, maxTokens: 1024 });
    const text = stripJsonFromConversation(content);
    if (!text || text.length < 4) {
      throw new Error("LongCat 对话返回内容为空");
    }
    return text;
  }

  return {
    chatCompletion,
    enhanceAnalysis,
    chatConversation,
    extractJson,
    extractMessageContent,
  };
})();
