const OpenAI = require("openai");

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY missing in .env file!");
    }

    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return _client;
}

function extractJson(text) {
  return String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function countWords(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function countWordsFromReplacements(replacements = []) {
  return replacements.reduce((total, item) => {
    return total + countWords(item.text);
  }, 0);
}

function countKeywordFromReplacements(replacements = [], keyword = "") {
  const cleanKeyword = String(keyword || "").trim();
  if (!cleanKeyword) return 0;

  const allText = replacements.map((r) => r.text || "").join(" ");
  const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");

  return (allText.match(regex) || []).length;
}

const SYSTEM_PROMPT = `You are a strict HTML visible-text editor.

RULES:
- Return ONLY valid JSON array.
- Format: [{"id":"node-0","text":"rewritten text"}]
- Do NOT return HTML.
- Do NOT edit attributes.
- Only rewrite visible text.
- Keep same ids.
- Do not skip ids.
- Do not add extra ids.
- Keep buttons, menus, footer links, tiny labels short.
- Adjust content length according to target words.
- Use keyword count as close as possible.
- Always produce slightly different wording each time.`;

// 🔥 AI CALL
async function askAI(prompt) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.8, // 🔥 randomness added
  });

  const raw = response.choices?.[0]?.message?.content || "";
  const cleaned = extractJson(raw);

  try {
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error("AI response is not array");
    }

    return parsed;
  } catch (err) {
    console.error("AI RAW RESPONSE:", raw);
    throw new Error("AI returned invalid JSON");
  }
}

async function getContentReplacements({
  instruction,
  textNodes,
  keyword,
  keywordCount,
  targetWords,
}) {
  const safeTextNodes = (textNodes || []).map((item) => ({
    id: item.id,
    text: String(item.text || "").trim(),
  }));

  const userInstruction =
    instruction && instruction.trim()
      ? instruction.trim()
      : "Improve all visible text. Keep meaning the same, make it clean and professional.";

  const cleanKeyword = String(keyword || "").trim();
  const targetKeywordCount = Number(keywordCount) || 0;
  const cleanTargetWords = Number(targetWords) || 0;

  const minWords =
    cleanTargetWords > 0 ? Math.floor(cleanTargetWords * 0.9) : 0;

  const maxWords =
    cleanTargetWords > 0 ? Math.ceil(cleanTargetWords * 1.1) : 0;

  const keywordRule =
    cleanKeyword && targetKeywordCount > 0
      ? `
KEYWORD RULE:
Use "${cleanKeyword}" around ${targetKeywordCount} times naturally.
`
      : "";

  const wordRule =
    cleanTargetWords > 0
      ? `
WORD COUNT RULE:
Target: ${cleanTargetWords} words
Range: ${minWords} - ${maxWords}

Expand or shorten content accordingly.
`
      : "";

  // 🔥 RANDOM SEED (every click different)
  const variationSeed = `${Date.now()}-${Math.random()}`;

  const prompt = `
Task:
${userInstruction}

Variation seed: ${variationSeed}
Rewrite differently every time with new phrasing.

${keywordRule}
${wordRule}

Text nodes:
${JSON.stringify(safeTextNodes, null, 2)}

Return ONLY JSON array.
`;

  let replacements = await askAI(prompt);

  const currentWords = countWordsFromReplacements(replacements);
  const currentKeywordCount = countKeywordFromReplacements(
    replacements,
    cleanKeyword
  );

  const wordBad =
    cleanTargetWords > 0 &&
    (currentWords < minWords || currentWords > maxWords);

  const keywordBad =
    cleanKeyword && targetKeywordCount > 0
      ? Math.abs(currentKeywordCount - targetKeywordCount) > 3
      : false;

  // 🔥 SINGLE FAST REPAIR
  if (wordBad || keywordBad) {
    const repairPrompt = `
Fix the output.

Current words: ${currentWords}
Target: ${cleanTargetWords}

Current keyword count: ${currentKeywordCount}
Target keyword: ${targetKeywordCount}

Adjust content accordingly.

Return ONLY JSON array.
Same ids only.
`;

    replacements = await askAI(repairPrompt);
  }

  return replacements;
}

module.exports = {
  getContentReplacements,
};