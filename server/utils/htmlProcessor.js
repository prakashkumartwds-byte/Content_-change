const cheerio = require("cheerio");

const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "meta",
  "link",
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
  const $ = cheerio.load(String(html), {
    decodeEntities: false,
  });

  const textNodes = [];
  let idCounter = 0;

  function addNode(text, setter) {
    const clean = String(text || "").trim();

    if (clean.length > 1) {
      const id = `node-${idCounter++}`;
      setter(`__WCID_${id}__`);
      textNodes.push({ id, text: clean });
    }
  }

  function walk(el) {
    $(el)
      .contents()
      .each(function () {
        if (this.type === "text") {
          addNode(this.data, (marker) => {
            this.data = marker;
          });
        }

        if (this.type === "tag") {
          const tagName = (this.name || "").toLowerCase();

          // ❌ Important: DO NOT block head/meta/link now
          if (BLOCKED_TAGS.has(tagName)) return;

          // ALT extract
          const altText = $(this).attr("alt");
          if (typeof altText === "string") {
            addNode(altText, (marker) => {
              $(this).attr("alt", marker);
            });
          }

          // TITLE attr extract (tooltip)
          const titleAttr = $(this).attr("title");
          if (typeof titleAttr === "string") {
            addNode(titleAttr, (marker) => {
              $(this).attr("title", marker);
            });
          }

          walk(this);
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

function applyReplacements($, replacements = []) {
  const map = {};

  for (const r of replacements) {
    if (r && typeof r.id === "string" && typeof r.text === "string") {
      map[r.id] = r.text;
    }
  }

  // ✅ FULL HTML preserve (VERY IMPORTANT FIX)
  let output = $.html();

  for (const [id, text] of Object.entries(map)) {
    output = output
      .split(`__WCID_${id}__`)
      .join(escapeHtmlText(text));
  }

  // remove leftover markers
  output = output.replace(/__WCID_node-\d+__/g, "");

  return output.trim();
}

module.exports = {
  extractTextNodes,
  applyReplacements,
  countWords,
};
