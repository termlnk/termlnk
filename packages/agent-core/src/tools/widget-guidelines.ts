/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export type WidgetGuidelineModule = 'art' | 'mockup' | 'interactive' | 'chart' | 'diagram';

export const WIDGET_GUIDELINE_MODULES: readonly WidgetGuidelineModule[] = [
  'art',
  'mockup',
  'interactive',
  'chart',
  'diagram',
];

const BASE_GUIDELINE = `# Termlnk Widget Renderer — Visual Creation Guide

You produce inline interactive HTML/SVG widgets that render directly in chat via the \`termlnk_widget_renderer\` tool.

## Output contract

- The \`html\` argument is a **self-contained fragment**. Do NOT include \`<!DOCTYPE>\`, \`<html>\`, \`<head>\`, or \`<body>\` — the host wraps your fragment.
- The fragment is mounted into a sandboxed iframe. Cross-origin: it cannot access the parent window directly; only the bridge APIs below are available.
- Inline styles or a single \`<style>\` block are both fine. Inline \`<script>\` is allowed.
- Scripts run **only after streaming completes**, so DOM-mutating event handlers always see a fully rendered tree.

## Theming — use base46 CSS variables

The host injects the active base46 theme as CSS custom properties on \`:root\`. Always reference colors via \`var(--tm-*)\`. Never hardcode hex/rgb.

**Backgrounds (dark→light gradient):**
\`var(--tm-darker-black)\` · \`var(--tm-black)\` (page bg) · \`var(--tm-black2)\` · \`var(--tm-one-bg)\` (cards) · \`var(--tm-one-bg2)\` (hover) · \`var(--tm-one-bg3)\` (active)

**Foregrounds (use \`--tm-white\` for primary text — it is high-contrast in BOTH dark and light themes; \`--tm-light-grey\` is muted in light themes):**
\`var(--tm-grey)\` (disabled) · \`var(--tm-grey-fg)\` (tertiary) · \`var(--tm-grey-fg2)\` (tertiary) · \`var(--tm-light-grey)\` (secondary text) · \`var(--tm-white)\` (**primary text — always use this for headings, body copy, emphasized values**)

**Contrast rule:** Never combine \`--tm-light-grey\`/\`--tm-grey-fg\` text on \`--tm-one-bg\` / \`--tm-black2\` backgrounds. Light themes invert these into similar mid-greys and the result is unreadable. Stick to \`--tm-white\` for anything the user must read.

**Semantic / accent:**
\`var(--tm-blue)\` · \`var(--tm-nord-blue)\` · \`var(--tm-cyan)\` · \`var(--tm-teal)\` · \`var(--tm-green)\` · \`var(--tm-vibrant-green)\` · \`var(--tm-yellow)\` · \`var(--tm-sun)\` · \`var(--tm-orange)\` · \`var(--tm-red)\` · \`var(--tm-pink)\` · \`var(--tm-baby-pink)\` · \`var(--tm-purple)\` · \`var(--tm-dark-purple)\` · \`var(--tm-line)\` (borders)

For tinted/transparent variants use \`color-mix(in srgb, var(--tm-blue) 20%, transparent)\` — do not invent rgba constants.

## Bridge APIs (available inside the iframe)

- \`window.sendPrompt(text)\` — submits \`text\` as a new user message in the host chat. Use for "tell me more", "explain step 3", drill-down questions.
- \`window.openLink(url)\` — opens \`url\` in the system browser. \`<a href="https://...">\` clicks are auto-intercepted; you only need this for programmatic navigation.
- \`<a target="_blank">\` works as expected.

## Visual quality bar

- Background of widget root must be transparent or a base46 surface — the widget sits inline with the chat, not in a card.
- Border radius: \`8px\` (small), \`12px\` (default), \`16px\` (large). Borders: always \`1px solid var(--tm-line)\`.
- Spacing: 4px grid only — \`4 / 8 / 12 / 16 / 24 / 32px\`. Avoid 5/7/15/etc.
- Typography: inherit \`font-family\` from the host (do not override). One headline size + one body size per widget.
- Animations: subtle (≤300ms ease) and respect \`prefers-reduced-motion\`.

## What to avoid

- Loading large external libraries unnecessarily — prefer hand-rolled SVG/CSS for diagrams under ~30 nodes.
- Putting comparison tables, long prose, or full code listings inside the widget — those belong in chat text. Widgets are for **visual structure** + **interaction**.
- Multiple top-level fragments per call — one widget per \`termlnk_widget_renderer\` call.
- Calling \`termlnk_widget_renderer\` to display static text. If there is no visual or interactive value, just write the text in chat.
`;

