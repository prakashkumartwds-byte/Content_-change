const cheerio = require("cheerio");

const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "meta",
  "link",
  "head",
  "title",
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

            // 🔥 no extra span, just marker
            this.data = `__WCID_${id}__`;

            textNodes.push({
              id,
              text: trimmedText,
            });
          }
        } else if (this.type === "tag") {
          const tagName = (this.name || "").toLowerCase();

          if (!BLOCKED_TAGS.has(tagName)) {
            walk(this);
          }
        }
      });
  }

  walk($.root());

  return {
    $,
    textNodes,
  };
}

function cleanAIText(text = "") {
  return String(text)
    // ❌ remove ALL tags from AI
    .replace(/<\/?[^>]+>/g, "")
    // normalize spacing
    .replace(/\s+/g, " ")
    .trim();
}

function removeWrapperTags(html = "") {
  return String(html)
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .replace(/<br\s*\/?>/gi, "") // remove <br>
    .trim();
}

function applyReplacements($, replacements = []) {
  const map = {};

  for (const r of replacements) {
    if (r && r.id && typeof r.text === "string") {
      map[r.id] = cleanAIText(r.text);
    }
  }

  let output = $.root().html() || "";

  for (const [id, text] of Object.entries(map)) {
    const marker = `__WCID_${id}__`;
    output = output.split(marker).join(text);
  }

  // remove leftover markers
  output = output.replace(/__WCID_node-\d+__/g, "");

  // 🔥 FINAL CLEAN
  output = removeWrapperTags(output);

  return output;
}

module.exports = {
  extractTextNodes,
  applyReplacements,
  countWords,
};