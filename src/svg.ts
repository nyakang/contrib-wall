import type { AnimationStyle, Contributor, ImageOptions, StickerStyle, Theme } from "./types";

interface Palette {
  background: string;
  backgroundAccent?: string;
  text: string;
  muted: string;
  avatarFill: string;
  avatarText: string;
  sticker: string;
  stickerStroke: string;
}

const PALETTES: Record<Theme, Palette> = {
  transparent: {
    background: "transparent",
    text: "#57606a",
    muted: "#6e7781",
    avatarFill: "#d0d7de",
    avatarText: "#24292f",
    sticker: "#f2cc60",
    stickerStroke: "#bf8700"
  },
  light: {
    background: "#ffffff",
    text: "#24292f",
    muted: "#57606a",
    avatarFill: "#d0d7de",
    avatarText: "#24292f",
    sticker: "#bf3989",
    stickerStroke: "#ffffff"
  },
  dark: {
    background: "#0d1117",
    text: "#c9d1d9",
    muted: "#8b949e",
    avatarFill: "#30363d",
    avatarText: "#f0f6fc",
    sticker: "#f2cc60",
    stickerStroke: "#0d1117"
  },
  github: {
    background: "#f6f8fa",
    backgroundAccent: "#eaeef2",
    text: "#24292f",
    muted: "#57606a",
    avatarFill: "#d0d7de",
    avatarText: "#24292f",
    sticker: "#2f81f7",
    stickerStroke: "#ffffff"
  },
  ocean: {
    background: "#082f49",
    backgroundAccent: "#0e7490",
    text: "#ecfeff",
    muted: "#a5f3fc",
    avatarFill: "#155e75",
    avatarText: "#ecfeff",
    sticker: "#67e8f9",
    stickerStroke: "#083344"
  },
  sunset: {
    background: "#431407",
    backgroundAccent: "#ea580c",
    text: "#fff7ed",
    muted: "#fed7aa",
    avatarFill: "#9a3412",
    avatarText: "#fff7ed",
    sticker: "#fde047",
    stickerStroke: "#7c2d12"
  },
  forest: {
    background: "#052e16",
    backgroundAccent: "#16a34a",
    text: "#f0fdf4",
    muted: "#bbf7d0",
    avatarFill: "#166534",
    avatarText: "#f0fdf4",
    sticker: "#86efac",
    stickerStroke: "#14532d"
  },
  candy: {
    background: "#fff1f2",
    backgroundAccent: "#a78bfa",
    text: "#4c1d95",
    muted: "#9f1239",
    avatarFill: "#fecdd3",
    avatarText: "#4c1d95",
    sticker: "#f472b6",
    stickerStroke: "#ffffff"
  },
  terminal: {
    background: "#020617",
    backgroundAccent: "#22c55e",
    text: "#bbf7d0",
    muted: "#86efac",
    avatarFill: "#064e3b",
    avatarText: "#dcfce7",
    sticker: "#22c55e",
    stickerStroke: "#020617"
  }
};

export function renderContributorsSvg(contributors: Contributor[], options: ImageOptions): string {
  const items = contributors.slice(0, options.max);
  const columns = Math.min(options.columns, Math.max(items.length, 1));
  const rows = Math.max(Math.ceil(items.length / columns), 1);

  const hasHeader = Boolean(options.title || options.description);
  const nameHeight = options.showName ? 18 : 0;
  const cellWidth = options.avatarSize;
  const cellHeight = options.avatarSize + nameHeight;
  const gridWidth = columns * cellWidth + (columns - 1) * options.gap;
  const gridHeight = rows * cellHeight + (rows - 1) * options.gap;
  const headerHeight = headerBlockHeight(options);
  const headerGap = hasHeader ? 12 : 0;
  const width = Math.max(gridWidth, hasHeader ? 320 : gridWidth);
  const height = headerHeight + headerGap + gridHeight;
  const gridX = Math.floor((width - gridWidth) / 2);
  const gridY = headerHeight + headerGap;

  const palette = PALETTES[options.theme];
  const radius = Math.min(options.radius, options.avatarSize / 2);

  const body = items
    .map((contributor, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = gridX + col * (cellWidth + options.gap);
      const y = gridY + row * (cellHeight + options.gap);
      const clipId = `avatar-${index}`;

      return renderContributor(contributor, {
        x,
        y,
        size: options.avatarSize,
        radius,
        clipId,
        showName: options.showName,
        textColor: palette.text,
        palette,
        animation: options.animation,
        sticker: options.sticker,
        index
      });
    })
    .join("\n");

  const accessibleTitle = options.title || `Contributors to ${options.repo.fullName}`;
  const accessibleDesc = options.description || `${items.length} contributors are displayed.`;

  return trimSvg(`
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}"
     height="${height}"
     viewBox="0 0 ${width} ${height}"
     role="img"
     aria-labelledby="title desc">
  <title id="title">${escapeXml(accessibleTitle)}</title>
  <desc id="desc">${escapeXml(accessibleDesc)}</desc>
  ${renderDefs(options.theme, palette, options.animation)}
  ${renderBackground(options.theme, width, height)}
  ${renderHeader(options, width, palette)}
  ${body}
</svg>
`);
}

