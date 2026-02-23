// src/pages/AIChat.js
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Send, Square, Trash2, Sun, Moon,
  Copy, Check, ChevronDown, LogOut, Bot, User, Sparkles, MessageSquare,
} from "lucide-react";
import api from "../api/axiosConfig";
import { toast } from "react-toastify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./AIChat.css";

/* ─── Theme tokens ─── */
const DARK = {
  bg:           "#212121",
  sidebar:      "#171717",
  surface:      "#2f2f2f",
  border:       "#3f3f3f",
  text:         "#ececec",
  textMuted:    "#8e8ea0",
  textDim:      "#555566",
  inputBg:      "#2f2f2f",
  accent:       "#19c37d",
  userBubbleBg: "#2f2f2f",
  userBubbleBd: "#3f3f3f",
  avatarUser:   "#5436da",
};

const LIGHT = {
  bg:           "#ffffff",
  sidebar:      "#f7f7f8",
  surface:      "#f0f0f0",
  border:       "#e0e0e0",
  text:         "#0d0d0d",
  textMuted:    "#6e6e80",
  textDim:      "#b0b0b8",
  inputBg:      "#f4f4f4",
  accent:       "#10a37f",
  userBubbleBg: "#f0f0f0",
  userBubbleBd: "#e0e0e0",
  avatarUser:   "#5436da",
};

