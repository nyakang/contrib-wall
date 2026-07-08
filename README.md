# contrib-wall

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

## GitHub Token 权限

推荐使用 Fine-grained personal access token，并只授予目标仓库所需的最小权限：

```txt
Repository access:
  选择需要展示贡献者的仓库

Repository permissions:
  Metadata: Read-only
```

公开仓库理论上可以匿名请求 GitHub API，但让用户提供自己的 token 可以避免服务提供者承担所有 GitHub API 额度。

## README 嵌入示例

生成成功后，页面会给出 Markdown：

```md
<a href="https://github.com/owner/repo/graphs/contributors">
  <img src="https://your-domain.com/image?snapshot=xxx&sealed_token=xxx" alt="Contributors to owner/repo" />
</a>
```

其中：

- `snapshot` 是 KV 中保存的 SVG 快照 ID。
- `sealed_token` 是 Worker 用 `SEALING_SECRET` 签名后的访问令牌。
- GitHub Token 不会出现在这个 URL 中。

## API

生成快照：

```http
POST /api/generate
Authorization: Bearer github_pat_xxx
Content-Type: application/json
```

示例请求体：

```json
{
  "repo": "owner/repo",
  "title": "Contributors",
  "description": "Thanks for building with us",
  "theme": "github",
  "animation": "float",
  "sticker": "star",
  "max": 48,
  "columns": 8,
  "expiresInDays": 0
}
```

常用选项：

- `theme`: `transparent`, `light`, `dark`, `github`, `ocean`, `sunset`, `forest`, `candy`, `terminal`
- `animation`: `none`, `float`, `pop`, `pulse`
- `sticker`: `none`, `sparkle`, `star`, `heart`, `code`
- `expiresInDays`: `0` 表示快照长期有效；大于 `0` 时会设置 KV TTL 和签名过期时间。

## 安全说明

可以提交到 GitHub：

- `wrangler.toml` 中的非敏感配置。
- `.dev.vars.example` 中的占位示例。
- `public/`、`src/`、`package.json`、`package-lock.json` 等源码和前端资源。

不要提交到 GitHub：

- `.dev.vars`
- `.dev.vars.*`
- `.env`
- `.env.*`
- Cloudflare API token、GitHub Token、私钥文件、生产密钥和真实账户凭据。

生产环境的 `SEALING_SECRET` 必须通过 `npx wrangler secret put SEALING_SECRET` 设置，不要写进 `wrangler.toml`、源码或 README。

## 脚本

```bash
npm run dev        # 本地启动 Worker
npm run deploy     # 部署到 Cloudflare Workers
npm run typecheck  # TypeScript 类型检查
npm run check      # 当前等同于 typecheck
```

## 进一步加固

如果要把它作为公开服务长期运行，建议继续增加：

- Cloudflare Turnstile。
- 更严格的 IP 限流和异常请求监控。
- 对生成参数的用量配额。
- GitHub OAuth 或 GitHub App 登录流程。
- Cloudflare Workers Observability。
