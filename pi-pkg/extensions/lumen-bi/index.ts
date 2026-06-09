/**
 * LUMEN — Midnight Intelligence
 * Project-local extension for the company-bi project.
 * Sets a static branded LUMEN TUI header on startup.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

type HeaderContext = Pick<ExtensionContext, "ui" | "hasUI">;

const LOGO = [
  "██╗     ██╗   ██╗███╗   ███╗███████╗███╗   ██╗",
  "██║     ██║   ██║████╗ ████║██╔════╝████╗  ██║",
  "██║     ██║   ██║██╔████╔██║█████╗  ██╔██╗ ██║",
  "██║     ██║   ██║██║╚██╔╝██║██╔══╝  ██║╚██╗██║",
  "███████╗╚██████╔╝██║ ╚═╝ ██║███████╗██║ ╚████║",
  "╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝",
];

// ── width helpers ───────────────────────────────────────────────────

function fit(text: string, width: number): string {
  return truncateToWidth(text, Math.max(1, width));
}

function centerLine(text: string, width: number): string {
  const safeWidth = Math.max(1, width);
  const pad = Math.max(0, Math.floor((safeWidth - visibleWidth(text)) / 2));
  return " ".repeat(pad) + text;
}

// ── static logo renderer ───────────────────────────────────────────

function colorLogoLine(theme: Theme, line: string, _row: number): string {
  const cyan = (s: string) => theme.fg("accent", s);
  const dim = (s: string) => theme.fg("dim", s);

  // Block letters stay cyan. The bottom border (╚, ═, ╝) is muted so the
  // underline reads as a baseline rather than a second row of text.
  return [...line]
    .map((ch) => {
      if (ch === " ") return ch;
      if (ch === "╚" || ch === "═" || ch === "╝") return dim(ch);
      return cyan(ch);
    })
    .join("");
}

function lumenHeader(theme: Theme, width: number): string[] {
  const cyan = (s: string) => theme.fg("accent", s);
  const safeWidth = Math.max(1, width);

  // Graceful fallback only for terminals where the block mark cannot fit.
  if (safeWidth < 60) {
    return [
      "",
      cyan("LUMEN"),
      "",
    ].map((line) => fit(centerLine(line, safeWidth), safeWidth));
  }

  const logoWidth = Math.max(...LOGO.map((line) => visibleWidth(line)));

  const rawLines = [
    "",
    ...LOGO.map((line, row) => colorLogoLine(theme, centerLine(line, logoWidth), row)),
    "",
  ];

  return rawLines.map((line) => fit(centerLine(line, safeWidth), safeWidth));
}

function applyLumenHeader(ctx: HeaderContext) {
  ctx.ui.setHeader((_tui, theme) => {
    return {
      render(width: number): string[] {
        return lumenHeader(theme, width);
      },
      invalidate() {
        // No cached state to clear.
      },
    };
  });
}

// ── extension entry point ───────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    applyLumenHeader(ctx);
  });

  pi.registerCommand("lumen-header", {
    description: "Restore the LUMEN custom header",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("LUMEN header is only available in TUI mode.", "warning");
        return;
      }

      applyLumenHeader(ctx);
      ctx.ui.notify("LUMEN header enabled", "info");
    },
  });

  pi.registerCommand("default-header", {
    description: "Restore the default Pi header",
    handler: async (_args, ctx) => {
      ctx.ui.setHeader(undefined);
      ctx.ui.notify("Default Pi header restored", "info");
    },
  });
}
