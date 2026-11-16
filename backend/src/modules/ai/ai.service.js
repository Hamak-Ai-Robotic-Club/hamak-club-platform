const { SYSTEM_PROMPT } = require("./ai.prompts");
const { searchAvailableComponents, toolDefinitions } = require("./ai.tools");

// Any OpenAI-compatible Chat Completions endpoint works (OpenAI, Google Gemini's
// OpenAI-compatible endpoint, Groq, OpenRouter, ...). Keys stay on the server.
function providerConfig() {
  const apiKey = process.env.AI_API_KEY || "";
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL || "gpt-4o-mini",
  };
}

async function callProvider(config, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools: toolDefinitions,
        tool_choice: "auto",
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("AI provider error:", response.status, detail.slice(0, 300));
      const error = new Error("The assistant is temporarily unavailable.");
      error.statusCode = 503;
      throw error;
    }
    const data = await response.json();
    return data.choices?.[0]?.message || null;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeout = new Error("The assistant took too long to respond. Please try again.");
      timeout.statusCode = 504;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function formatFallbackReply(question, results) {
  if (!results.length) {
    return "لم أجد في المخزون الحالي قطعاً تطابق وصفك مباشرةً. جرّب وصف وظيفة القطعة (مثل: قياس مسافة، حرارة، تحكم بمحرك، واي فاي) أو تصفّح الكتالوج.";
  }
  const lines = results.map(
    (item) => `• ${item.name}${item.nameEn ? ` (${item.nameEn})` : ""} — المتاح الآن: ${item.availableQuantity}`,
  );
  return [
    "هذه القطع المتوفرة في مخزون النادي والمطابقة لوصفك (نتائج مباشرة من قاعدة البيانات):",
    ...lines,
    "",
    "التوصية استرشادية؛ راجع متطلبات فكرتك قبل إرسال الطلب من صفحة «طلب جديد».",
    "ملاحظة: المساعد الذكي الكامل غير مفعّل حالياً على الخادم، لذلك أعرض نتائج البحث فقط.",
  ].join("\n");
}

async function answer(prisma, history) {
  const config = providerConfig();
  const lastUserMessage = [...history].reverse().find((message) => message.role === "user");

  if (!config) {
    const results = await searchAvailableComponents(prisma, {
      keywords: [lastUserMessage?.content || ""],
      limit: 6,
    });
    return {
      reply: formatFallbackReply(lastUserMessage?.content, results),
      recommendations: results,
      mode: "inventory-search",
    };
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  const found = new Map();
  for (let round = 0; round < 4; round += 1) {
    const message = await callProvider(config, messages);
    if (!message) break;
    const toolCalls = message.tool_calls || [];
    if (!toolCalls.length) {
      const reply = (message.content || "").trim();
      const mentioned = [...found.values()].filter((item) => reply.includes(item.name));
      return {
        reply: reply || "لم أتمكن من صياغة رد، حاول إعادة صياغة السؤال.",
        recommendations: (mentioned.length ? mentioned : [...found.values()]).slice(0, 8),
        mode: "ai",
      };
    }
    messages.push({ role: "assistant", content: message.content || null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      let result;
      if (call.function?.name === "search_available_components") {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        const keywords = Array.isArray(args.keywords) ? args.keywords.map(String).slice(0, 12) : [];
        result = await searchAvailableComponents(prisma, { keywords, limit: Number(args.limit) || 8 });
        for (const item of result) found.set(item.componentId, item);
      } else {
        result = { error: "Unknown tool. Only read-only inventory search is available." };
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(
          Array.isArray(result)
            ? result.map(({ imageUrl, ...rest }) => rest)
            : result,
        ),
      });
    }
  }
  return {
    reply: "تعذّر إكمال الإجابة الآن، حاول مرة أخرى بسؤال أقصر.",
    recommendations: [...found.values()].slice(0, 8),
    mode: "ai",
  };
}

module.exports = { answer, providerConfig };
