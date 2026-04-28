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

const INLINE_TAGS = new Set([
  "a",
  "strong",
  "b",
  "em",
  "i",
  "span",
  "small",
  "mark",
  "u",
]);

function isFullHtmlDocument(html) {
  return /<!doctype\s+html/i.test(html) || /<html[\s>]/i.test(html);
}

function countWords(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function extractTextNodes(html) {
  const fullDocument = isFullHtmlDocument(html);

  const $ = cheerio.load(html, {
    decodeEntities: false,
    xmlMode: false,
  });

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

            const span = $("<span></span>")
              .attr("data-wcid", id)
              .text(originalText);

            $(this).replaceWith(span);

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
    fullDocument,
  };
}

function applyReplacements($, replacements = []) {
  const map = {};

  for (const r of replacements) {
    if (r && r.id && typeof r.text === "string") {
      map[r.id] = r.text;
    }
  }

  $("[data-wcid]").each(function () {
    const id = $(this).attr("data-wcid");

    let newText = Object.prototype.hasOwnProperty.call(map, id)
      ? map[id]
      : $(this).text();

    const prev = this.prev;
    const next = this.next;

    const prevIsInlineTag =
      prev &&
      prev.type === "tag" &&
      INLINE_TAGS.has((prev.name || "").toLowerCase());

    const nextIsInlineTag =
      next &&
      next.type === "tag" &&
      INLINE_TAGS.has((next.name || "").toLowerCase());

    if (prevIsInlineTag && !newText.startsWith(" ")) {
      newText = " " + newText;
    }

    if (nextIsInlineTag && !newText.endsWith(" ")) {
      newText = newText + " ";
    }

    $(this).replaceWith(newText);
  });

  return $.html();
}

module.exports = {
  extractTextNodes,
  applyReplacements,
  countWords,
};