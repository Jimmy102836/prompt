const BUTTON_CLASS = "chrometool-image-prompt-button";
const POPOVER_CLASS = "chrometool-image-prompt-popover";
const MIN_IMAGE_SIZE = 120;
const trackedImages = new WeakMap();
let activePopover = null;
let repositionFrame = 0;

function scanImages(root = document) {
  if (root instanceof HTMLImageElement) {
    attachButton(root);
    return;
  }

  root.querySelectorAll?.("img").forEach(attachButton);
}

function attachButton(img) {
  if (trackedImages.has(img) || !isEligibleImage(img)) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.textContent = "Prompt";
  button.title = "生成 AI 提示词";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleButtonClick(img, button);
  });

  document.documentElement.appendChild(button);
  trackedImages.set(img, button);
  positionButton(img, button);
}

function isEligibleImage(img) {
  const rect = img.getBoundingClientRect();
  const width = img.naturalWidth || rect.width;
  const height = img.naturalHeight || rect.height;
  const style = window.getComputedStyle(img);

  return Boolean(
    (img.currentSrc || img.src) &&
      width >= MIN_IMAGE_SIZE &&
      height >= MIN_IMAGE_SIZE &&
      rect.width >= 80 &&
      rect.height >= 80 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0
  );
}

function positionButton(img, button) {
  const rect = img.getBoundingClientRect();
  const visible = isEligibleImage(img) && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;

  if (!visible || !document.documentElement.contains(img)) {
    button.hidden = true;
    return;
  }

  button.hidden = false;
  button.style.top = `${Math.max(8, rect.top + window.scrollY + 8)}px`;
  button.style.left = `${Math.max(8, rect.left + window.scrollX + rect.width - button.offsetWidth - 8)}px`;
}

function repositionAllButtons() {
  if (repositionFrame) {
    return;
  }

  repositionFrame = window.requestAnimationFrame(() => {
    repositionFrame = 0;
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => {
      const img = findImageForButton(button);
      if (img) {
        positionButton(img, button);
      } else {
        button.remove();
      }
    });

    if (activePopover?.img && activePopover?.element) {
      positionPopover(activePopover.img, activePopover.element);
    }
  });
}

function findImageForButton(button) {
  for (const img of document.images) {
    if (trackedImages.get(img) === button) {
      return img;
    }
  }
  return null;
}

async function handleButtonClick(img, button) {
  closePopover();
  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = "生成中";

  const popover = createPopover("loading", "正在生成提示词…");
  document.documentElement.appendChild(popover);
  activePopover = { img, element: popover };
  positionPopover(img, popover);

  try {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      throw new Error("插件刚刚刷新过，请刷新当前网页后再点击 Prompt。");
    }

    const response = await chrome.runtime.sendMessage({
      type: "GENERATE_PROMPT_FOR_IMAGE",
      payload: {
        src: img.src,
        currentSrc: img.currentSrc,
        alt: img.alt,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        pageUrl: window.location.href,
        pageTitle: document.title,
      },
    });

    if (!response) {
      const runtimeMessage = chrome.runtime.lastError?.message;
      throw new Error(runtimeMessage ? `插件后台没有响应：${runtimeMessage}。请刷新当前网页后重试。` : "插件后台没有响应，请刷新当前网页后重试。");
    }

    if (!response.ok) {
      throw new Error(response.error || "生成失败。请检查 API 设置和模型是否支持图片输入。");
    }

    renderPopoverResult(popover, response.result.prompts || response.result.prompt);
  } catch (error) {
    renderPopoverError(popover, toDisplayErrorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = previousText;
  }
}

function toDisplayErrorMessage(error) {
  const message = error?.message || "";

  if (/Extension context invalidated|Cannot read properties|chrome\.runtime|sendMessage/i.test(message)) {
    return "插件刚刚刷新过，请刷新当前网页后再点击 Prompt。";
  }

  return message || "生成失败。请稍后重试。";
}

