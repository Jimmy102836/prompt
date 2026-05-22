const SETTINGS_KEYS = ["baseUrl", "apiKey", "model", "language"];
const API_TIMEOUT_MS = 60000;
const IMAGE_TIMEOUT_MS = 20000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GENERATE_PROMPT_FOR_IMAGE") {
    generatePromptForImage(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: toUserMessage(error) }));

    return true;
  }

  if (message?.type === "TEST_API_CONNECTION") {
    testApiConnection(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: toUserMessage(error) }));

    return true;
  }

  return false;
});

async function generatePromptForImage(payload) {
  const settings = normalizeApiSettings(await chrome.storage.local.get(SETTINGS_KEYS));
  validateApiSettings(settings, "请先在扩展设置页填写 Base URL、API Key 和 Model。");

  const imageUrl = resolveImageUrl(payload?.currentSrc || payload?.src || "", payload?.pageUrl || "");
  if (!imageUrl) {
    throw new Error("没有找到可用的图片地址。");
  }

  const preparedImageUrl = await imageUrlToDataUrl(imageUrl).catch(() => imageUrl);
  const response = await callVisionApi({ ...settings, imageUrls: [...new Set([preparedImageUrl, imageUrl])], metadata: payload });
  const promptText = extractPromptText(response);

  return {
    prompt: promptText,
    prompts: normalizePromptResult(promptText),
  };
}

async function testApiConnection(payload) {
  const settings = normalizeApiSettings(payload || {});
  validateApiSettings(settings, "请填写 Base URL、API Key 和 Model 后再测试。");

  const response = await callTextApi(settings);
  const text = extractPromptText(response);

  if (!text) {
    throw new Error("接口返回成功，但没有模型文本内容。请确认 Base URL 指向 OpenAI-compatible API，而不是站点首页或配置接口。");
  }

  return { message: "连接成功，接口和模型可以正常返回。" };
}

function normalizeApiSettings(settings) {
  return {
    baseUrl: normalizeBaseUrl(settings.baseUrl || ""),
    apiKey: (settings.apiKey || "").trim(),
    model: (settings.model || "").trim(),
    language: settings.language || "zh-CN",
  };
}

function validateApiSettings(settings, message) {
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new Error(message);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(settings.baseUrl);
  } catch {
    throw new Error("Base URL 格式不正确。");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") {
    throw new Error("Base URL 建议使用 HTTPS，本地调试可使用 localhost。");
  }
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function buildChatCompletionsEndpoints(baseUrl) {
  const endpoints = [`${baseUrl}/chat/completions`];

  try {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "") {
      url.pathname = "/v1/chat/completions";
      endpoints.push(url.href);
    }
  } catch {
  }

  return [...new Set(endpoints)];
}

function resolveImageUrl(value, pageUrl) {
  if (!value || value.startsWith("data:")) {
    return value;
  }

  if (value.startsWith("blob:")) {
    throw new Error("暂不支持 blob 图片地址，请换一张普通图片试试。");
  }

  try {
    return new URL(value, pageUrl || undefined).href;
  } catch {
    return "";
  }
}

