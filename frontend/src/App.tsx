import React, { useState, useEffect } from "react"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Textarea } from "./components/ui/textarea"
import { Checkbox } from "./components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select"
import { Toaster } from "./components/ui/sonner"
import { toast } from "sonner"

const messages = {
  "zh-CN": {
    heroText: "使用你自己的 GitHub Token 生成会自动刷新的贡献者头像墙。Token 不会明文保存，会加密放入图片 URL 用于后续刷新。",
    createToken: "创建 GitHub Token",
    githubToken: "GitHub Token",
    tokenHint: "推荐 Fine-grained Token，只给目标仓库 Metadata: Read-only 权限。持有图片 URL 的人可以触发刷新，但不能读取明文 Token。",
    repo: "Repository",
    title: "标题",
    description: "描述",
    titlePlaceholder: "贡献者们",
    descriptionPlaceholder: "感谢每一位参与构建的人",
    mode: "模式",
    theme: "主题",
    animation: "动画",
    sticker: "贴纸",
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
    generating: "生成中...",
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
    animation: "Animation",
    sticker: "Sticker",
    max: "Max",
    columns: "Columns",
    avatarSize: "Avatar Size",
    gap: "Gap",
    radius: "Radius",
    ttl: "Snapshot TTL Days",
    showName: "Show Name",
    anon: "Include anonymous contributors",
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
    generating: "Generating...",
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
}

export default function App() {
  const [lang, setLang] = useState<"zh-CN" | "en">("zh-CN")
  const t = (key: string) => (messages[lang] as Record<string, any>)[key] || key
  const tError = (code: string, fallback: string) => (messages[lang].errors as Record<string, string>)[code] || fallback

  useEffect(() => {
    const stored = localStorage.getItem("contrib-wall-language")
    if (stored === "zh-CN" || stored === "en") setLang(stored)
    else if (navigator.language.toLowerCase().startsWith("zh")) setLang("zh-CN")
    else setLang("en")
  }, [])

  const handleLangChange = (val: "zh-CN" | "en") => {
    setLang(val)
    localStorage.setItem("contrib-wall-language", val)
    document.documentElement.lang = val
  }

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imageUrl: string; markdown: string; html: string; count: number } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const form = new FormData(e.currentTarget)
    const data = Object.fromEntries(form.entries())
    const githubToken = String(data.githubToken || "").trim()

    if (!githubToken) {
      toast.error(t("missingToken"))
      setLoading(false)
      return
    }

    delete data.githubToken
    data.showName = form.get("showName") === "on" ? "true" : "false"
    data.anon = form.get("anon") === "on" ? "true" : "false"

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + githubToken
        },
        body: JSON.stringify(data)
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(tError(json?.error?.code, json?.error?.message || t("failure")))
      }

      setResult({
        imageUrl: json.imageUrl,
        markdown: json.markdown,
        html: json.html,
        count: json.contributorCount
      })
      toast.success(t("success").replace("{count}", String(json.contributorCount)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failure"))
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    toast.success(t("copied"))
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6 md:p-12">
      <Toaster />
      <main className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 flex items-center gap-3">
              Contrib Wall
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("heroText")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={lang} onValueChange={handleLangChange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">简体中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 mr-2"
                >
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                {t("createToken")}
              </a>
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Setup your contributor wall preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="githubToken">{t("githubToken")}</Label>
                  <Input id="githubToken" name="githubToken" type="password" autoComplete="off" placeholder="github_pat_xxx" required />
                  <p className="text-sm text-muted-foreground">{t("tokenHint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repo">{t("repo")}</Label>
                  <Input id="repo" name="repo" defaultValue="nyakang/nyaterm" placeholder="owner/repo" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t("title")}</Label>
                    <Input id="title" name="title" maxLength={80} placeholder={t("titlePlaceholder") as string} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{t("description")}</Label>
                    <Input id="description" name="description" maxLength={140} placeholder={t("descriptionPlaceholder") as string} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mode">{t("mode")}</Label>
                    <Select name="mode" defaultValue="mixed">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github">github</SelectItem>
                        <SelectItem value="mixed">mixed</SelectItem>
                        <SelectItem value="manual">manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="theme">{t("theme")}</Label>
                    <Select name="theme" defaultValue="transparent">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transparent">transparent</SelectItem>
                        <SelectItem value="light">light</SelectItem>
                        <SelectItem value="dark">dark</SelectItem>
                        <SelectItem value="github">github</SelectItem>
                        <SelectItem value="ocean">ocean</SelectItem>
                        <SelectItem value="sunset">sunset</SelectItem>
                        <SelectItem value="forest">forest</SelectItem>
                        <SelectItem value="candy">candy</SelectItem>
                        <SelectItem value="terminal">terminal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="animation">{t("animation")}</Label>
                    <Select name="animation" defaultValue="none">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">none</SelectItem>
                        <SelectItem value="float">float</SelectItem>
                        <SelectItem value="pop">pop</SelectItem>
                        <SelectItem value="pulse">pulse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sticker">{t("sticker")}</Label>
                    <Select name="sticker" defaultValue="none">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">none</SelectItem>
                        <SelectItem value="sparkle">sparkle</SelectItem>
                        <SelectItem value="star">star</SelectItem>
                        <SelectItem value="heart">heart</SelectItem>
                        <SelectItem value="code">code</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max">{t("max")}</Label>
                    <Input id="max" name="max" type="number" min={1} max={100} defaultValue={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="columns">{t("columns")}</Label>
                    <Input id="columns" name="columns" type="number" min={1} max={20} defaultValue={10} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="avatarSize">{t("avatarSize")}</Label>
                    <Input id="avatarSize" name="avatarSize" type="number" min={16} max={128} defaultValue={56} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gap">{t("gap")}</Label>
                    <Input id="gap" name="gap" type="number" min={0} max={32} defaultValue={8} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="radius">{t("radius")}</Label>
                    <Input id="radius" name="radius" type="number" min={0} max={999} defaultValue={999} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiresInDays">{t("ttl")}</Label>
                    <Input id="expiresInDays" name="expiresInDays" type="number" min={0} max={3650} defaultValue={365} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="showName" name="showName" />
                    <Label htmlFor="showName" className="font-normal cursor-pointer">{t("showName")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="anon" name="anon" />
                    <Label htmlFor="anon" className="font-normal cursor-pointer">{t("anon")}</Label>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t("generating") : t("generate")}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {t("ttlHint")}
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("preview")}</CardTitle>
              <CardDescription>Live preview and integration code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="min-h-[200px] flex items-center justify-center p-6 border border-dashed rounded-lg bg-muted/30">
                {result ? (
                  <img src={result.imageUrl} alt="Contributor Wall Preview" className="max-w-full rounded-md shadow-sm bg-background" />
                ) : (
                  <span className="text-sm text-muted-foreground">Submit the form to generate preview</span>
                )}
              </div>

              {result && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("imageUrl")}</Label>
                    <div className="relative">
                      <Textarea value={result.imageUrl} readOnly className="pr-24 min-h-[80px] font-mono text-xs" />
                      <Button size="sm" variant="secondary" className="absolute bottom-2 right-2" onClick={() => copyToClipboard(result.imageUrl)}>
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("markdown")}</Label>
                    <div className="relative">
                      <Textarea value={result.markdown} readOnly className="pr-24 min-h-[80px] font-mono text-xs" />
                      <Button size="sm" variant="secondary" className="absolute bottom-2 right-2" onClick={() => copyToClipboard(result.markdown)}>
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("html")}</Label>
                    <div className="relative">
                      <Textarea value={result.html} readOnly className="pr-24 min-h-[80px] font-mono text-xs" />
                      <Button size="sm" variant="secondary" className="absolute bottom-2 right-2" onClick={() => copyToClipboard(result.html)}>
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