function createPopover(type, text) {
  const popover = document.createElement("section");
  popover.className = `${POPOVER_CLASS} ${POPOVER_CLASS}--${type}`;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chrometool-image-prompt-popover__close";
  closeButton.textContent = "×";
  closeButton.title = "关闭";
  closeButton.addEventListener("click", closePopover);

  const body = document.createElement("div");
  body.className = "chrometool-image-prompt-popover__body";
  body.textContent = text;

  popover.append(closeButton, body);
  return popover;
}

function renderPopoverResult(popover, prompts) {
  popover.className = `${POPOVER_CLASS} ${POPOVER_CLASS}--success`;
  const body = popover.querySelector(".chrometool-image-prompt-popover__body");
  body.textContent = "";

  const normalizedPrompts = normalizeResultPrompts(prompts);
  const tabs = [
    { key: "jsonPrompt", label: "JSON", value: normalizedPrompts.jsonPrompt },
    { key: "chinesePrompt", label: "中文提示词", value: normalizedPrompts.chinesePrompt },
    { key: "englishPrompt", label: "English Prompt", value: normalizedPrompts.englishPrompt },
  ];

  const tabList = document.createElement("div");
  tabList.className = "chrometool-image-prompt-tabs";

  const panel = document.createElement("div");
  panel.className = "chrometool-image-prompt-panel";

  tabs.forEach((tab, index) => {
    const tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.className = "chrometool-image-prompt-tab";
    tabButton.textContent = tab.label;
    tabButton.setAttribute("aria-selected", index === 0 ? "true" : "false");
    tabButton.addEventListener("click", () => {
      tabList.querySelectorAll(".chrometool-image-prompt-tab").forEach((button) => {
        button.setAttribute("aria-selected", button === tabButton ? "true" : "false");
      });
      renderPromptPanel(panel, tab.value);
    });
    tabList.append(tabButton);
  });

  renderPromptPanel(panel, tabs[0].value);
  body.append(tabList, panel);
}

function normalizeResultPrompts(prompts) {
  if (typeof prompts === "string") {
    return {
      jsonPrompt: JSON.stringify({ prompt: prompts }, null, 2),
      chinesePrompt: prompts,
      englishPrompt: prompts,
    };
  }

  return {
    jsonPrompt: prompts?.jsonPrompt || "{}",
    chinesePrompt: prompts?.chinesePrompt || prompts?.raw || "",
    englishPrompt: prompts?.englishPrompt || prompts?.raw || "",
  };
}

function renderPromptPanel(panel, value) {
  panel.textContent = "";

  const pre = document.createElement("pre");
  pre.textContent = value || "暂无内容";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "chrometool-image-prompt-popover__copy";
  copyButton.textContent = "复制当前 Tab";
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      copyButton.textContent = "已复制";
    } catch {
      copyButton.textContent = "复制失败";
    }

    window.setTimeout(() => {
      copyButton.textContent = "复制当前 Tab";
    }, 1200);
  });

  panel.append(pre, copyButton);
}

function renderPopoverError(popover, message) {
  popover.className = `${POPOVER_CLASS} ${POPOVER_CLASS}--error`;
  const body = popover.querySelector(".chrometool-image-prompt-popover__body");
  body.textContent = message;
}

function positionPopover(img, popover) {
  const rect = img.getBoundingClientRect();
  const top = rect.top + window.scrollY + 42;
  const preferredLeft = rect.left + window.scrollX + rect.width - popover.offsetWidth;
  const left = Math.max(8, Math.min(preferredLeft, window.scrollX + window.innerWidth - popover.offsetWidth - 8));

  popover.style.top = `${Math.max(8, top)}px`;
  popover.style.left = `${left}px`;
}

function closePopover() {
  activePopover?.element?.remove();
  activePopover = null;
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        scanImages(node);
      }
    });
  }
  repositionAllButtons();
});

scanImages();
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", scanImages, { once: true });
window.addEventListener("scroll", repositionAllButtons, { passive: true });
window.addEventListener("resize", repositionAllButtons);
window.setInterval(scanImages, 2500);
