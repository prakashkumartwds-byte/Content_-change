const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is missing in .env");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getContentReplacements({
  textNodes = [],
  instruction = "",
  keyword = "",
  keywordCount = 0,
  targetWords = 0,
}) {
  if (!Array.isArray(textNodes) || textNodes.length === 0) return [];

  const nodesJson = JSON.stringify(
    textNodes.map((n) => ({
      id: String(n.id),
      text: String(n.text || ""),
    }))
  );

  let systemPrompt = `You are an expert HTML content rewriter.

You will receive a JSON array of text nodes extracted from a webpage.
Each node has an "id" and "text" field.

Your job:
Rewrite only the "text" value of every node according to the instruction.

Rules:
- Return ONLY valid JSON.
- Return ONLY a JSON array.
- No markdown.
- No explanation.
- No code blocks.
- Every object must have "id" and "text".
- Keep every "id" unchanged.
- Do NOT add HTML tags.
- Return the same number of nodes as input.`;

  if (keyword && Number(keywordCount) > 0) {
    systemPrompt += `\n- Naturally include keyword "${keyword}" exactly ${Number(
      keywordCount
    )} times across all rewritten text combined.`;
  }

  if (Number(targetWords) > 0) {
    systemPrompt += `\n- Total rewritten word count should be approximately ${Number(
      targetWords
    )} words.`;
  }

  const userPrompt = `Instruction:
${instruction || "Improve the text and keep the meaning same."}

Text nodes:
${nodesJson}

Return only JSON array.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices?.[0]?.message?.content || "[]";

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.text === "string"
    );
  } catch (err) {
    console.error("OpenAI error:", err);
    throw new Error("AI rewrite failed: " + (err.message || "Unknown error"));
  }
}

module.exports = {
  getContentReplacements,
};