const MODULE_GUIDELINES: Record<WidgetGuidelineModule, string> = {
  diagram: `## Module: diagram (SVG flowcharts, architecture, illustrative diagrams)

- Standard canvas: \`viewBox="0 0 900 H"\` where H is computed from the bottom-most element + 20px padding.
- Stroke width \`1.5px\` for edges; \`2px\` only for emphasized paths.
- Box height: \`56px\` standard, \`72px\` for boxes that contain a title + subtitle.
- Each box: \`<rect>\` with \`fill="var(--tm-one-bg)"\` and \`stroke="var(--tm-line)"\`, \`rx="8"\`. Title text \`var(--tm-white)\`, subtitle \`var(--tm-light-grey)\`.
- Edges: paths/lines with \`stroke="var(--tm-grey-fg2)"\`, optional arrowhead via \`<marker>\`.
- Limit to ≤4 boxes per horizontal tier at full width. 5+ → wrap to a second row OR shrink box width OR split into overview + detail.
- Avoid more than 2 accent colors total — pick one for emphasized state and one for warnings.
- Subtitles inside boxes: ≤5 words. Detail goes in click-throughs (\`onclick="sendPrompt('explain step 3')"\`).
- One \`<svg>\` per fragment. No abandoned partial SVG.`,

  mockup: `## Module: mockup (UI cards, forms, dashboards)

- Default container: padding \`16px\`, \`background: var(--tm-one-bg)\`, \`border: 1px solid var(--tm-line)\`, \`border-radius: 12px\`.
- Form controls: \`<input>\` / \`<textarea>\` / \`<select>\` should use \`background: var(--tm-black2)\`, \`color: var(--tm-white)\`, \`border: 1px solid var(--tm-line)\`, \`border-radius: 6px\`, \`padding: 6px 10px\`. On focus, switch border to \`var(--tm-blue)\`.
- Buttons: primary uses \`background: var(--tm-blue); color: var(--tm-black)\`. Secondary uses \`background: transparent; color: var(--tm-white); border: 1px solid var(--tm-line)\`.
- Cards in a grid: \`display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;\`
- Always include hover states for interactive elements (\`:hover\` → \`background: var(--tm-one-bg2)\`).
- Use \`sendPrompt('show me X')\` on cards/buttons to drill down.`,

  interactive: `## Module: interactive (interactive explainers with controls)

- Wrap controls in a top bar: row of buttons / sliders / segmented controls, separated from the canvas with \`border-bottom: 1px solid var(--tm-line); padding-bottom: 12px;\`.
- Sliders: use native \`<input type="range">\`, the host provides default styling.
- Toggles: \`<button aria-pressed="true|false">\` — pressed state uses \`background: var(--tm-blue); color: var(--tm-black)\`.
- All event handlers must be defined inline or in a \`<script>\` at the end of the fragment. They run after streaming completes.
- For long-running animations use \`requestAnimationFrame\` and respect \`window.matchMedia('(prefers-reduced-motion: reduce)').matches\`.
- Provide a "Reset" or "Step" button so the user can re-trigger the demo without re-asking the assistant.
- Use \`sendPrompt(...)\` to escalate ("Why does X happen?") rather than embedding pages of text.`,

  chart: `## Module: chart (data charts and analytics)

- Prefer the dedicated \`termlnk_pie_chart\` / \`termlnk_bar_chart\` tools when the data is a flat \`[{label, value}]\` series — they render as native React components with theme-aware colors and tooltips.
- Use \`termlnk_widget_renderer\` only for chart types not covered (line, scatter, heatmap, sparkline, multi-series).
- Color rotation: cycle through \`var(--tm-blue)\`, \`var(--tm-green)\`, \`var(--tm-yellow)\`, \`var(--tm-purple)\`, \`var(--tm-cyan)\`, \`var(--tm-orange)\`, \`var(--tm-red)\`, \`var(--tm-teal)\`. Don't invent palettes.
- Axis labels: \`var(--tm-grey-fg2)\` at 11px. Gridlines: \`stroke="var(--tm-line)" stroke-dasharray="2 4"\`.
- Hover tooltip: small box with \`background: var(--tm-black2); border: 1px solid var(--tm-line); padding: 4px 8px;\`.
- For charts > 12 data points, consider scrolling or aggregation — don't squish.`,

  art: `## Module: art (decorative, generative, illustration)

- This module relaxes the structural rules; treat the widget as a canvas.
- Still use base46 colors via \`var(--tm-*)\`. The widget should harmonize with the surrounding chat.
- Animation is encouraged here, but always honor \`prefers-reduced-motion\`.
- Keep DOM nodes under ~500 — heavy generative art belongs in a separate full-page tool, not inline.`,
};

export function buildGuidelines(modules?: readonly WidgetGuidelineModule[]): string {
  const requested = modules?.length
    ? modules.filter((m): m is WidgetGuidelineModule => WIDGET_GUIDELINE_MODULES.includes(m))
    : [];
  const seen = new Set<WidgetGuidelineModule>();
  const sections: string[] = [BASE_GUIDELINE];
  for (const mod of requested) {
    if (seen.has(mod)) {
      continue;
    }
    seen.add(mod);
    sections.push(MODULE_GUIDELINES[mod]);
  }
  return sections.join('\n\n');
}
