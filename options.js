const form = document.querySelector("#settings-form");
const baseUrlInput = document.querySelector("#base-url");
const apiKeyInput = document.querySelector("#api-key");
const modelInput = document.querySelector("#model");
const languageInput = document.querySelector("#language");
const statusEl = document.querySelector("#status");
const testButton = document.querySelector("#test-connection");

const I18N = {
  "zh-CN": {
    title: "AI Prompt 设置",
    optionsTitle: "AI Image Prompt Extractor 设置",
    description: "填写自己的 OpenAI-compatible 接口。保存后，刷新网页并点击图片旁边的 Prompt 按钮。",
    optionsDescription: "填写你自己的 OpenAI-compatible 接口配置。API Key 会保存在本地 Chrome 扩展存储中，只会发送到你配置的 Base URL。",
    baseUrlLabel: "Base URL",
    baseUrlHint: "填 API 根路径，不要填管理站首页；通常是 https://域名/v1。",
    apiKeyLabel: "API Key",
    apiKeyHint: "仅保存在本地扩展存储中。",
    modelLabel: "Model",
    modelHint: "请选择支持图片输入的视觉模型。",
    modelPlaceholder: "支持图片输入的模型名",
    optionsModelPlaceholder: "gpt-4o / gpt-4.1 / 视觉模型名",
    languageLabel: "Language",
    languageChinese: "中文",
    languageEnglish: "English",
    languageHint: "选择设置页面的显示语言。",
    saveButton: "保存设置",
    testButton: "测试连接",
    requiredError: "请填写 Base URL、API Key 和 Model。",
    baseUrlError: "Base URL 格式不正确。",
    httpsWarning: "Base URL 建议使用 HTTPS，本地调试可使用 localhost。",
    saved: "设置已保存。刷新网页后即可使用图片旁边的 Prompt 按钮。",
    testing: "正在测试接口连通性…",
    testingButton: "测试中…",
    noBackground: "插件后台没有响应，请在 chrome://extensions 刷新插件后重试。",
    testFailed: "连接测试失败，但接口没有返回具体错误。",
    testSuccess: "连接成功。",
    testFailedNoDetail: "连接测试失败，但没有拿到具体错误。",
    loadFailed: "读取设置失败，请重新打开设置页。",
  },
  "en-US": {
    title: "AI Prompt Settings",
    optionsTitle: "AI Image Prompt Extractor Settings",
    description: "Enter your own OpenAI-compatible API settings. After saving, refresh the webpage and click the Prompt button beside an image.",
    optionsDescription: "Enter your own OpenAI-compatible API settings. Your API key is stored in local Chrome extension storage and sent only to your configured Base URL.",
    baseUrlLabel: "Base URL",
    baseUrlHint: "Enter the API root, not the admin homepage. Usually: https://domain.com/v1.",
    apiKeyLabel: "API Key",
    apiKeyHint: "Stored only in local extension storage.",
    modelLabel: "Model",
    modelHint: "Choose a vision-capable model that supports image input.",
    modelPlaceholder: "Vision-capable model name",
    optionsModelPlaceholder: "gpt-4o / gpt-4.1 / vision model name",
    languageLabel: "Language",
    languageChinese: "Chinese",
    languageEnglish: "English",
    languageHint: "Choose the settings UI language.",
    saveButton: "Save Settings",
    testButton: "Test Connection",
    requiredError: "Please fill in Base URL, API Key, and Model.",
    baseUrlError: "Base URL format is invalid.",
    httpsWarning: "Base URL should use HTTPS. localhost is allowed for local debugging.",
    saved: "Settings saved. Refresh the webpage to use the Prompt button beside images.",
    testing: "Testing API connection…",
    testingButton: "Testing…",
    noBackground: "The extension background did not respond. Refresh the extension in chrome://extensions and try again.",
    testFailed: "Connection test failed, but the API did not return a specific error.",
    testSuccess: "Connection successful.",
    testFailedNoDetail: "Connection test failed without a specific error.",
    loadFailed: "Failed to load settings. Please reopen the settings page.",
  },
};

function currentMessages() {
  return I18N[languageInput?.value || "zh-CN"] || I18N["zh-CN"];
}

function applyLanguage() {
  const messages = currentMessages();
  document.documentElement.lang = languageInput?.value || "zh-CN";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (messages[key]) {
      element.textContent = messages[key];
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (messages[key]) {
      element.placeholder = messages[key];
    }
  });
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = type;
}

function getFormSettings() {
  return {
    baseUrl: normalizeBaseUrl(baseUrlInput.value),
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim(),
    language: languageInput?.value || "zh-CN",
  };
}

function validateSettings({ baseUrl, apiKey, model }) {
  const messages = currentMessages();

  if (!baseUrl || !apiKey || !model) {
    return messages.requiredError;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    return messages.baseUrlError;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") {
    return messages.httpsWarning;
  }

  return "";
}

async function loadSettings() {
  const settings = await chrome.storage.local.get(["baseUrl", "apiKey", "model", "language"]);
  baseUrlInput.value = settings.baseUrl || "";
  apiKeyInput.value = settings.apiKey || "";
  modelInput.value = settings.model || "";
  if (languageInput) {
    languageInput.value = settings.language || "zh-CN";
  }
  applyLanguage();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { baseUrl, apiKey, model, language } = getFormSettings();
  const validationMessage = validateSettings({ baseUrl, apiKey, model });

  if (validationMessage) {
    setStatus(validationMessage, "error");
    return;
  }

  await chrome.storage.local.set({ baseUrl, apiKey, model, language });
  baseUrlInput.value = baseUrl;
  applyLanguage();
  setStatus(currentMessages().saved, "success");
});

testButton?.addEventListener("click", async () => {
  const settings = getFormSettings();
  const validationMessage = validateSettings(settings);

  if (validationMessage) {
    setStatus(validationMessage, "error");
    return;
  }

  const messages = currentMessages();
  testButton.disabled = true;
  const previousText = testButton.textContent;
  testButton.textContent = messages.testingButton;
  setStatus(messages.testing);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TEST_API_CONNECTION",
      payload: settings,
    });

    if (!response) {
      const runtimeMessage = chrome.runtime.lastError?.message;
      throw new Error(runtimeMessage ? `${messages.noBackground} ${runtimeMessage}` : messages.noBackground);
    }

    if (!response.ok) {
      throw new Error(response.error || messages.testFailed);
    }

    setStatus(response.result.message || messages.testSuccess, "success");
  } catch (error) {
    const runtimeMessage = chrome.runtime.lastError?.message;
    setStatus(error?.message || runtimeMessage || messages.testFailedNoDetail, "error");
  } finally {
    testButton.disabled = false;
    testButton.textContent = previousText;
  }
});

languageInput?.addEventListener("change", () => {
  applyLanguage();
});

applyLanguage();
loadSettings().catch(() => {
  setStatus(currentMessages().loadFailed, "error");
});
