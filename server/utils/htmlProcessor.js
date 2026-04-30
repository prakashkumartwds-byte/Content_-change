const cheerio = require("cheerio");

const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "meta",
  "link",
  "head",
  // ✅ "title" HATAYA — ab <title> tag ka text bhi extract hoga
  "svg",
  "canvas",
  "iframe",
  "object",
  "embed",
]);

function countWords(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function extractTextNodes(html = "") {
  const $ = cheerio.load(html, { decodeEntities: false }, false);

  const textNodes = [];
  let idCounter = 0;

  function walk(el) {
    $(el)
      .contents()
      .each(function () {
        if (this.type === "text") {
          const originalText = this.data || "";
          const trimmedText = originalText.trim();

          if (trimmedText.length > 1) {
            const id = `node-${idCounter++}`;
            this.data = `__WCID_${id}__`;
            textNodes.push({ id, text: trimmedText });
          }
        } else if (this.type === "tag") {
          const tagName = (this.name || "").toLowerCase();

          if (!BLOCKED_TAGS.has(tagName)) {
            // ✅ Alt attribute extract karo
            const altText = $(this).attr("alt");
            if (typeof altText === "string" && altText.trim().length > 1) {
              const id = `node-${idCounter++}`;
              $(this).attr("alt", `__WCID_${id}__`);
              textNodes.push({ id, text: altText.trim() });
            }

            // ✅ Title attribute extract karo (tooltip wala, <title> tag nahi)
            const titleAttr = $(this).attr("title");
            if (typeof titleAttr === "string" && titleAttr.trim().length > 1) {
              const id = `node-${idCounter++}`;
              $(this).attr("title", `__WCID_${id}__`);
              textNodes.push({ id, text: titleAttr.trim() });
            }

            walk(this);
          }
        }
      });
  }

  walk($.root());

  return { $, textNodes };
}

function escapeHtmlText(text = "") {
  return String(text)
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function removeWrapperTags(html = "") {
  return String(html)
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<head[^>]*>/gi, "")
    .replace(/<\/head>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .trim();
}

function applyReplacements($, replacements = []) {
  const map = {};

  for (const r of replacements) {
    if (r && r.id && typeof r.text === "string") {
      map[r.id] = r.text;
    }
  }

  let output = $.root().html() || "";

  for (const [id, text] of Object.entries(map)) {
    output = output
      .split(`__WCID_${id}__`)
      .join(escapeHtmlText(text));
  }

  // ✅ Leftover markers hatao — alt/title markers bhi
  output = output.replace(/__WCID_node-\d+__/g, "");
  output = removeWrapperTags(output);

  return output;
}

module.exports = {
  extractTextNodes,
  applyReplacements,
  countWords,
};