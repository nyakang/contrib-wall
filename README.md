# contrib-wall

<p align="center">
  <a href="https://github.com/nyakang/contrib-wall/graphs/contributors">
    <img src="https://contrib-wall.coderkang.workers.dev/image?snapshot=eS0TuKqRCa77zZYBXKW65yfz&amp;sealed_token=eyJ2IjoxLCJ0eXBlIjoic25hcHNob3QiLCJzbmFwc2hvdCI6ImVTMFR1S3FSQ2E3N3paWUJYS1c2NXlmeiIsImV4cCI6MTgxNTAzNDkwNn0.BkVLh7PjkeNrsOTpmDBlpLQUsxnd13v-T2jiDJ1wy2g&amp;sealed_github_token=-rIr769Srj-WF_UB.MfqZY4JpfHyJm4-2iJmnA0pcWKpQ_c-ZLAPavB9sNq0tysz6OYEEEtcvklFrH_T2O0Xq5gerFp-lmNxNWR5dZpYslCM7cJ8SDyteJWZEoYuoqMTC1mVHB12MenSVXC3265r7JFCF3vQLoVD_-wnHOmINb-rcz0_Qc7R9HgSJjPewQQduKbvQeJ0CGocRYJH9ml-DO2utt71bX6H5qmX4L8NtaU4GZ1vIyZA_tj7AQI6C_lc0oA" alt="贡献者们" />
  </a>
</p>

用 Cloudflare Workers 生成可嵌入 README 的 GitHub 贡献者头像墙。

## 特性

- 生成可自动刷新的 SVG 贡献者头像墙，可直接放进 GitHub README。
- 默认每天刷新一次贡献者列表，刷新失败时继续展示旧 SVG，并在 1 小时后重试。
- 头像会内联到 SVG，降低 README 预览时外链头像裂图的概率。
- 支持自定义标题、描述、主题、动画、贴纸、头像尺寸和展示数量。
- 支持 GitHub 贡献者、手动补充贡献者、混合展示模式。
- 使用 Cloudflare Workers Static Assets 托管前端，使用 KV 保存快照。

## 部署

### 1. 创建 KV 命名空间

```bash
npx wrangler kv namespace create contrib-wall-kv
```

记录输出中的 `id`，后续步骤需要用到。

### 2. 配置 wrangler.toml

```bash
cp wrangler.toml.example wrangler.toml
```

打开 `wrangler.toml`，将 `<YOUR_KV_NAMESPACE_ID>` 替换为上一步获得的 id。

> **⚠️ 重要：** KV 绑定必须在 `wrangler.toml` 中声明。如果只在 Dashboard 手动添加，每次 `wrangler deploy` 都会以 `wrangler.toml` 为准，覆盖掉手动绑定。

### 3. 设置 Secrets

```bash
npx wrangler secret put SEALING_SECRET
```

输入一个至少 32 字符的随机字符串。可以用以下命令生成：

```bash
openssl rand -base64 48
```

### 4. 部署

```bash
npm run deploy
```

### 本地开发

```bash
# 复制环境变量模板
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入 SEALING_SECRET

# 启动 Worker 开发服务器
npm run dev:worker

# 或单独启动前端开发服务器
npm run dev:frontend
```

本地开发时 `wrangler dev` 会自动创建一个本地 KV 存储，无需额外配置。
