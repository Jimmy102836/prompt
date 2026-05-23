# Privacy Policy for Prompt Extractor

Last updated: May 23, 2026

Prompt Extractor is a Chrome extension that helps users generate AI image prompts from images on webpages using their own OpenAI-compatible API settings.

## Data We Do Not Collect

Prompt Extractor does not collect, sell, share, or transmit user data to any server operated by the developer.

We do not collect:

- Personal information
- Browsing history
- API keys
- Images
- Generated prompts
- Analytics events
- Cookies
- Account information

## Local Storage

Prompt Extractor stores the following settings locally in Chrome extension storage on the user's own browser:

- Base URL
- API Key
- Model name
- Language preference

These settings are stored using `chrome.storage.local` and are used only to operate the extension.

## API Key Handling

The user's API key is provided by the user and stored locally in the browser.

The API key is:

- Not hardcoded in the extension
- Not sent to the developer
- Not visible to webpage content scripts
- Sent only to the Base URL configured by the user

## Image Processing

When the user clicks the Prompt button beside an image, Prompt Extractor may process the selected image in order to generate a prompt.

The extension may send one of the following to the user's configured OpenAI-compatible API endpoint:

- A data URL representation of the selected image, or
- The original image URL if data URL conversion is not available

This request is sent only after the user clicks the Prompt button. Prompt Extractor does not automatically send all webpage images to any API.

## Third-Party Services

Prompt Extractor works with the OpenAI-compatible API endpoint configured by the user. The developer does not control that endpoint.

Users are responsible for choosing an API provider they trust and reviewing that provider's privacy policy and terms.

## Website Access

Prompt Extractor runs on webpages so it can detect image elements and display a Prompt button beside them. This access is used only for the extension's image prompt generation feature.

The content script does not receive or read the user's API key.

## Data Sharing

Prompt Extractor does not sell, share, or transfer user data to third parties.

The only outbound request involving user-provided API credentials is the model request sent to the user's configured Base URL when the user uses the extension.

## Contact

For questions about this privacy policy, please open an issue at:

https://github.com/Jimmy102836/prompt/issues
