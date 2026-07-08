# contrib-wall

<center>
  <a href="https://github.com/nyakang/contrib-wall/graphs/contributors">
    <img src="https://contrib-wall.coderkang.workers.dev/image?snapshot=RKGZXUsPArYrduozjO2pecpy&amp;sealed_token=eyJ2IjoxLCJ0eXBlIjoic25hcHNob3QiLCJzbmFwc2hvdCI6IlJLR1pYVXNQQXJZcmR1b3pqTzJwZWNweSIsImV4cCI6MTgxNTAzMDQ3MH0.rR2VPbgKOk6DTByHLeJPfGmPWRyivGZvVcBptsPpegM" alt="贡献者" />
  </a>
</center>


用 Cloudflare Workers 生成可嵌入 README 的 GitHub 贡献者头像墙。

用户在页面中填写自己的 GitHub Token 和仓库地址，Worker 只用这个 token 请求一次 GitHub Contributors API，随后把生成好的 SVG 快照写入 KV。README 中嵌入的是带签名的快照图片地址，不包含用户的 GitHub Token。

## 特性

- 生成静态 SVG 贡献者头像墙，可直接放进 GitHub README。
- GitHub Token 只通过 `POST /api/generate` 使用一次，不保存到 KV，也不会进入图片 URL。
- 图片访问走 `/image?snapshot=...&sealed_token=...`，由 `SEALING_SECRET` 签名校验。
- 头像会内联到 SVG，降低 README 预览时外链头像裂图的概率。
- 支持中文和英文界面。
- 支持自定义标题、描述、主题、动画、贴纸、头像尺寸和展示数量。
- 支持 GitHub 贡献者、手动补充贡献者、混合展示模式。
- 使用 Cloudflare Workers Static Assets 托管前端，使用 KV 保存快照。

## 工作流程

```txt
用户打开页面
  -> 填写 GitHub Token、仓库和展示参数
  -> POST /api/generate
  -> Worker 使用用户 token 拉取 contributors
  -> 生成 SVG 快照并写入 KV
  -> 返回 /image?snapshot=...&sealed_token=...
  -> README 嵌入这个图片地址
  -> 后续图片访问只读 KV，不再访问 GitHub API
```

## 项目结构

```txt
contrib-wall/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── avatar.ts
│   ├── cache.ts
│   ├── config.ts
│   ├── contributors.ts
│   ├── github.ts
│   ├── http.ts
│   ├── index.ts
│   ├── manual-contributors.ts
│   ├── params.ts
│   ├── rate-limit.ts
│   ├── seal.ts
│   ├── snapshot.ts
│   ├── svg.ts
│   └── types.ts
├── .dev.vars.example
├── wrangler.toml
└── package.json
```

## 本地开发

安装依赖：

```bash
npm install
```

准备本地密钥：

```bash
cp .dev.vars.example .dev.vars
```

把 `.dev.vars` 里的 `SEALING_SECRET` 改成至少 32 个字符的随机字符串，例如：

```bash
openssl rand -base64 48
```

启动开发服务：

```bash
npm run dev
```

默认访问：

```txt
http://localhost:8787/
```

## 部署

创建 KV namespace：

```bash
npx wrangler kv namespace create CONTRIB_CACHE
npx wrangler kv namespace create CONTRIB_CACHE --preview
```

把命令输出的 `id` 和 `preview_id` 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "CONTRIB_CACHE"
id = "..."
preview_id = "..."
```

设置生产签名密钥：

```bash
npx wrangler secret put SEALING_SECRET
```

部署：

```bash
npm run deploy
```