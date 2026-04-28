import { useState, useRef } from "react";
import { useEffect } from "react";
import axios from "axios";
import "./App.css";

const EXAMPLES = [
  "Make all text formal and professional",
  "Translate everything to Hindi",
  "Make the tone more friendly and casual",
  "Rewrite for a younger audience",
  "Make all headings more catchy and exciting",
  "Write like a human",
];

export default function App() {
  const [htmlInput, setHtmlInput] = useState("");
  const [instruction, setInstruction] = useState("");
  const [keyword, setKeyword] = useState("");
  const [keywordCount, setKeywordCount] = useState("");
  const [targetWords, setTargetWords] = useState("");
  const [outputHtml, setOutputHtml] = useState("");
  const [textNodes, setTextNodes] = useState([]);
  const [textNodeCount, setTextNodeCount] = useState(null);
  const [wordCount, setWordCount] = useState(0);
  const [originalWordCount, setOriginalWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("code");
  const [outputTab, setOutputTab] = useState("code");
  const [contentOutTab, setContentOutTab] = useState("diff");
  const [copied, setCopied] = useState(false);
  const [copiedModified, setCopiedModified] = useState(false);
  const [replacements, setReplacements] = useState([]);
  const [modifiedHtml, setModifiedHtml] = useState("");
  const [mode, setMode] = useState(null);
  const fileRef = useRef();

  const countWords = (nodes = []) =>
    nodes.reduce((total, node) => {
      return (
        total +
        String(node.text || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
      );
    }, 0);
  useEffect(() => {
    if (!htmlInput.trim()) {
      setWordCount(0);
      setTextNodeCount(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await axios.post("/api/preview", {
          html: htmlInput,
        });

        setTextNodeCount(res.data.count);
        setTextNodes(res.data.textNodes || []);
        setWordCount(res.data.wordCount || 0);
      } catch (e) {
        console.error("Auto preview error:", e.message);
      }
    }, 500); // debounce

    return () => clearTimeout(delayDebounce);
  }, [htmlInput]);
  const resetInputMeta = () => {
    setTextNodeCount(null);
    setTextNodes([]);
    setWordCount(0);
    setOriginalWordCount(0);
  };

  const getPayload = (extra = {}) => ({
    ...extra,
    keyword: keyword.trim(),
    keywordCount: Number(keywordCount) || 0,
    targetWords: Number(targetWords) || 0,
  });

  const handlePreview = async () => {
    if (!htmlInput.trim()) return setError("Please paste some HTML first.");
    setError("");
    setPreviewing(true);

    try {
      const res = await axios.post("/api/preview", { html: htmlInput });
      const nodes = res.data.textNodes || [];
      const wc = res.data.wordCount ?? countWords(nodes);

      setTextNodeCount(res.data.count);
      setTextNodes(nodes);
      setWordCount(wc);
      setOriginalWordCount(wc);
    } catch (e) {
      setError(e.response?.data?.error || "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleRewrite = async () => {
    if (!htmlInput.trim()) return setError("Please paste some HTML first.");

    const finalInstruction =
      instruction.trim() ||
      "Improve all visible text. Keep meaning the same, make it clean and professional.";

    setError("");
    setLoading(true);
    setMode("full");
    setOutputHtml("");
    setReplacements([]);
    setModifiedHtml("");

    try {
      const res = await axios.post(
        "/api/rewrite",
        getPayload({
          html: htmlInput,
          instruction: finalInstruction,
        }),
      );

      setOutputHtml(res.data.html || res.data.updatedHtml || "");
      setReplacements(res.data.replacements || []);
      setOriginalWordCount(res.data.originalWordCount || 0);
      setWordCount(res.data.wordCount || 0);
      setOutputTab("code");
    } catch (e) {
      setError(e.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleContentOnly = async () => {
    if (!htmlInput.trim()) return setError("Please paste some HTML first.");

    setError("");
    setLoadingContent(true);
    setMode("content");
    setOutputHtml("");
    setReplacements([]);
    setModifiedHtml("");
    setContentOutTab("diff");

    try {
      let nodes = textNodes;

      if (!nodes.length) {
        const pr = await axios.post("/api/preview", { html: htmlInput });
        nodes = pr.data.textNodes || [];
        setTextNodes(nodes);
        setTextNodeCount(pr.data.count);
        setOriginalWordCount(pr.data.wordCount ?? countWords(nodes));
      }

      const finalInstruction =
        instruction.trim() ||
        "Improve all visible text. Keep meaning the same, make it clean and professional.";

      const res = await axios.post(
        "/api/content-only",
        getPayload({
          html: htmlInput,
          instruction: finalInstruction,
        }),
      );

      setReplacements(res.data.replacements || []);
      setModifiedHtml(res.data.updatedHtml || res.data.html || "");
      setOriginalWordCount(res.data.originalWordCount || 0);
      setWordCount(res.data.wordCount || 0);
    } catch (e) {
      setError(e.response?.data?.error || "Something went wrong.");
    } finally {
      setLoadingContent(false);
    }
  };

  const ensureModifiedHtml = async () => {
    if (modifiedHtml) return modifiedHtml;
    setLoadingDownload(true);

    try {
      const res = await axios.post("/api/download", {
        html: htmlInput,
        replacements,
      });

      const html = res.data.html || res.data.updatedHtml || "";
      setModifiedHtml(html);
      return html;
    } catch (e) {
      setError(e.response?.data?.error || "Failed to build updated HTML.");
      return "";
    } finally {
      setLoadingDownload(false);
    }
  };

  const handleShowUpdatedHtml = async () => {
    setContentOutTab("html");
    await ensureModifiedHtml();
  };

  const handleShowUpdatedPreview = async () => {
    setContentOutTab("preview");
    await ensureModifiedHtml();
  };

  const handleDownloadModified = async () => {
    const html = modifiedHtml || (await ensureModifiedHtml());
    if (!html) return;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modified.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyModified = async () => {
    const html = modifiedHtml || (await ensureModifiedHtml());
    if (!html) return;

    navigator.clipboard.writeText(html);
    setCopiedModified(true);
    setTimeout(() => setCopiedModified(false), 2000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setHtmlInput(ev.target.result);
      resetInputMeta();
      setOutputHtml("");
      setModifiedHtml("");
      setReplacements([]);
      setMode(null);
    };
    reader.readAsText(file);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([outputHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rewritten.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = loading || loadingContent;

  const showCopyDownload =
    mode === "content" &&
    (contentOutTab === "html" || contentOutTab === "preview") &&
    modifiedHtml;

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          ⚡ WebContent<span>AI</span>
        </div>
        <div className="badge-gpt">GPT-4o Powered</div>
      </header>

      <section className="hero">
        <div className="hero-label">AI HTML Content Editor</div>
        <h1>
          Rewrite Website Content <span>Instantly</span>
        </h1>
        <p>
          Paste HTML · Give instruction · Get AI-rewritten text · No tags
          touched
        </p>
      </section>

      <div className="workspace">
        <div className="panel">
          <div className="panel-top">
            <span className="ptitle">📄 Input HTML</span>

            <div className="panel-btns">
              <button
                className="icobtn"
                onClick={() => fileRef.current.click()}
              >
                📂 Upload
              </button>

              <button
                className="icobtn red"
                onClick={() => {
                  setHtmlInput("");
                  resetInputMeta();
                  setOutputHtml("");
                  setModifiedHtml("");
                  setReplacements([]);
                  setMode(null);
                }}
              >
                🗑
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                hidden
              />
            </div>
          </div>

          <div className="tabrow">
            <button
              className={`tabbtn ${tab === "code" ? "active" : ""}`}
              onClick={() => setTab("code")}
            >
              Code
            </button>

            <button
              className={`tabbtn ${tab === "preview" ? "active" : ""}`}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
          </div>

          {tab === "code" ? (
            <textarea
              className="codebox"
              placeholder="Paste your HTML here..."
              value={htmlInput}
              onChange={(e) => {
                setHtmlInput(e.target.value);
                resetInputMeta();
              }}
              spellCheck={false}
            />
          ) : (
            <iframe
              className="previewbox"
              srcDoc={htmlInput}
              title="Input Preview"
              sandbox="allow-scripts"
            />
          )}

          <div className="panel-foot">
            <button
              className="outline-btn"
              onClick={handlePreview}
              disabled={previewing}
            >
              {previewing ? "⏳ Analyzing..." : "🔍 Analyze"}
            </button>

            {textNodeCount !== null && (
              <>
                <span className="ntag">{textNodeCount} text nodes found</span>
                <span className="ntag green">{wordCount} words</span>
              </>
            )}
          </div>
        </div>

        <div className="midcol">
          <div className="instrcard">
            <label className="instrlabel">
              ✏️ Your Instruction{" "}
              <span
                style={{
                  fontSize: "0.6rem",
                  color: "var(--accent3)",
                  marginLeft: "6px",
                }}
              >
                optional
              </span>
            </label>

            <textarea
              className="instrbox"
              placeholder="Optional: e.g. Translate to Hindi... (leave empty to auto-improve)"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />

            <div className="keyword-box">
              <input
                className="keyword-input"
                placeholder="Keyword e.g. Lipofit"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />

              <input
                className="keyword-count-input"
                type="number"
                min="0"
                placeholder="Times"
                value={keywordCount}
                onChange={(e) => setKeywordCount(e.target.value)}
              />
            </div>

            <div className="keyword-box">
              <input
                className="keyword-input"
                type="number"
                min="0"
                placeholder="Target words e.g. 750"
                value={targetWords}
                onChange={(e) => setTargetWords(e.target.value)}
              />
            </div>

            <div className="keyword-help">
              Optional: keyword count + total target words set kar sakte ho.
            </div>

            <div className="ex-label">⚡ Quick examples</div>

            <div className="exlist">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className={`exchip ${instruction === ex ? "sel" : ""}`}
                  onClick={() => setInstruction(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>

            <div className="btnstack">
              <button
                className="btn-full"
                onClick={handleRewrite}
                disabled={isLoading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Rewriting Full HTML…
                  </>
                ) : (
                  <>✨ Rewrite Full HTML</>
                )}
              </button>

              <button
                className="btn-content"
                onClick={handleContentOnly}
                disabled={isLoading}
              >
                {loadingContent ? (
                  <>
                    <span className="spinner dark" /> Changing Content…
                  </>
                ) : (
                  <>📝 Change Content Only</>
                )}
              </button>
            </div>

            {error && <div className="errbox">⚠️ {error}</div>}
          </div>

          {replacements.length > 0 && (
            <div className="statsrow">
              <div className="sstat">
                <div className="snum">{replacements.length}</div>
                <div className="slbl">Nodes</div>
              </div>

              <div className="sstat">
                <div className="snum">{originalWordCount}</div>
                <div className="slbl">Before Words</div>
              </div>

              <div className="sstat">
                <div className="snum">{wordCount}</div>
                <div className="slbl">After Words</div>
              </div>

              <div className="sstat">
                <div className="snum">{mode === "full" ? "Full" : "Text"}</div>
                <div className="slbl">Mode</div>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-top">
            <span className="ptitle">
              {mode === "content" ? "📝 Content Changes" : "🖥 Output HTML"}
            </span>

            <div className="panel-btns">
              {outputHtml && mode === "full" && (
                <>
                  <button className="icobtn" onClick={handleCopy}>
                    {copied ? "✅" : "📋 Copy"}
                  </button>

                  <button className="icobtn" onClick={handleDownload}>
                    💾 Download
                  </button>
                </>
              )}

              {showCopyDownload && (
                <>
                  <button className="icobtn green" onClick={handleCopyModified}>
                    {copiedModified ? "✅ Copied!" : "📋 Copy HTML"}
                  </button>

                  <button className="icobtn" onClick={handleDownloadModified}>
                    💾 Download
                  </button>
                </>
              )}
            </div>
          </div>

          {mode === "content" && replacements.length > 0 ? (
            <>
              <div className="tabrow">
                <button
                  className={`tabbtn ${
                    contentOutTab === "diff" ? "active" : ""
                  }`}
                  onClick={() => setContentOutTab("diff")}
                >
                  🔀 Changes
                </button>

                <button
                  className={`tabbtn ${
                    contentOutTab === "html" ? "active" : ""
                  }`}
                  onClick={handleShowUpdatedHtml}
                >
                  🖥 Updated HTML
                </button>

                <button
                  className={`tabbtn ${
                    contentOutTab === "preview" ? "active" : ""
                  }`}
                  onClick={handleShowUpdatedPreview}
                >
                  👁 Preview
                </button>
              </div>

              {contentOutTab === "diff" && (
                <div className="difftable">
                  <div className="diffhead">
                    <span>Original Text</span>
                    <span>AI Rewritten</span>
                  </div>

                  <div className="diffbody">
                    {replacements.map((r) => {
                      const orig = textNodes.find((n) => n.id === r.id);

                      return (
                        <div className="diffrow" key={r.id}>
                          <div className="dcell old">{orig?.text || "—"}</div>
                          <div className="dcell new">{r.text}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {contentOutTab === "html" &&
                (loadingDownload ? (
                  <div className="loading-html">⏳ Building updated HTML…</div>
                ) : (
                  <textarea
                    className="codebox"
                    value={modifiedHtml}
                    readOnly
                    spellCheck={false}
                    placeholder="Building updated HTML..."
                    onClick={(e) => e.target.select()}
                  />
                ))}

              {contentOutTab === "preview" &&
                (loadingDownload ? (
                  <div className="loading-html">⏳ Building preview…</div>
                ) : (
                  <iframe
                    className="previewbox"
                    srcDoc={modifiedHtml}
                    title="Updated Preview"
                    sandbox="allow-scripts"
                  />
                ))}

              <div className="panel-foot">
                {contentOutTab === "html" && modifiedHtml && (
                  <button className="copy-all-btn" onClick={handleCopyModified}>
                    {copiedModified ? "✅ Copied!" : "📋 Copy All HTML"}
                  </button>
                )}

                <span className="ntag green">
                  ✅ {replacements.length} changes applied
                </span>
                <span className="ntag">{wordCount} words</span>
              </div>
            </>
          ) : (
            <>
              <div className="tabrow">
                <button
                  className={`tabbtn ${outputTab === "code" ? "active" : ""}`}
                  onClick={() => setOutputTab("code")}
                >
                  Code
                </button>

                <button
                  className={`tabbtn ${
                    outputTab === "preview" ? "active" : ""
                  }`}
                  onClick={() => setOutputTab("preview")}
                >
                  Preview
                </button>
              </div>

              {outputTab === "code" ? (
                <textarea
                  className="codebox"
                  placeholder="AI output will appear here..."
                  value={outputHtml}
                  readOnly
                  spellCheck={false}
                />
              ) : (
                <iframe
                  className="previewbox"
                  srcDoc={outputHtml}
                  title="Output Preview"
                  sandbox="allow-scripts"
                />
              )}

              <div className="panel-foot">
                {outputHtml ? (
                  <>
                    <span className="ntag green">✅ Complete</span>
                    <span className="ntag">{wordCount} words</span>
                  </>
                ) : (
                  <span className="muted">
                    Output will appear after rewriting
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="footer">WebContentAI © 2025 — OpenAI GPT-4o</footer>
    </div>
  );
}
