<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="Prompt Extractor logo">
</p>

<h1 align="center">Prompt Extractor</h1>

<p align="center">
  一个 Chrome 扩展：使用你自己的 OpenAI-compatible API，从网页图片中提取结构化 AI 绘图提示词。
</p>

<p align="center">
  <a href="README.md"><strong>English README</strong></a>
</p>

## 功能特点

- 在网页图片旁自动显示悬浮 **Prompt** 按钮
- 用户自带 OpenAI-compatible API 配置
  - Base URL
  - API Key
  - Model
- 点击浏览器工具栏图标即可打开设置面板
- 支持连接测试
- 设置页支持中文 / 英文切换
- 结果面板分为三个 Tab：
  - JSON 视觉风格结构化数据
  - 中文提示词
  - English Prompt
- 每个 Tab 都支持一键复制
- 苹果风玻璃拟态 UI
- API Key 只保存在本地 Chrome 扩展存储中

## 工作原理

1. content script 扫描网页中的可见图片。
2. 给符合条件的图片添加悬浮 **Prompt** 按钮。
3. 点击按钮后，background service worker 读取本地 API 设置。
4. 扩展会先尝试把图片转换为 data URL；如果失败，就回退使用原始图片 URL。
5. 你配置的 OpenAI-compatible 视觉模型会分析图片并返回提示词数据。
6. 结果会显示在图片旁边的玻璃风格弹窗中。

## 安装方法

1. 下载或 clone 本仓库。
2. 打开 Chrome，进入 `chrome://extensions`。
3. 开启右上角 **开发者模式**。
4. 点击 **加载已解压的扩展程序**。
5. 选择本项目文件夹。
6. 如有需要，可以把扩展固定到 Chrome 工具栏。

## 设置方法

点击扩展图标，填写：

- **Base URL**：你的 OpenAI-compatible API 根路径，通常以 `/v1` 结尾
  - 示例：`https://api.example.com/v1`
  - 不要填写管理后台首页、网站首页或配置接口地址。
- **API Key**：你自己的 API Key。
- **Model**：支持图片输入的视觉模型名称。
- **Language**：设置页面显示语言。

填写后点击 **保存设置**。

你可以点击 **测试连接** 来检查 API 地址和模型是否能正常返回文本响应。

## 使用方法

1. 打开任意包含图片的网页。
2. 安装或更新扩展后，先刷新网页。
3. 点击图片旁边的悬浮 **Prompt** 按钮。
4. 等待模型生成结果。
5. 从 JSON、中文提示词或 English Prompt Tab 中复制结果。

## API 兼容性

扩展会调用 OpenAI-compatible Chat Completions 接口：

```text
POST {Base URL}/chat/completions
```

如果 Base URL 是裸域名，扩展也会尝试：

```text
POST {Base URL}/v1/chat/completions
```

你的模型必须支持图片输入。纯文本模型可能可以通过连接测试，但在图片提示词生成时失败。

## 隐私和安全

- 本项目不会硬编码 API Key。
- API Key 保存在你浏览器本地的 `chrome.storage.local` 中。
- content script 不会读取或接收 API Key。
- API Key 只会发送到你配置的 Base URL。
- 不要把 API Key 分享给不可信网页或他人。

## 常见问题

### 提示插件后台没有响应

请在 `chrome://extensions` 中刷新扩展，然后刷新当前网页，再重新点击 **Prompt**。

### 测试连接成功，但图片 Prompt 失败

测试连接是纯文本请求；图片 Prompt 需要模型和网关都支持多模态图片输入。

### 返回内容像网站配置 JSON

通常是 Base URL 填到了网站前台、管理后台或配置接口，而不是真正的 OpenAI-compatible API 根路径。请使用类似下面的地址：

```text
https://your-domain.com/v1
```

### 不支持 blob 图片

部分网站会使用 `blob:` 图片地址。当前版本优先支持普通图片 URL 和 data URL。

## Roadmap

- 视频提示词提取
- CSS background image 支持
- 更好的服务商预设
- 受保护媒体的可选上传流程
- 更多结果模板

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Jimmy102836/prompt&type=Date)](https://www.star-history.com/#Jimmy102836/prompt&Date)

## 开源协议

本项目使用 Apache License 2.0。

Apache 2.0 允许个人使用、修改、分发和商业使用，并不要求商业用户向作者付费。使用者需要保留许可证和版权声明。如果你希望“自用免费，商用付费”，应使用自定义商业授权协议，而不是 Apache 2.0。
