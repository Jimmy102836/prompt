<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="Prompt Extractor logo">
</p>

<h1 align="center">Prompt Extractor</h1>

<p align="center">
  Generate structured AI image prompts from webpage images using your own OpenAI-compatible API.
</p>

<p align="center">
  <a href="README.zh-CN.md"><strong>中文 README</strong></a>
</p>

Prompt Extractor is a Chrome extension that helps you generate AI image prompts directly from images on webpages. It adds a small floating **Prompt** button beside eligible images, sends the selected image to your own OpenAI-compatible vision model, and displays structured prompt results in three tabs.

## Features

- Floating **Prompt** button beside webpage images
- Bring-your-own OpenAI-compatible API settings
  - Base URL
  - API Key
  - Model name
- Toolbar popup settings panel
- Connection test button
- Bilingual settings UI: Chinese / English
- Result panel with three tabs:
  - JSON visual style data
  - Chinese prompt
  - English prompt
- One-click copy for each result tab
- Apple-inspired glass UI
- API key is stored locally in Chrome extension storage

## How it works

1. The content script scans webpages for visible image elements.
2. A floating **Prompt** button is attached to each eligible image.
3. When clicked, the background service worker reads your local API settings.
4. The extension tries to convert the image to a data URL, then falls back to the original image URL if needed.
5. Your configured OpenAI-compatible vision model analyzes the image and returns prompt data.
6. The result is displayed in a glass-style popover near the image.

## Installation

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.
6. Pin the extension from the Chrome toolbar if desired.

## Setup

Click the extension icon and fill in:

- **Base URL**: your OpenAI-compatible API root, usually ending with `/v1`
  - Example: `https://api.example.com/v1`
  - Do not enter an admin homepage or website frontend URL.
- **API Key**: your own API key.
- **Model**: a vision-capable model name.
- **Language**: the settings UI language.

Then click **Save Settings**.

You can click **Test Connection** to verify that the API endpoint and model can return a normal text response.

## Usage

1. Open any webpage with images.
2. Refresh the page after installing or updating the extension.
3. Click the floating **Prompt** button beside an image.
4. Wait for the model response.
5. Copy the result from the JSON, Chinese prompt, or English prompt tab.

## API compatibility

The extension calls an OpenAI-compatible Chat Completions endpoint:

```text
POST {Base URL}/chat/completions
```

If the Base URL is a bare domain, the extension can also try:

```text
POST {Base URL}/v1/chat/completions
```

Your model must support image input. Text-only models may pass the connection test but fail when generating prompts from images.

## Privacy and security

- Your API key is not hardcoded in this project.
- Your API key is stored in `chrome.storage.local` on your own browser.
- The content script does not receive or read your API key.
- The API key is sent only to your configured Base URL.
- Do not share your API key with untrusted pages or people.

## Troubleshooting

### The extension says the background script did not respond

Reload the extension in `chrome://extensions`, then refresh the webpage before clicking **Prompt** again.

### Test Connection passes but image prompt fails

The test request is text-only. Image prompt generation requires a vision-capable model and an API gateway that supports multimodal image input.

### The response looks like website configuration JSON

Your Base URL is probably pointing to a website frontend or admin configuration endpoint instead of the OpenAI-compatible API root. Use the API root, usually similar to:

```text
https://your-domain.com/v1
```

### Blob images are not supported

Some webpages use `blob:` image URLs. The current version focuses on normal image URLs and data URLs.

## Roadmap

- Video prompt extraction
- CSS background image support
- Better provider presets
- Optional upload pipeline for protected media
- More result templates

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Jimmy102836/prompt&type=Date)](https://www.star-history.com/#Jimmy102836/prompt&Date)

## License

This project is licensed under the Apache License 2.0.

Apache 2.0 allows personal use, modification, distribution, and commercial use without requiring users to pay you. Users must keep the license and copyright notices. If you want commercial use to require payment, use a custom commercial license instead of Apache 2.0.
