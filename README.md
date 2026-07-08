# contrib-wall

<p align="center">
  <a href="https://github.com/nyakang/contrib-wall/graphs/contributors">
    <img src="https://contrib-wall.coderkang.workers.dev/image?snapshot=RKGZXUsPArYrduozjO2pecpy&amp;sealed_token=eyJ2IjoxLCJ0eXBlIjoic25hcHNob3QiLCJzbmFwc2hvdCI6IlJLR1pYVXNQQXJZcmR1b3pqTzJwZWNweSIsImV4cCI6MTgxNTAzMDQ3MH0.rR2VPbgKOk6DTByHLeJPfGmPWRyivGZvVcBptsPpegM" alt="贡献者" />
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

这个项目默认按 Cloudflare Dashboard 配置绑定，先部署 Worker 代码，然后打开：

```txt
Cloudflare Dashboard -> Workers & Pages -> 你的 Worker -> Settings -> Bindings
```

添加 KV namespace 绑定：

```txt
类型：KV namespace
名称：kv
值：选择你的 KV 命名空间
```

添加生产签名密钥：

```txt
类型：Secret
名称：SEALING_SECRET
值：至少 32 个字符的随机字符串
```

绑定名称必须和代码一致：`kv`、`assets`、`SEALING_SECRET`。旧部署里的 `CONTRIB_CACHE` 和 `ASSETS` 仍然可以被代码识别，但不再作为推荐配置。