async function imageUrlToDataUrl(imageUrl) {
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  const response = await fetchWithTimeout(imageUrl, {
    timeoutMs: IMAGE_TIMEOUT_MS,
    credentials: "include",
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`图片下载失败：HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("目标地址不是图片资源。");
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("图片转码失败。"));
    reader.readAsDataURL(blob);
  });
}

async function callVisionApi({ baseUrl, apiKey, model, imageUrls, metadata }) {
  const errors = [];

  for (const imageUrl of imageUrls) {
    for (const variant of ["openai", "flat"]) {
      try {
        const response = await callChatCompletions({
          baseUrl,
          apiKey,
          body: buildVisionRequestBody({ model, imageUrl, metadata, variant }),
        });

        extractPromptText(response);
        return response;
      } catch (error) {
        errors.push(`${variant}: ${toUserMessage(error)}`);
      }
    }
  }

  throw new Error(errors.join("；"));
}

function buildVisionRequestBody({ model, imageUrl, metadata, variant }) {
  const imageContent = variant === "flat"
    ? {
        type: "image_url",
        url: imageUrl,
      }
    : {
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      };

  return {
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildPromptInstruction(metadata),
          },
          imageContent,
        ],
      },
    ],
    max_tokens: 700,
  };
}

async function callTextApi({ baseUrl, apiKey, model }) {
  return callChatCompletions({
    baseUrl,
    apiKey,
    body: {
      model,
      messages: [
        {
          role: "user",
          content: "Reply with OK only.",
        },
      ],
    },
  });
}

async function callChatCompletions({ baseUrl, apiKey, body }) {
  const endpoints = buildChatCompletionsEndpoints(baseUrl);
  const errors = [];

  for (const endpoint of endpoints) {
    try {
      return await postChatCompletions({ endpoint, apiKey, body });
    } catch (error) {
      errors.push(`${endpoint}: ${toUserMessage(error)}`);
    }
  }

  throw new Error(errors.join("；"));
}

async function postChatCompletions({ endpoint, apiKey, body }) {
  try {
    return await postChatCompletionsOnce({ endpoint, apiKey, body });
  } catch (error) {
    if (!body.max_tokens || !isUnsupportedParameterError(error.message)) {
      throw error;
    }

    const { max_tokens: _maxTokens, temperature: _temperature, ...minimalBody } = body;
    return postChatCompletionsOnce({ endpoint, apiKey, body: minimalBody });
  }
}

async function postChatCompletionsOnce({ endpoint, apiKey, body }) {
  const response = await fetchWithTimeout(endpoint, {
    timeoutMs: API_TIMEOUT_MS,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
    throw new Error(`模型接口请求失败：${message}`);
  }

  assertLooksLikeModelResponse(data);
  return data;
}

function assertLooksLikeModelResponse(data) {
  if (looksLikeModelResponse(data)) {
    return;
  }

  if (looksLikeSub2ApiSiteConfig(data)) {
    throw new Error("当前 Base URL 返回的是 Sub2API 站点配置，不是模型接口。请填写真正的 OpenAI-compatible API 地址，通常类似 https://你的域名/v1。");
  }

  throw new Error(`接口返回成功，但不像模型响应。返回字段：${Object.keys(data || {}).slice(0, 8).join(", ") || "空响应"}`);
}

function looksLikeModelResponse(data) {
  return Boolean(
    data?.choices ||
      data?.output_text ||
      data?.output ||
      data?.response ||
      data?.result ||
      data?.jsonPrompt ||
      data?.chinesePrompt ||
      data?.englishPrompt ||
      data?.raw
  );
}

function looksLikeSub2ApiSiteConfig(data) {
  return Boolean(
    data &&
      typeof data === "object" &&
      ("registration_enabled" in data || "site_name" in data || "channel_monitor_enabled" in data) &&
      !looksLikeModelResponse(data)
  );
}

function isUnsupportedParameterError(message = "") {
  return /unsupported|not supported|unknown parameter|invalid.*parameter|max_tokens|temperature/i.test(message);
}

function buildPromptInstruction(metadata = {}) {
  const alt = metadata.alt ? `\nImage alt text: ${metadata.alt}` : "";
  const outputLanguage = metadata.language === "en-US" ? "English" : "Chinese";
  return `Analyze this webpage image and generate visual-style prompts for AI image generation.\n\nReturn strict JSON only. Do not use Markdown or code fences. The jsonPrompt object must be written entirely in English, including all keys and values. Use this format:\n{\n  "jsonPrompt": {\n    "visual_style": {\n      "overall_theme": "Overall visual theme and style direction",\n      "color_palette": {\n        "dominant_colors": ["#HEX (Color Name)", "#HEX (Color Name)"],\n        "accent_color": "#HEX (Accent Color Name)",\n        "color_description": "Color relationships, warm/cool contrast, saturation, and mood"\n      },\n      "typography": {\n        "chinese_font": {\n          "style": "Chinese font style, such as brush calligraphy, Songti, Heiti, handwritten, or None if no Chinese text is visible",\n          "content": "Recognized Chinese text, or None",\n          "orientation": "Horizontal, vertical, angled, or None",\n          "character": "Font personality and visual feeling"\n        },\n        "english_font": {\n          "style": "English font style, such as Serif, Sans-serif, Script, Display, or None if no English text is visible",\n          "content": "Recognized English text, or None",\n          "alignment": "Text alignment or None",\n          "character": "Font personality and visual feeling"\n        },\n        "color": "Text color, stroke, shadow, glow, or None if no text is visible"\n      },\n      "composition": {\n        "perspective": "Camera angle, framing, shot distance, and depth of field",\n        "elements_placement": {\n          "foreground": "Foreground elements, placement, and visual role",\n          "midground": "Midground elements, placement, and visual role",\n          "background": "Background elements, placement, and visual role"\n        },\n        "composition_style": "Composition method, such as centered, symmetrical, rule of thirds, diagonal framing, negative space, or layered depth"\n      },\n      "lighting_and_effects": {\n        "lighting": "Light direction, intensity, temperature, contrast, and cinematic or commercial feel",\n        "effects": ["Effect 1", "Effect 2", "Effect 3"],\n        "textures": "Materials, surface textures, grain, haze, reflections, or tactile details"\n      },\n      "emotional_tone": "Emotional keywords and atmosphere"\n    }\n  },\n  "chinesePrompt": "中文 AI 绘图提示词，细致描述主体、风格、构图、光线、颜色、材质和特效，可直接用于生成图片",\n  "englishPrompt": "Detailed English AI image generation prompt describing subject, style, composition, lighting, colors, materials, and effects"\n}\n\nRequirements: jsonPrompt must extract this image's visual style as English JSON structured data: colors, typography, composition, effects, materials, and emotional tone. The chinesePrompt field should be written in ${outputLanguage}. The englishPrompt field should always be written in English. Do not claim to know the original prompt; infer only from the visible image.${alt}`;
}

function extractPromptText(data) {
  const candidates = [
    data?.jsonPrompt || data?.chinesePrompt || data?.englishPrompt ? JSON.stringify(data) : "",
    parseRawResponse(data?.raw),
    data?.raw,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.message?.reasoning_content,
    data?.choices?.[0]?.delta?.content,
    data?.choices?.[0]?.text,
    data?.output_text,
    data?.output,
    data?.response,
    data?.result,
    data?.content,
    data?.message,
    data?.data?.choices?.[0]?.message?.content,
    data?.data?.choices?.[0]?.message?.reasoning_content,
    data?.data?.output_text,
    data?.data?.output,
  ];

  for (const candidate of candidates) {
    const text = stringifyTextContent(candidate);
    if (text) {
      return text;
    }
  }

  throw new Error(`模型没有返回可显示的提示词内容。返回字段：${Object.keys(data || {}).join(", ") || "空响应"}`);
}

function parseRawResponse(raw) {
  if (typeof raw !== "string") {
    return "";
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const parsed = parsePromptJson(trimmed);
  if (parsed) {
    return stringifyTextContent(parsed.choices?.[0]?.message?.content)
      || stringifyTextContent(parsed.choices?.[0]?.text)
      || stringifyTextContent(parsed.output_text)
      || stringifyTextContent(parsed.output)
      || stringifyTextContent(parsed.response)
      || stringifyTextContent(parsed.result)
      || stringifyTextContent(parsed.content)
      || stringifyTextContent(parsed.message)
      || trimmed;
  }

  const sseText = parseSseText(trimmed);
  return sseText || trimmed;
}

function parseSseText(text) {
  if (!/^data:/m.test(text)) {
    return "";
  }

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        return stringifyStreamingTextContent(parsed.choices?.[0]?.delta?.content)
          || stringifyStreamingTextContent(parsed.choices?.[0]?.message?.content)
          || stringifyStreamingTextContent(parsed.choices?.[0]?.text)
          || stringifyStreamingTextContent(parsed.output_text)
          || stringifyStreamingTextContent(parsed.content)
          || stringifyStreamingTextContent(parsed.message)
          || "";
      } catch {
        return line;
      }
    })
    .filter(Boolean)
    .join("")
    .trim();
}

