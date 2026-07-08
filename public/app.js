const messages = {
  "zh-CN": {
    heroText: "使用你自己的 GitHub Token 生成会自动刷新的贡献者头像墙。Token 不会明文保存，会加密放入图片 URL 用于后续刷新。",
    languageLabel: "Language",
    createToken: "创建 GitHub Token",
    githubToken: "GitHub Token",
    tokenHint: "推荐 Fine-grained Token，只给目标仓库 Metadata: Read-only 权限。持有图片 URL 的人可以触发刷新，但不能读取明文 Token。",
    repo: "Repository",
    title: "标题",
    description: "描述",
    titlePlaceholder: "贡献者们",
    descriptionPlaceholder: "感谢每一位参与构建的人",
    mode: "Mode",
    theme: "主题",
    themeTransparent: "透明",
    themeLight: "白色",
    themeDark: "黑色",
    themeGithub: "GitHub",
    themeOcean: "海洋",
    themeSunset: "日落",
    themeForest: "森林",
    themeCandy: "糖果",
    themeTerminal: "终端",
    animation: "动画",
    animationNone: "无",
    animationFloat: "轻浮动",
    animationPop: "弹跳",
    animationPulse: "呼吸",
    sticker: "贴纸",
    stickerNone: "无",
    stickerSparkle: "闪光",
    stickerStar: "星星",
    stickerHeart: "爱心",
    stickerCode: "代码",
    max: "最大数量",
    columns: "列数",
    avatarSize: "头像尺寸",
    gap: "间距",
    radius: "圆角",
    ttl: "快照有效期（天）",
    showName: "显示用户名",
    anon: "包含匿名贡献者",
    generate: "生成自动刷新 URL",
    ttlHint: "TTL 为 0 表示不过期。图片会按服务端刷新间隔自动更新，公共服务不建议开放永久快照。",
    preview: "预览",
    imageUrl: "图片 URL",
    markdown: "Markdown",
    html: "HTML",
    copyImageUrl: "复制图片 URL",
    copyMarkdown: "复制 Markdown",
    copyHtml: "复制 HTML",
    copied: "已复制",
    missingToken: "GitHub Token 是必填项。",
    success: "生成成功：{count} 位贡献者",
    failure: "生成失败",
    previewAlt: "生成的贡献者墙预览",
    errors: {
      missing_github_token: "GitHub Token 是必填项。",
      github_token_invalid: "GitHub Token 无效或已过期。",
      repo_not_found_or_no_access: "仓库不存在，或 Token 没有访问权限。",
      github_rate_limited: "GitHub API 当前被限流或拒绝访问，请稍后再试。",
      invalid_theme: "主题参数无效。",
      invalid_animation: "动画参数无效。",
      invalid_sticker: "贴纸参数无效。",
      invalid_title: "标题最多 80 个字符。",
      invalid_description: "描述最多 140 个字符。"
    }
  },
  en: {
    heroText: "Generate an auto-refreshing contributor wall with your own GitHub Token. The token is never stored in plaintext and is encrypted into the image URL for refreshes.",
    languageLabel: "Language",
    createToken: "Create GitHub Token",
    githubToken: "GitHub Token",
    tokenHint: "A fine-grained token with Metadata: Read-only access for the target repository is recommended. Anyone with the image URL can trigger refreshes, but cannot read the plaintext token.",
    repo: "Repository",
    title: "Title",
    description: "Description",
    titlePlaceholder: "Contributors",
    descriptionPlaceholder: "Thanks for building with us",
    mode: "Mode",
    theme: "Theme",
    themeTransparent: "transparent",
    themeLight: "light",
    themeDark: "dark",
    themeGithub: "GitHub",
    themeOcean: "ocean",
    themeSunset: "sunset",
    themeForest: "forest",
    themeCandy: "candy",
    themeTerminal: "terminal",
    animation: "Animation",
    animationNone: "none",
    animationFloat: "float",
    animationPop: "pop",
    animationPulse: "pulse",
    sticker: "Sticker",
    stickerNone: "none",
    stickerSparkle: "sparkle",
    stickerStar: "star",
    stickerHeart: "heart",
    stickerCode: "code",
    max: "Max",
    columns: "Columns",
    avatarSize: "Avatar Size",
    gap: "Gap",
    radius: "Radius",
    ttl: "Snapshot TTL Days",
    showName: "showName",
    anon: "include anonymous contributors",
    generate: "Generate auto-refresh URL",
    ttlHint: "TTL 0 means no expiration. Images refresh on the server interval; public services should avoid unlimited snapshots.",
    preview: "Preview",
    imageUrl: "Image URL",
    markdown: "Markdown",
    html: "HTML",
    copyImageUrl: "Copy Image URL",
    copyMarkdown: "Copy Markdown",
    copyHtml: "Copy HTML",
    copied: "Copied",
    missingToken: "GitHub Token is required.",
    success: "Generated successfully: {count} contributors",
    failure: "Generation failed",
    previewAlt: "Generated contributor wall preview",
    errors: {
      missing_github_token: "GitHub Token is required.",
      github_token_invalid: "GitHub Token is invalid or expired.",
      repo_not_found_or_no_access: "Repository not found, or the token has no access.",
      github_rate_limited: "GitHub API is rate limited or forbidden for this token. Please try again later.",
      invalid_theme: "Invalid theme.",
      invalid_animation: "Invalid animation.",
      invalid_sticker: "Invalid sticker.",
      invalid_title: "Title must be at most 80 characters.",
      invalid_description: "Description must be at most 140 characters."
    }
  }
};

