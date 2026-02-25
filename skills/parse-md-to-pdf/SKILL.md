---
name: parse-md-to-pdf
description: Convert Markdown files to print-ready A4 PDF documents preserving rendered formatting. Supports Mermaid diagrams, syntax-highlighted code blocks, tables, and GitHub-Flavored Markdown. This skill should be used when the user wants to "convert markdown to PDF", "print a markdown file", "export md as PDF", "generate PDF from markdown", or "send markdown to printer".
---

# Parse Md To Pdf

Convert Markdown files — including Mermaid diagrams, code blocks, and tables — into A4-formatted PDFs suitable for printing. The output preserves rendered markdown styling (headings, lists, blockquotes, syntax highlighting) rather than raw text.

## When to Use

- Converting `.md` files to PDF for printing on A4 paper
- Exporting study guides, documentation, or notes as PDF
- Creating printable versions of markdown files that contain Mermaid diagrams
- Preparing markdown content for sharing as formatted documents

## Prerequisites

- **Node.js** (v18+) must be installed
- First run will auto-install dependencies via `npx` (may take a moment for Puppeteer/Chromium download)

## Conversion Workflow

### 1. Install Dependencies

To install the required npm packages, run the following from the project root:

```bash
cd .agent/skills/parse-md-to-pdf/scripts && npm install
```

This installs `marked`, `highlight.js`, `puppeteer`, and `mermaid` locally.

### 2. Run the Conversion

To convert a markdown file to PDF:

```bash
node .agent/skills/parse-md-to-pdf/scripts/md-to-pdf.mjs --input <path-to-md-file>
```

The PDF is saved alongside the input file with `.pdf` extension by default.

### 3. Available Options

| Flag         | Description                                      | Default                          |
|--------------|--------------------------------------------------|----------------------------------|
| `--input`    | Path to the input `.md` file (required)          | —                                |
| `--output`   | Custom output path for the PDF                   | Same as input, with `.pdf` ext   |
| `--css`      | Path to a custom CSS stylesheet                  | Built-in `print-styles.css`      |

### Examples

**Basic conversion:**
```bash
node .agent/skills/parse-md-to-pdf/scripts/md-to-pdf.mjs --input docs/my-notes.md
```

**Custom output path:**
```bash
node .agent/skills/parse-md-to-pdf/scripts/md-to-pdf.mjs --input docs/guide.md --output /tmp/guide.pdf
```

**Custom stylesheet:**
```bash
node .agent/skills/parse-md-to-pdf/scripts/md-to-pdf.mjs --input docs/guide.md --css my-styles.css
```

## How It Works

The conversion script (`scripts/md-to-pdf.mjs`) follows this pipeline:

1. **Read** the input Markdown file
2. **Parse** Markdown to HTML using `marked` with GitHub Flavored Markdown extensions (tables, task lists, strikethrough)
3. **Highlight** code blocks with `highlight.js` for syntax coloring
4. **Render Mermaid** diagrams: detect ` ```mermaid ` fenced blocks, render them as inline SVGs using Mermaid.js inside Puppeteer's headless browser
5. **Apply** the A4 print stylesheet (`scripts/print-styles.css`) — print-friendly colors, proper margins, page-break rules
6. **Generate PDF** via Puppeteer configured for A4 paper (210mm × 297mm) with 20mm margins

## Scripts

### `scripts/md-to-pdf.mjs`
The main conversion script. Execute directly with Node.js. Accepts `--input`, `--output`, and `--css` CLI arguments.

### `scripts/print-styles.css`
Default A4 print stylesheet with GitHub-flavored markdown styling, page-break management, and Mermaid SVG sizing. To customize the look, pass a different CSS file via `--css`.

## Agent Execution Notes

When running this script via `run_command`, Puppeteer-based commands must use **background execution** to avoid hanging. Send the command to background immediately and poll for completion:

1. Use `run_command` with `WaitMsBeforeAsync: 500` (sends to background immediately)
2. Use `command_status` with `WaitDurationSeconds: 60` to wait for completion

**Do NOT** use a large `WaitMsBeforeAsync` — Puppeteer will hang in synchronous mode.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Puppeteer fails to launch | Ensure no sandbox restrictions; try `--no-sandbox` flag in script |
| Mermaid diagrams not rendering | Verify Mermaid syntax in source file previews correctly online |
| PDF pages cut off content | Check `print-styles.css` page-break rules or reduce content width |
| First run is slow | Normal — Puppeteer downloads Chromium on first install |
