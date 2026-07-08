import type { ManualContributor } from "./types";

/**
 * 手动贡献者配置。
 *
 * 对公共服务而言，这通常只用于你自己的项目。
 * 例如：文档、测试、反馈、翻译等没有进入 GitHub contributors API 的贡献者。
 */
export const MANUAL_CONTRIBUTORS: Record<string, ManualContributor[]> = {
  "nyakang/nyaterm": [
    {
      login: "jockiller",
      roles: ["macOS"],
      note: "macOS local network / pty related contribution"
    },
    {
      login: "huairen721",
      roles: ["Linux"],
      note: "Linux clipboard related contribution"
    },
    {
      login: "qiudaomao",
      roles: ["terminal"],
      note: "Terminal clipboard related contribution"
    }
  ]
};
