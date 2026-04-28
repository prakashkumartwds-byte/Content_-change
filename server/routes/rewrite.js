const express = require("express");
const router = express.Router();

const {
  extractTextNodes,
  applyReplacements,
} = require("../utils/htmlProcessor");

const {
  getContentReplacements,
} = require("../utils/openaiHelper");

function countWordsFromText(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function countWordsFromNodes(nodes = []) {
  return nodes.reduce((total, node) => {
    return total + countWordsFromText(node.text);
  }, 0);
}

function countWordsFromReplacements(replacements = []) {
  return replacements.reduce((total, item) => {
    return total + countWordsFromText(item.text);
  }, 0);
}

async function generateUpdatedHtml({
  html,
  instruction,
  keyword,
  keywordCount,
  targetWords,
}) {
  const { $, textNodes } = extractTextNodes(html);

  if (!textNodes.length) {
    return {
      updatedHtml: html,
      replacements: [],
      count: 0,
      wordCount: 0,
      textNodes: [],
    };
  }

  // ✅ IMPORTANT: send ALL text nodes together
  // ❌ No chunking here
  const replacements = await getContentReplacements({
    instruction,
    textNodes,
    keyword,
    keywordCount,
    targetWords,
  });

  const updatedHtml = applyReplacements($, replacements);
  const wordCount = countWordsFromReplacements(replacements);

  return {
    updatedHtml,
    replacements,
    count: replacements.length,
    wordCount,
    textNodes,
  };
}

// POST /api/preview
router.post("/preview", async (req, res) => {
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: "html is required",
      });
    }

    const { textNodes } = extractTextNodes(html);

    return res.json({
      success: true,
      count: textNodes.length,
      textNodes,
      wordCount: countWordsFromNodes(textNodes),
    });
  } catch (err) {
    console.error("Preview error:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Preview failed",
    });
  }
});

// POST /api/rewrite
router.post("/rewrite", async (req, res) => {
  try {
    const {
      html,
      instruction,
      keyword,
      keywordCount,
      targetWords,
    } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: "html is required",
      });
    }

    const finalInstruction =
      instruction ||
      "Improve all visible text. Keep meaning the same, make it clean and professional.";

    const result = await generateUpdatedHtml({
      html,
      instruction: finalInstruction,
      keyword,
      keywordCount,
      targetWords,
    });

    return res.json({
      success: true,
      html: result.updatedHtml,
      updatedHtml: result.updatedHtml,
      replacements: result.replacements,
      count: result.count,
      wordCount: result.wordCount,
    });
  } catch (err) {
    console.error("Rewrite error:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Rewrite failed",
    });
  }
});

// POST /api/content-only
router.post("/content-only", async (req, res) => {
  try {
    const {
      html,
      instruction,
      keyword,
      keywordCount,
      targetWords,
    } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: "html is required",
      });
    }

    const finalInstruction =
      instruction ||
      "Improve all visible text. Keep meaning the same, make it clean and professional.";

    const result = await generateUpdatedHtml({
      html,
      instruction: finalInstruction,
      keyword,
      keywordCount,
      targetWords,
    });

    return res.json({
      success: true,
      html: result.updatedHtml,
      updatedHtml: result.updatedHtml,
      replacements: result.replacements,
      count: result.count,
      wordCount: result.wordCount,
    });
  } catch (err) {
    console.error("Content-only error:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Content-only failed",
    });
  }
});

// POST /api/download
router.post("/download", async (req, res) => {
  try {
    const { html, replacements } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: "html is required",
      });
    }

    if (!Array.isArray(replacements)) {
      return res.status(400).json({
        success: false,
        error: "replacements must be an array",
      });
    }

    const { $ } = extractTextNodes(html);
    const updatedHtml = applyReplacements($, replacements);

    return res.json({
      success: true,
      html: updatedHtml,
      updatedHtml,
      wordCount: countWordsFromReplacements(replacements),
    });
  } catch (err) {
    console.error("Download error:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Download failed",
    });
  }
});

module.exports = router;