interface RenderContributorOptions {
  x: number;
  y: number;
  size: number;
  radius: number;
  clipId: string;
  showName: boolean;
  textColor: string;
  palette: Palette;
  animation: AnimationStyle;
  sticker: StickerStyle;
  index: number;
}

function renderContributor(contributor: Contributor, options: RenderContributorOptions): string {
  const title = buildTitle(contributor);
  const name = options.showName
    ? `<text x="${options.x + options.size / 2}"
             y="${options.y + options.size + 13}"
             text-anchor="middle"
             font-size="11"
             font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
             fill="${options.textColor}">${escapeXml(shortName(contributor.login))}</text>`
    : "";

  const avatar = contributor.avatarDataUrl
    ? `<image href="${escapeXml(contributor.avatarDataUrl)}"
           x="${options.x}"
           y="${options.y}"
           width="${options.size}"
           height="${options.size}"
           preserveAspectRatio="xMidYMid slice"
           clip-path="url(#${options.clipId})" />`
    : renderAvatarPlaceholder(contributor, options);

  const delay = animationDelay(options.animation, options.index);

  return `
  <a href="${escapeXml(contributor.profileUrl)}" target="_blank" rel="noopener noreferrer">
    <title>${escapeXml(title)}</title>
    <defs>
      <clipPath id="${options.clipId}">
        <rect x="${options.x}" y="${options.y}" width="${options.size}" height="${options.size}" rx="${options.radius}" ry="${options.radius}" />
      </clipPath>
    </defs>
    <g class="${options.animation === "none" ? "" : `avatar-item avatar-${options.animation}`}" style="${delay}">
      ${avatar}
      ${renderSticker(options)}
      ${name}
    </g>
  </a>`;
}

function renderDefs(theme: Theme, palette: Palette, animation: AnimationStyle): string {
  const backgroundDef = palette.backgroundAccent
    ? `<linearGradient id="wall-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.background}" />
      <stop offset="100%" stop-color="${palette.backgroundAccent}" />
    </linearGradient>`
    : "";

  const animationDef =
    animation === "none"
      ? ""
      : `<style>
      .avatar-float { animation: wall-float 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      .avatar-pop { animation: wall-pop 2.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      .avatar-pulse { animation: wall-pulse 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      @keyframes wall-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
      @keyframes wall-pop { 0%, 80%, 100% { transform: scale(1); } 88% { transform: scale(1.05); } }
      @keyframes wall-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
    </style>`;

  if (!backgroundDef && !animationDef) return "";

  return `<defs data-theme="${theme}">
    ${backgroundDef}
    ${animationDef}
  </defs>`;
}

function renderBackground(theme: Theme, width: number, height: number): string {
  if (theme === "transparent") return "";

  const fill = PALETTES[theme].backgroundAccent ? "url(#wall-bg)" : PALETTES[theme].background;
  return `<rect width="${width}" height="${height}" rx="8" fill="${fill}" />`;
}

function renderHeader(options: ImageOptions, width: number, palette: Palette): string {
  if (!options.title && !options.description) return "";

  const title = options.title
    ? `<text x="${width / 2}" y="22" text-anchor="middle" font-size="16" font-weight="700"
             font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
             fill="${palette.text}">${escapeXml(options.title)}</text>`
    : "";
  const descriptionY = options.title ? 42 : 22;
  const description = options.description
    ? `<text x="${width / 2}" y="${descriptionY}" text-anchor="middle" font-size="12"
             font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
             fill="${palette.muted}">${escapeXml(options.description)}</text>`
    : "";

  return `<g>${title}${description}</g>`;
}