const SUGGESTIONS = [
  "Explain quantum computing in simple terms",
  "Write a Python function to reverse a string",
  "What are the best productivity habits?",
  "Help me draft a professional email",
];

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function AIChat() {
  const [input, setInput]         = useState("");
  const [messages, setMessages]   = useState([]);
  const [isTyping, setIsTyping]   = useState(false);
  const [darkMode, setDarkMode]   = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [confirmClear, setConfirmClear]   = useState(false);
  const [confirmExit, setConfirmExit]     = useState(false);
  const [listening, setListening]         = useState(false);
  const [copiedId, setCopiedId]           = useState(null);

  const messagesEndRef   = useRef(null);
  const textareaRef      = useRef(null);
  const chatContainerRef = useRef(null);
  const typingTimeouts   = useRef([]);
  const recognitionRef   = useRef(null);

  const C = darkMode ? DARK : LIGHT;

  /* ── Persist messages ── */
  useEffect(() => {
    const saved = localStorage.getItem("aiChatMessages");
    if (saved) setMessages(JSON.parse(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem("aiChatMessages", JSON.stringify(messages));
  }, [messages]);

  /* ── Speech recognition ── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onresult = (e) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) txt += e.results[i][0].transcript;
      if (txt) setInput(txt.trim());
    };
    recognitionRef.current = r;
  }, []);

  /* ── Auto scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, streaming]);

  /* ── Scroll button ── */
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const onScroll = () =>
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Textarea auto-resize ── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  /* ── Helpers ── */
  const doCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const stopGen = () => {
    typingTimeouts.current.forEach(clearTimeout);
    typingTimeouts.current = [];
    setStreaming(false);
    setIsTyping(false);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem("aiChatMessages");
    toast.info("Chat cleared");
    setConfirmClear(false);
  };

  /* ── Send message ── */
  const send = async (forced) => {
    const text = (forced || input).trim();
    if (!text) return;
    setMessages(p => [...p, { sender: "user", text, time: new Date().toISOString() }]);
    setInput("");
    try {
      setIsTyping(true);
      setStreaming(true);
      const res   = await api.post("/ai/chat", { message: text });
      const reply = res.data?.reply || "No response";
      setMessages(p => [...p, { sender: "ai", text: "", time: new Date().toISOString() }]);
      let cur = "";
      reply.split(" ").forEach((word, i, arr) => {
        const t = setTimeout(() => {
          if (i === 0) setIsTyping(false);
          cur += (i === 0 ? "" : " ") + word;
          setMessages(p => {
            const u = [...p];
            u[u.length - 1] = { sender: "ai", text: cur, time: u[u.length - 1].time };
            return u;
          });
          if (i === arr.length - 1) setStreaming(false);
        }, i * 30);
        typingTimeouts.current.push(t);
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to get AI response.");
      setMessages(p => [
        ...p,
        { sender: "ai", text: "Sorry, something went wrong.", time: new Date().toISOString() },
      ]);
      setIsTyping(false);
      setStreaming(false);
    }
  };

  const micToggle = () => {
    if (!recognitionRef.current) { toast.error("Voice not supported."); return; }
    if (listening) recognitionRef.current.stop();
    else { setInput(""); recognitionRef.current.start(); }
  };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <div className="aichat-root" style={{ backgroundColor: C.bg, color: C.text }}>

      {/* ══════ SIDEBAR ══════ */}
      <aside
        className="aichat-sidebar"
        style={{ backgroundColor: C.sidebar, borderRight: `1px solid ${C.border}` }}
      >
        {/* Logo row */}
        <div className="aichat-sidebar-logo-row">
          <div className="aichat-logo" style={{ backgroundColor: C.accent }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>AI Assistant</span>
        </div>

        {/* New chat */}
        <div style={{ padding: "0 10px 8px" }}>
          <button
            className="aichat-new-chat-btn"
            onClick={() => setConfirmClear(true)}
            style={{ border: `1px solid ${C.border}`, color: C.text }}
          >
            <MessageSquare size={16} />
            New chat
          </button>
        </div>

        {/* Recent history */}
        {messages.length > 0 && (
          <div style={{ padding: "8px 16px 4px" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              Today
            </p>
            <button
              className="aichat-sidebar-btn"
              style={{ color: C.textMuted }}
            >
              <MessageSquare size={14} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {messages.find(m => m.sender === "user")?.text?.slice(0, 26) || "Chat"}…
              </span>
            </button>
          </div>
        )}

        {/* Bottom controls */}
        <div style={{ marginTop: "auto", padding: "8px 10px 16px" }}>
          <button
            className="aichat-sidebar-btn"
            onClick={() => setDarkMode(p => !p)}
            style={{ color: C.textMuted }}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? "Light mode" : "Dark mode"}
          </button>
          <button
            className="aichat-sidebar-btn"
            onClick={() => setConfirmExit(true)}
            style={{ color: C.textMuted }}
          >
            <LogOut size={16} />
            Exit
          </button>
        </div>
      </aside>

      {/* ══════ MAIN ══════ */}
      <div className="aichat-main">

        {/* Mobile header */}
        <div
          className="aichat-mobile-header"
          style={{ backgroundColor: C.sidebar, borderBottom: `1px solid ${C.border}` }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ backgroundColor: C.accent, width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={13} color="#fff" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>AI Assistant</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="aichat-icon-btn" onClick={() => setDarkMode(p => !p)} style={{ color: C.textMuted }}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="aichat-icon-btn" onClick={() => setConfirmClear(true)} style={{ color: C.textMuted }}>
              <Trash2 size={18} />
            </button>
            <button className="aichat-icon-btn" onClick={() => setConfirmExit(true)} style={{ color: C.textMuted }}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* ── Messages scroll area ── */}
        <div className="aichat-messages-scroll" ref={chatContainerRef}>

          {messages.length === 0 ? (
            /* Empty / welcome state */
            <div className="aichat-empty">
              <div style={{ backgroundColor: C.accent, width: 56, height: 56, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                <Sparkles size={28} color="#fff" />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
                How can I help you today?
              </h1>
              <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>
                Ask me anything — I'm here to assist you.
              </p>
              <div className="aichat-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="aichat-suggestion-btn"
                    onClick={() => send(s)}
                    style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="aichat-messages-inner">
              {messages.map((msg, idx) => (
                <MessageRow
                  key={idx}
                  msg={msg}
                  idx={idx}
                  C={C}
                  copiedId={copiedId}
                  doCopy={doCopy}
                  fmtTime={fmtTime}
                />
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    className="aichat-typing-row"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="aichat-avatar" style={{ backgroundColor: C.accent }}>
                      <Bot size={15} color="#fff" />
                    </div>
                    <div className="aichat-typing-dots">
                      {[0, 0.18, 0.36].map((delay, i) => (
                        <motion.span
                          key={i}
                          className="aichat-typing-dot"
                          style={{ backgroundColor: C.textMuted }}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 0.9, delay }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Scroll-to-bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              className="aichat-scroll-btn"
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              style={{ backgroundColor: C.surface, borderColor: C.border, color: C.text }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <ChevronDown size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Input bar ── */}
        <div className="aichat-input-bar" style={{ backgroundColor: C.bg }}>
          <div className="aichat-input-inner">
            <div
              className="aichat-input-box"
              style={{ backgroundColor: C.inputBg, border: `1px solid ${C.border}` }}
            >
              <textarea
                ref={textareaRef}
                className="aichat-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Message AI Assistant…"
                rows={1}
                disabled={streaming}
                style={{ color: C.text }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isTyping && !streaming) send();
                  }
                }}
              />

              <div className="aichat-input-actions">
                <button
                  className="aichat-icon-btn"
                  onClick={micToggle}
                  title={listening ? "Stop listening" : "Voice input"}
                  style={{ color: listening ? C.accent : C.textDim }}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {streaming ? (
                  <motion.button
                    className="aichat-send-btn"
                    onClick={stopGen}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    style={{ backgroundColor: C.text }}
                    title="Stop generating"
                  >
                    <Square size={13} color={C.bg} fill={C.bg} />
                  </motion.button>
                ) : (
                  <motion.button
                    className="aichat-send-btn"
                    onClick={() => send()}
                    disabled={!input.trim()}
                    whileHover={input.trim() ? { scale: 1.08 } : {}}
                    whileTap={input.trim() ? { scale: 0.92 } : {}}
                    style={{
                      backgroundColor: input.trim() ? C.accent : C.surface,
                      opacity: input.trim() ? 1 : 0.45,
                    }}
                    title="Send"
                  >
                    <Send size={15} color="#fff" />
                  </motion.button>
                )}
              </div>
            </div>

            {/* Listening indicator */}
            <AnimatePresence>
              {listening && (
                <motion.div
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.span
                    style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: C.accent, display: "inline-block" }}
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                  <span style={{ fontSize: 12, color: C.accent }}>Listening…</span>
                </motion.div>
              )}
            </AnimatePresence>

            <p style={{ textAlign: "center", fontSize: 11, color: C.textDim, marginTop: 8 }}>
              AI can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>

      {/* ══════ MODALS ══════ */}
      <ConfirmModal
        isOpen={confirmClear}
        title="Clear conversation?"
        desc="This will permanently delete all messages in this chat."
        confirmLabel="Clear"
        onClose={() => setConfirmClear(false)}
        onConfirm={clearChat}
        C={C}
      />
      <ConfirmModal
        isOpen={confirmExit}
        title="Exit to Dashboard?"
        desc="Your chat history is saved locally and will be restored next time."
        confirmLabel="Exit"
        onClose={() => setConfirmExit(false)}
        onConfirm={() => { window.location.href = "/dashboard"; }}
        C={C}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   MESSAGE ROW
═══════════════════════════════════════════ */
function MessageRow({ msg, idx, C, copiedId, doCopy, fmtTime }) {
  const [hovered, setHovered] = useState(false);
  const isUser = msg.sender === "user";
  const msgCopyId  = `msg-${idx}`;
  const codeCopyId = `code-${idx}`;

  return (
    <motion.div
      className={`aichat-message-row ${isUser ? "user-row" : "ai-row"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div
        className="aichat-avatar"
        style={{ backgroundColor: isUser ? C.avatarUser : C.accent }}
      >
        {isUser
          ? <User size={15} color="#fff" />
          : <Bot  size={15} color="#fff" />}
      </div>

      {/* Content */}
      <div className="aichat-message-content">
        {isUser ? (
          <div
            className="aichat-user-bubble"
            style={{
              backgroundColor: C.userBubbleBg,
              border: `1px solid ${C.userBubbleBd}`,
              color: C.text,
            }}
          >
            {msg.text}
          </div>
        ) : (
          <div className="aichat-ai-text" style={{ color: C.text }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p:          ({ children }) => <p>{children}</p>,
                ul:         ({ children }) => <ul>{children}</ul>,
                ol:         ({ children }) => <ol>{children}</ol>,
                li:         ({ children }) => <li>{children}</li>,
                h1:         ({ children }) => <h1>{children}</h1>,
                h2:         ({ children }) => <h2>{children}</h2>,
                h3:         ({ children }) => <h3>{children}</h3>,
                strong:     ({ children }) => <strong>{children}</strong>,
                blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                code({ inline, children, ...props }) {
                  const codeText = String(children).replace(/\n$/, "");
                  if (inline) {
                    return (
                      <code
                        style={{
                          backgroundColor: C.bg === "#ffffff" ? "#f4f4f5" : "#1e1e1e",
                          color: C.accent,
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <div className="aichat-code-block">
                      <div className="aichat-code-header">
                        <span>code</span>
                        <button onClick={() => doCopy(codeText, codeCopyId)}>
                          {copiedId === codeCopyId
                            ? <><Check size={12} /> Copied</>
                            : <><Copy size={12} /> Copy code</>}
                        </button>
                      </div>
                      <pre><code {...props}>{children}</code></pre>
                    </div>
                  );
                },
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        )}

        {/* Hover actions */}
        <AnimatePresence>
          {hovered && msg.text && (
            <motion.div
              className="aichat-action-bar"
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <button
                className="aichat-action-btn"
                onClick={() => doCopy(msg.text, msgCopyId)}
                style={{ color: C.textMuted, borderColor: C.border, backgroundColor: C.surface }}
              >
                {copiedId === msgCopyId
                  ? <><Check size={12} /> Copied</>
                  : <><Copy size={12} /> Copy</>}
              </button>
              <span style={{ fontSize: 11, color: C.textDim }}>{fmtTime(msg.time)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════ */
function ConfirmModal({ isOpen, title, desc, confirmLabel, onClose, onConfirm, C }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="aichat-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="aichat-modal"
            style={{ backgroundColor: C.sidebar, borderColor: C.border }}
            initial={{ scale: 0.9, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{title}</h3>
            <p style={{ fontSize: 13, color: C.textMuted, margin: "6px 0 0" }}>{desc}</p>
            <div className="aichat-modal-actions">
              <button
                className="aichat-modal-cancel"
                onClick={onClose}
                style={{ color: C.text, borderColor: C.border, backgroundColor: C.surface }}
              >
                Cancel
              </button>
              <button className="aichat-modal-confirm" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}