function normalizePromptResult(text) {
  const parsed = parsePromptJson(parseRawResponse(text) || text);

  if (parsed) {
    return {
      jsonPrompt: formatJsonPrompt(parsed.jsonPrompt ?? parsed.json ?? parsed.prompt_json ?? parsed),
      chinesePrompt: stringifyTextContent(parsed.chinesePrompt ?? parsed.chinese_prompt ?? parsed.zh ?? parsed.zhPrompt),
      englishPrompt: stringifyTextContent(parsed.englishPrompt ?? parsed.english_prompt ?? parsed.en ?? parsed.enPrompt),
      raw: text,
    };
  }

  return {
    jsonPrompt: buildFallbackJsonPrompt(text),
    chinesePrompt: extractSection(text, ["中文提示词", "Chinese Prompt", "中文", "zh"]) || text,
    englishPrompt: extractSection(text, ["English Prompt", "英文提示词", "英文", "en"]) || text,
    raw: text,
  };
}

function parsePromptJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(trimmed);
  } catch {
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function formatJsonPrompt(value) {
  if (!value) {
    return "{}";
  }

  if (typeof value === "string") {
    const parsed = parsePromptJson(value);
    return parsed ? JSON.stringify(parsed, null, 2) : value.trim();
  }

  return JSON.stringify(value, null, 2);
}

function buildFallbackJsonPrompt(text) {
  return JSON.stringify({ prompt: text }, null, 2);
}

function extractSection(text, labels) {
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escapedLabel}\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(?:中文提示词|English Prompt|英文提示词|关键词|JSON|Json|json)\\s*[:：]|$)`, "i");
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return "";
}

function stringifyStreamingTextContent(content) {
  if (typeof content === "string") {
    return content;
  }

  return stringifyTextContent(content);
}

function stringifyTextContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(stringifyTextContent)
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (content && typeof content === "object") {
    return stringifyTextContent(content.text || content.content || content.output_text || content.message);
  }

  return "";
}

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs || API_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function toUserMessage(error) {
  if (error?.name === "AbortError") {
    return "请求超时，请稍后重试或检查接口配置。";
  }

  return error?.message || "生成提示词失败。";
}