function renderAvatarPlaceholder(contributor: Contributor, options: RenderContributorOptions): string {
  return `
      <rect x="${options.x}"
            y="${options.y}"
            width="${options.size}"
            height="${options.size}"
            rx="${options.radius}"
            ry="${options.radius}"
            fill="${placeholderColor(contributor.login, options.palette.avatarFill)}" />
      <text x="${options.x + options.size / 2}"
            y="${options.y + options.size / 2 + Math.max(4, options.size * 0.12)}"
            text-anchor="middle"
            font-size="${Math.max(12, Math.floor(options.size * 0.34))}"
            font-weight="700"
            font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
            fill="${options.palette.avatarText}"
            clip-path="url(#${options.clipId})">${escapeXml(initials(contributor.login))}</text>`;
}

function renderSticker(options: RenderContributorOptions): string {
  if (options.sticker === "none") return "";

  const size = Math.max(14, Math.floor(options.size * 0.3));
  const x = options.x + options.size - size * 0.65;
  const y = options.y - size * 0.25;
  const fill = options.palette.sticker;
  const stroke = options.palette.stickerStroke;

  if (options.sticker === "sparkle") {
    return `<path d="M ${x + size / 2} ${y} L ${x + size * 0.62} ${y + size * 0.38} L ${x + size} ${y + size / 2} L ${x + size * 0.62} ${y + size * 0.62} L ${x + size / 2} ${y + size} L ${x + size * 0.38} ${y + size * 0.62} L ${x} ${y + size / 2} L ${x + size * 0.38} ${y + size * 0.38} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`;
  }

  if (options.sticker === "star") {
    return `<path d="${starPath(x + size / 2, y + size / 2, size * 0.48, size * 0.22)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`;
  }

  if (options.sticker === "heart") {
    return `<path d="M ${x + size / 2} ${y + size * 0.88} C ${x + size * 0.08} ${y + size * 0.56}, ${x} ${y + size * 0.28}, ${x + size * 0.22} ${y + size * 0.12} C ${x + size * 0.38} ${y}, ${x + size * 0.5} ${y + size * 0.15}, ${x + size / 2} ${y + size * 0.15} C ${x + size / 2} ${y + size * 0.15}, ${x + size * 0.62} ${y}, ${x + size * 0.78} ${y + size * 0.12} C ${x + size} ${y + size * 0.28}, ${x + size * 0.92} ${y + size * 0.56}, ${x + size / 2} ${y + size * 0.88} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`;
  }

  return `<g fill="none" stroke="${fill}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M ${x + size * 0.36} ${y + size * 0.25} L ${x + size * 0.14} ${y + size / 2} L ${x + size * 0.36} ${y + size * 0.75}" />
      <path d="M ${x + size * 0.64} ${y + size * 0.25} L ${x + size * 0.86} ${y + size / 2} L ${x + size * 0.64} ${y + size * 0.75}" />
    </g>`;
}

function headerBlockHeight(options: ImageOptions): number {
  if (options.title && options.description) return 50;
  if (options.title || options.description) return 30;
  return 0;
}

function animationDelay(animation: AnimationStyle, index: number): string {
  if (animation === "none") return "";
  return `animation-delay: ${((index % 8) * 0.08).toFixed(2)}s`;
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];

  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push(`${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius}`);
  }

  return `M ${points.join(" L ")} Z`;
}

function placeholderColor(value: string, fallback: string): string {
  const colors = ["#2f81f7", "#a371f7", "#db61a2", "#f85149", "#d29922", "#3fb950", "#39c5cf"];
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return colors[hash % colors.length] || fallback;
}

function initials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function buildTitle(contributor: Contributor): string {
  const parts = [contributor.login];

  if (typeof contributor.contributions === "number") {
    parts.push(`${contributor.contributions} contributions`);
  }

  if (contributor.roles?.length) {
    parts.push(contributor.roles.join(", "));
  }

  if (contributor.note) {
    parts.push(contributor.note);
  }

  return parts.join(" · ");
}

function shortName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });
}

function trimSvg(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimStart();
}