const languageKey = "contrib-wall-language";
const form = document.querySelector("#form");
const submit = document.querySelector("#submit");
const statusEl = document.querySelector("#status");
const preview = document.querySelector("#preview");
const imageUrl = document.querySelector("#imageUrl");
const markdown = document.querySelector("#markdown");
const html = document.querySelector("#html");
const language = document.querySelector("#language");

let currentLanguage = getInitialLanguage();

language.value = currentLanguage;
applyLanguage(currentLanguage);

language.addEventListener("change", () => {
  currentLanguage = normalizeLanguage(language.value);
  localStorage.setItem(languageKey, currentLanguage);
  applyLanguage(currentLanguage);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  statusEl.textContent = "";
  statusEl.className = "status";
  submit.disabled = true;

  try {
    const data = Object.fromEntries(new FormData(form).entries());
    const githubToken = String(data.githubToken || "").trim();

    if (!githubToken) {
      throw new Error(t("missingToken"));
    }

    delete data.githubToken;

    data.showName = document.querySelector("#showName").checked;
    data.anon = document.querySelector("#anon").checked;

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + githubToken
      },
      body: JSON.stringify(data)
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(localizedApiError(json));
    }

    preview.src = json.imageUrl;
    preview.alt = t("previewAlt");
    imageUrl.value = json.imageUrl;
    markdown.value = json.markdown;
    html.value = json.html;

    statusEl.textContent = t("success").replace("{count}", String(json.contributorCount));
    statusEl.className = "status ok";
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : t("failure");
    statusEl.className = "status error";
  } finally {
    submit.disabled = false;
  }
});

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const target = document.querySelector("#" + button.dataset.copy);
    if (!target?.value) return;

    await navigator.clipboard.writeText(target.value);
    button.textContent = t("copied");
    setTimeout(() => {
      button.textContent = t(button.dataset.copyLabel);
    }, 900);
  });
}

function applyLanguage(lang) {
  document.documentElement.lang = lang;

  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }

  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }

  preview.alt = preview.src ? t("previewAlt") : "";
}

function localizedApiError(json) {
  const code = json?.error?.code;
  const fallback = json?.error?.message || t("failure");
  return messages[currentLanguage].errors[code] || fallback;
}

function t(key) {
  return messages[currentLanguage][key] || messages.en[key] || key;
}

function getInitialLanguage() {
  const stored = localStorage.getItem(languageKey);
  if (stored) return normalizeLanguage(stored);

  return normalizeLanguage(navigator.language || "zh-CN");
}

function normalizeLanguage(value) {
  return String(value).toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
