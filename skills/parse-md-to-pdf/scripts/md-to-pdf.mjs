#!/usr/bin/env node

/**
 * Markdown-to-PDF Converter
 *
 * Converts a Markdown file to an A4-formatted PDF, preserving
 * rendered styling including Mermaid diagrams, syntax-highlighted
 * code blocks, tables, and GitHub Flavored Markdown.
 *
 * Usage:
 *   node md-to-pdf.mjs --input <file.md> [--output <file.pdf>] [--css <styles.css>]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import puppeteer from "puppeteer";

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------
function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) parsed.input = args[++i];
    else if (args[i] === "--output" && args[i + 1]) parsed.output = args[++i];
    else if (args[i] === "--css" && args[i + 1]) parsed.css = args[++i];
    else if (args[i] === "--help") {
      console.log(`
Markdown-to-PDF Converter

Usage:
  node md-to-pdf.mjs --input <file.md> [--output <file.pdf>] [--css <styles.css>]

Options:
  --input   Path to the input Markdown file (required)
  --output  Custom output path for the PDF (default: same as input with .pdf extension)
  --css     Path to a custom CSS stylesheet (default: built-in print-styles.css)
  --help    Show this help message
`);
      process.exit(0);
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------
function markdownToHtml(markdownContent) {
  // Store mermaid blocks to render later
  const mermaidBlocks = [];
  let mermaidIndex = 0;

  const marked = new Marked(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code, lang) {
        // Intercept mermaid blocks
        if (lang === "mermaid") {
          const placeholder = `<!--MERMAID_PLACEHOLDER_${mermaidIndex}-->`;
          mermaidBlocks.push({ index: mermaidIndex, code });
          mermaidIndex++;
          return placeholder;
        }
        // Syntax highlighting for everything else
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
    })
  );

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  let html = marked.parse(markdownContent);

  // Replace mermaid placeholders — unwrap them from <pre><code> since
  // marked-highlight wraps them, and we want raw divs for Mermaid rendering
  for (const block of mermaidBlocks) {
    const placeholder = `<!--MERMAID_PLACEHOLDER_${block.index}-->`;
    // The highlight callback returns the placeholder inside <pre><code>
    // We need to replace the entire <pre><code>…</code></pre> block
    const wrappedPattern = new RegExp(
      `<pre><code[^>]*>\\s*${placeholder.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*</code></pre>`,
      "g"
    );
    const mermaidDiv = `<div class="mermaid-container"><div class="mermaid">${escapeHtml(block.code)}</div></div>`;
    html = html.replace(wrappedPattern, mermaidDiv);
  }

  return { html, hasMermaid: mermaidBlocks.length > 0 };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Build full HTML document
// ---------------------------------------------------------------------------
function buildHtmlDocument(bodyHtml, cssContent, hasMermaid) {
  const mermaidScript = hasMermaid
    ? `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
       <script>
         mermaid.initialize({ startOnLoad: true, theme: 'default' });
       </script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${cssContent}</style>
  ${mermaidScript}
</head>
<body>
  <article>${bodyHtml}</article>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Render Mermaid + Generate PDF via Puppeteer
// ---------------------------------------------------------------------------
async function generatePdf(htmlContent, outputPath, hasMermaid) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  // Wait for Mermaid to finish rendering (if any)
  if (hasMermaid) {
    await page.waitForFunction(
      () => {
        const mermaidDivs = document.querySelectorAll(".mermaid");
        return (
          mermaidDivs.length === 0 ||
          Array.from(mermaidDivs).every(
            (div) => div.getAttribute("data-processed") === "true" || div.querySelector("svg")
          )
        );
      },
      { timeout: 30000 }
    );
    // Small extra delay for SVG finalization
    await new Promise((r) => setTimeout(r, 500));
  }

  await page.pdf({
    path: outputPath,
    format: "A4",
    margin: {
      top: "20mm",
      right: "15mm",
      bottom: "20mm",
      left: "15mm",
    },
    printBackground: true,
    preferCSSPageSize: false,
  });

  await browser.close();
  return outputPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    console.error("Error: --input argument is required.");
    console.error("Usage: node md-to-pdf.mjs --input <file.md>");
    process.exit(1);
  }

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = args.output
    ? path.resolve(args.output)
    : inputPath.replace(/\.md$/i, ".pdf");

  // Resolve CSS path (default: built-in print-styles.css)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const defaultCssPath = path.join(__dirname, "print-styles.css");
  const cssPath = args.css ? path.resolve(args.css) : defaultCssPath;

  if (!fs.existsSync(cssPath)) {
    console.error(`Error: CSS file not found: ${cssPath}`);
    process.exit(1);
  }

  console.log(`📄 Input:  ${inputPath}`);
  console.log(`📑 Output: ${outputPath}`);
  console.log(`🎨 CSS:    ${cssPath}`);
  console.log();

  // Read files
  const markdownContent = fs.readFileSync(inputPath, "utf-8");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  // Convert markdown → HTML
  console.log("⚙️  Parsing Markdown...");
  const { html, hasMermaid } = markdownToHtml(markdownContent);

  if (hasMermaid) {
    console.log("🧜 Mermaid diagrams detected — will render via headless browser");
  }

  // Build full HTML document
  const fullHtml = buildHtmlDocument(html, cssContent, hasMermaid);

  // Generate PDF
  console.log("🖨️  Generating PDF...");
  await generatePdf(fullHtml, outputPath, hasMermaid);

  console.log(`\n✅ PDF generated successfully: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
