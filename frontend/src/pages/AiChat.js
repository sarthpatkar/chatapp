// src/pages/AIChat.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Send, Square, Trash2, Sun, Moon,
  Copy, Check, ChevronDown, LogOut,
  Sparkles, MessageSquare, AlertCircle, X,
} from "lucide-react";
import api from "../api/axiosConfig";
import { toast } from "react-toastify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─────────────────────────────────────────
   HELPERS: auth storage
   Login.jsx stores: localStorage.setItem("user", JSON.stringify(data))
   where data = { token, userId?, id?, ... }
   We derive both token & userId from that single key.
───────────────────────────────────────── */
const getAuthUser  = () => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } };
const getToken     = () => getAuthUser()?.token || null;
const getUserId    = () => { const u = getAuthUser(); return u?.userId || u?.id || null; };
const normalizeConversationId = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
const createConversationId = () =>
  `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const getConversationStorageKey = () => {
  const userId = getUserId();
  return userId ? `aiConversationId:${userId}` : "aiConversationId";
};
const getStoredConversationId = () =>
  normalizeConversationId(localStorage.getItem(getConversationStorageKey()));
const setStoredConversationId = (conversationId) => {
  const key = getConversationStorageKey();
  const normalized = normalizeConversationId(conversationId);
  if (normalized) localStorage.setItem(key, normalized);
  else localStorage.removeItem(key);
};
const getChatStorageKey = (conversationId) => {
  const userId = getUserId();
  const normalizedConversationId = normalizeConversationId(conversationId) || "legacy";
  return userId
    ? `aiChatMessages:${userId}:${normalizedConversationId}`
    : `aiChatMessages:${normalizedConversationId}`;
};
const getCachedMessages = (conversationId) => {
  try {
    const raw = localStorage.getItem(getChatStorageKey(conversationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const clearAuth    = () => {
  const userId = getUserId();
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem(getConversationStorageKey());
  if (userId) {
    const prefix = `aiChatMessages:${userId}:`;
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  }
};

/* ─── Theme tokens ─── */
const DARK = {
  bg:           "#0e0e10",
  sidebar:      "#141416",
  surface:      "#1c1c1f",
  surfaceHover: "#232328",
  border:       "#2a2a30",
  text:         "#eeeef0",
  textMuted:    "#8b8b99",
  textDim:      "#44444f",
  inputBg:      "#18181b",
  accent:       "#00d09c",
  accentDim:    "rgba(0,208,156,0.12)",
  accentGlow:   "rgba(0,208,156,0.25)",
  userBubbleBg: "#1e1e24",
  userBubbleBd: "#2e2e38",
  codeBg:       "#111115",
  codeHeader:   "#1a1a1f",
  danger:       "#ff5c5c",
};

const LIGHT = {
  bg:           "#fafafa",
  sidebar:      "#f2f2f5",
  surface:      "#e8e8ec",
  surfaceHover: "#dedee4",
  border:       "#d4d4dc",
  text:         "#111118",
  textMuted:    "#5f5f72",
  textDim:      "#b0b0bc",
  inputBg:      "#ffffff",
  accent:       "#00a87e",
  accentDim:    "rgba(0,168,126,0.10)",
  accentGlow:   "rgba(0,168,126,0.2)",
  userBubbleBg: "#ebebef",
  userBubbleBd: "#d8d8e0",
  codeBg:       "#f5f5f8",
  codeHeader:   "#ebebef",
  danger:       "#e03030",
};

const SUGGESTIONS = [
  "Compare Reliance vs TCS using P/E, EPS, and revenue growth",
  "How should I evaluate an NSE stock before buying?",
  "Explain stop-loss, risk-reward ratio, and position sizing",
  "How does RBI repo rate impact Indian markets?",
];

/* ═══════════════════════════════════════════
   INLINE STYLES (no external CSS needed)
═══════════════════════════════════════════ */
const FONT = "'DM Sans', 'Sora', sans-serif";

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function AIChat() {
  const initialConversationId = getStoredConversationId();
  const [input, setInput]         = useState("");
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages]   = useState(() => getCachedMessages(initialConversationId));
  const [recentConversations, setRecentConversations] = useState([]);
  const [darkMode, setDarkMode]   = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [confirmClear, setConfirmClear]   = useState(false);
  const [confirmExit, setConfirmExit]     = useState(false);
  const [listening, setListening]         = useState(false);
  const [copiedId, setCopiedId]           = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef   = useRef(null);
  const textareaRef      = useRef(null);
  const chatContainerRef = useRef(null);
  const readerRef        = useRef(null);
  const recognitionRef   = useRef(null);
  const isLoggingOut     = useRef(false); // prevents auth guard from interfering during logout

  const C = darkMode ? DARK : LIGHT;
  const chatStorageKey = getChatStorageKey(conversationId);

  /* ── Auth guard ── */
  useEffect(() => {
    if (
      !isLoggingOut.current &&
      (!getUserId() || !getToken()) &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.replace("/login");
    }
  }, []);

  const mapHistoryToMessages = (history) =>
    history.flatMap((item, i) => ([
      {
        id: `h-${i}-u`,
        sender: "user",
        text: item.message || "",
        time: item.createdAt || new Date().toISOString(),
      },
      {
        id: `h-${i}-a`,
        sender: "ai",
        text: item.response || "",
        model: item.modelUsed || "unknown",
        time: item.createdAt || new Date().toISOString(),
      },
    ]));

  const buildConversationSummaries = (history) => {
    const byConversation = new Map();
    for (const item of history || []) {
      const normalizedId = normalizeConversationId(item?.conversationId);
      if (!normalizedId) continue;

      const existing = byConversation.get(normalizedId) || {
        conversationId: normalizedId,
        preview: "Conversation",
        updatedAt: item?.createdAt || new Date().toISOString(),
      };

      const userText = (item?.message || "").trim();
      if (userText) {
        existing.preview = userText;
      }
      if (item?.createdAt) {
        existing.updatedAt = item.createdAt;
      }

      byConversation.set(normalizedId, existing);
    }

    return Array.from(byConversation.values())
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  };

  /* ── Persist selected conversation per user ── */
  useEffect(() => {
    setStoredConversationId(conversationId);
  }, [conversationId]);

  /* ── Load chat history for active conversation ── */
  useEffect(() => {
    const loadHistory = async () => {
      setHistoryLoaded(false);
      try {
        const res = await api.get("/api/chat/history");
        const history = res.data || [];
        setRecentConversations(buildConversationSummaries(history));

        if (conversationId) {
          const activeHistory = history.filter(
            (item) => normalizeConversationId(item.conversationId) === conversationId
          );
          setMessages(mapHistoryToMessages(activeHistory));
          return;
        }

        // Legacy bootstrap: no conversation selected yet.

        // If DB already has conversation IDs, resume latest conversation automatically.
        const latestConversationWithId = [...history]
          .reverse()
          .map((item) => normalizeConversationId(item.conversationId))
          .find(Boolean);
        if (latestConversationWithId) {
          setConversationId(latestConversationWithId);
          return;
        }

        // Fallback for older rows created before conversationId existed.
        const legacyOnly = history.filter((item) => !normalizeConversationId(item.conversationId));
        setMessages(mapHistoryToMessages(legacyOnly));
      } catch (err) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          clearAuth();
          window.location.replace("/login");
          return;
        }
        setRecentConversations([]);
        setMessages(getCachedMessages(conversationId));
      } finally {
        setHistoryLoaded(true);
      }
    };
    loadHistory();
  }, [conversationId]);

  /* ── Persist messages locally ONLY after history is loaded (no overwrite race) ── */
  useEffect(() => {
    if (!historyLoaded) return;
    localStorage.setItem(chatStorageKey, JSON.stringify(messages));
  }, [messages, historyLoaded, chatStorageKey]);

  /* ── Speech recognition ── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous     = false;
    r.interimResults = false;
    r.lang           = "en-US";
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
  }, [messages, streaming]);

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

  /* FIX: Actually cancel the fetch stream reader */
  const stopGen = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    setStreaming(false);
  }, []);

  const startNewConversation = () => {
    stopGen();
    const newConversationId = createConversationId();
    localStorage.removeItem(getChatStorageKey(newConversationId));
    setConversationId(newConversationId);
    setMessages([]);
    setRecentConversations((prev) => [
      {
        conversationId: newConversationId,
        preview: "New conversation",
        updatedAt: new Date().toISOString(),
      },
      ...prev.filter((item) => item.conversationId !== newConversationId),
    ]);
    toast.info("New conversation created");
  };

  const clearChat = async () => {
    try {
      await api.delete("/api/chat/history", {
        params: { conversationId: conversationId || "" },
      });
      setMessages([]);
      localStorage.removeItem(chatStorageKey);
      setRecentConversations((prev) =>
        prev.filter((item) => item.conversationId !== conversationId)
      );
      toast.info("Conversation history cleared");
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        clearAuth();
        window.location.replace("/login");
        return;
      }
      toast.error("Could not clear conversation history.");
    } finally {
      setConfirmClear(false);
    }
  };

  const logout = () => {
    isLoggingOut.current = true;   // block auth guard re-checks during logout
    setConfirmExit(false);         // close modal first
    stopGen();                     // cancel any active stream
    localStorage.removeItem(chatStorageKey);
    setStoredConversationId(null);
    clearAuth();                   // remove auth from localStorage
    setMessages([]);               // clear UI state

    // Force a full navigation to login page (avoids SPA state sticking)
    window.location.href = "/login";
  };

  /* ── Resolve API base URL reliably ── */
  const getBaseUrl = () => {
    // Priority 1: environment variable (recommended)
    const envUrl = process.env.REACT_APP_API_URL;
    if (envUrl) return envUrl.replace(/\/$/, "");

    // Priority 2: axios baseURL
    const fromAxios = api.defaults?.baseURL;
    if (fromAxios) return fromAxios.replace(/\/$/, "");

    // Priority 3: dev fallback (React :3000 → Spring :8080)
    const origin = window.location.origin;
    if (origin.includes(":3000")) return origin.replace(":3000", ":8080");

    return origin;
  };

  const normalizeErrorMessage = (payload) => {
    if (!payload) return null;
    if (typeof payload === "string") return payload;
    if (typeof payload === "object") {
      return (
        payload.message ||
        payload.error ||
        payload.detail ||
        payload.title ||
        null
      );
    }
    return null;
  };

  const cleanErrorMessage = (message) => {
    if (!message) return null;
    const singleLine = String(message).replace(/\s+/g, " ").trim();
    if (!singleLine) return null;
    if (singleLine.length <= 220) return singleLine;
    return `${singleLine.slice(0, 217)}...`;
  };

  const readFetchError = async (res) => {
    try {
      const raw = await res.text();
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return cleanErrorMessage(normalizeErrorMessage(parsed) || raw);
      } catch {
        return cleanErrorMessage(raw);
      }
    } catch {
      return null;
    }
  };

  /* ── Send message ── */
  const send = async (forced) => {
    const text = (forced || input).trim();
    if (!text || streaming) return;

    // FIX: extract token from unified "user" key
    const token = getToken();
    const activeConversationId = conversationId || createConversationId();
    if (!conversationId) {
      setConversationId(activeConversationId);
      setMessages([]);
    }
    const aiId  = `ai-${Date.now()}`;
    const createdAt = new Date().toISOString();
    if (!token) {
      toast.error("Session expired. Please log in again.");
      clearAuth();
      window.location.replace("/login");
      return;
    }

    setRecentConversations((prev) => {
      const withoutCurrent = prev.filter((item) => item.conversationId !== activeConversationId);
      return [
        {
          conversationId: activeConversationId,
          preview: text,
          updatedAt: createdAt,
        },
        ...withoutCurrent,
      ];
    });

    setMessages(prev => ([
      ...prev,
      { sender: "user", text, time: createdAt, id: `u-${aiId}` },
      { sender: "ai",   text: "",   time: createdAt, id: aiId,   streaming: true, model: "resolving..." },
    ]));
    setInput("");
    setStreaming(true);

    const markAiError = (message) => {
      const finalMessage = cleanErrorMessage(message) || "Something went wrong. Please try again.";
      setMessages(prev =>
        prev.map(m =>
          m.id === aiId
            ? { ...m, text: finalMessage, streaming: false, error: true }
            : m
        )
      );
    };

    try {
      const streamUrl = `${getBaseUrl()}/api/chat/stream`;
      const res = await fetch(streamUrl, {
        method: "POST",
        cache:  "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, conversationId: activeConversationId }),
      });

      if (res.body && res.ok) {
        const streamModel = (res.headers.get("X-AI-Model") || "").trim();
        if (streamModel) {
          setMessages(prev =>
            prev.map(m =>
              m.id === aiId ? { ...m, model: streamModel } : m
            )
          );
        }

        const reader  = res.body.getReader();
        readerRef.current = reader; // FIX: store so stopGen can cancel it
        const decoder = new TextDecoder();
        let buffer    = "";

        // ── FIX: SSE chunk parser ──
        // trimEnd() was eating trailing spaces that are word separators.
        // The backend sends lines like:  data: Hello  /  data: 👋  /  data:  How
        // We must NOT trim content after stripping the "data:" prefix.
        const handleChunk = (rawLine) => {
          const appendToAi = (token) => {
            if (!token) return;
            setMessages(prev =>
              prev.map(m =>
                m.id === aiId ? { ...m, text: m.text + token } : m
              )
            );
          };

          let content = rawLine;
          if (rawLine.startsWith("data: ")) {
            content = rawLine.slice(6); // strip exactly "data: " (6 chars), keep rest verbatim
          } else if (rawLine.startsWith("data:")) {
            content = rawLine.slice(5); // no space variant
          }

          // Skip SSE control lines and heartbeats
          if (content === "[DONE]" || rawLine.startsWith(":")) return;
          if (content === "\\n") { appendToAi("\n"); return; }
          if (content === "\\r") { appendToAi("\r"); return; }
          // Empty content after stripping prefix → skip
          if (content === "") return;

          // Re-encode any replacement chars from incomplete UTF-8 chunks
          // (emoji that were split across fetch chunks)
          const safe = content.replace(/\uFFFD/g, "");
          if (!safe) return;
          appendToAi(safe);
        };

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            // stream:true keeps decoder's internal buffer for multi-byte chars (emoji fix)
            buffer += decoder.decode(value, { stream: true });

            let nl;
            while ((nl = buffer.indexOf("\n")) >= 0) {
              // FIX: only strip \r (Windows line endings), NOT spaces — spaces are content
              const line = buffer.slice(0, nl).replace(/\r$/, "");
              buffer = buffer.slice(nl + 1);
              // Send line even if it looks "empty" after prefix strip — handleChunk decides
              if (line.length > 0) handleChunk(line);
            }
          }
          // Flush decoder's internal byte buffer (catches split emoji at end)
          buffer += decoder.decode();
          if (buffer.length > 0) handleChunk(buffer.replace(/\r$/, ""));
        } catch (readErr) {
          // Cancelled via stopGen → expected, swallow silently
          if (readErr?.name !== "AbortError" && readErr?.message !== "The reader was released") {
            console.warn("Stream read error:", readErr);
          }
        }

        readerRef.current = null;
        // Mark streaming done on the message
        setMessages(prev =>
          prev.map(m => m.id === aiId ? { ...m, streaming: false } : m)
        );
        setStreaming(false);
        return;
      }

      const streamError = await readFetchError(res);
      if (res.status === 401 || res.status === 403) {
        clearAuth();
        window.location.replace("/login");
        return;
      }

      try {
        // FALLBACK: normal JSON endpoint
        const fallback = await api.post("/api/chat", {
          message: text,
          conversationId: activeConversationId,
        });
        const reply = fallback.data?.response || fallback.data?.reply || "No response received.";
        const model = (fallback.data?.model || "unknown").trim();

        setMessages(prev =>
          prev.map(m =>
            m.id === aiId ? { ...m, text: reply, streaming: false, model } : m
          )
        );
      } catch (fallbackErr) {
        if (fallbackErr?.response?.status === 401 || fallbackErr?.response?.status === 403) {
          clearAuth();
          window.location.replace("/login");
          return;
        }

        const fallbackMessage = cleanErrorMessage(
          normalizeErrorMessage(fallbackErr?.response?.data) ||
          fallbackErr?.message ||
          streamError
        );
        throw new Error(fallbackMessage || "Something went wrong. Please try again.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          clearAuth();
          window.location.replace("/login");
          return;
        }

        const message = cleanErrorMessage(
          normalizeErrorMessage(err?.response?.data) ||
          err?.message
        );
        toast.error(message || "Failed to get a response. Please try again.");
        markAiError(message);
      }
    } finally {
      readerRef.current = null;
      setStreaming(false);
    }
  };

  const micToggle = () => {
    if (!recognitionRef.current) { toast.error("Voice input not supported in this browser."); return; }
    if (listening) recognitionRef.current.stop();
    else { setInput(""); recognitionRef.current.start(); }
  };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(128,128,160,0.2); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,160,0.35); }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2);opacity:0} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .msg-content p { margin: 0 0 10px; line-height: 1.72; }
        .msg-content p:last-child { margin-bottom: 0; }
        .msg-content ul, .msg-content ol { margin: 8px 0 10px 20px; }
        .msg-content li { margin-bottom: 4px; line-height: 1.65; }
        .msg-content h1,.msg-content h2,.msg-content h3 {
          margin: 14px 0 6px;
          font-family: 'Sora', sans-serif;
          line-height: 1.35;
          letter-spacing: -0.01em;
        }
        .msg-content h1 { font-size: 24px; font-weight: 700; }
        .msg-content h2 { font-size: 20px; font-weight: 700; }
        .msg-content h3 { font-size: 17px; font-weight: 600; }
        .msg-content strong { font-weight: 600; }
        .msg-content blockquote {
          border-left: 3px solid currentColor; padding-left: 14px;
          margin: 10px 0; opacity: 0.7; font-style: italic;
        }
        .msg-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 13.5px;
          line-height: 1.55;
        }
        .msg-content th, .msg-content td {
          border: 1px solid rgba(140,140,160,0.35);
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        .msg-content th {
          background: rgba(140,140,160,0.12);
          font-weight: 600;
        }
        .msg-content code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px; padding: 2px 6px; border-radius: 5px;
        }
        .msg-content pre { margin: 12px 0; }
        .msg-content pre code { padding: 0; background: none; }
        .cursor-blink::after {
          content: '▋';
          animation: blink 0.9s step-end infinite;
          font-weight: 100;
          opacity: 0.7;
        }
      `}</style>

      <div style={{ display: "flex", height: "100vh", fontFamily: FONT, backgroundColor: C.bg, color: C.text, overflow: "hidden", transition: "background 0.3s, color 0.3s" }}>

        {/* ══════ SIDEBAR ══════ */}
        <aside style={{
          width: 240,
          minWidth: 240,
          display: "flex",
          flexDirection: "column",
          backgroundColor: C.sidebar,
          borderRight: `1px solid ${C.border}`,
          transition: "background 0.3s, border 0.3s",
          zIndex: 10,
        }}>
          {/* Logo */}
          <div style={{ padding: "20px 16px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.accent} 0%, #6457f9 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 16px ${C.accentGlow}`,
              flexShrink: 0,
            }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, letterSpacing: "-0.02em" }}>
                AI Assistant
              </div>
              <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 1 }}>Powered by chatapp</div>
            </div>
          </div>

          {/* New chat button */}
          <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={startNewConversation}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "transparent", color: C.textMuted,
                cursor: "pointer", fontSize: 13, fontFamily: FONT, fontWeight: 500,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textMuted; }}
            >
              <MessageSquare size={15} />
              New conversation
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: "transparent", color: C.danger,
                cursor: "pointer", fontSize: 13, fontFamily: FONT, fontWeight: 500,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Trash2 size={15} />
              Clear chat history
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: C.border, margin: "0 16px 10px" }} />

          {/* Recent chats */}
          {recentConversations.length > 0 && (
            <div style={{ padding: "0 10px", flex: 1, overflow: "hidden" }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, paddingLeft: 4 }}>
                Recent
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: "100%" }}>
                {recentConversations.map((item) => {
                  const isActive = item.conversationId === conversationId;
                  const preview = (item.preview || "Conversation").slice(0, 38);
                  return (
                    <button
                      key={item.conversationId}
                      onClick={() => setConversationId(item.conversationId)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px", borderRadius: 8,
                        background: isActive ? C.accentDim : "transparent",
                        border: `1px solid ${isActive ? C.accentGlow : C.border}`,
                        color: C.text, cursor: "pointer", fontSize: 13,
                        fontFamily: FONT, textAlign: "left",
                      }}
                    >
                      <MessageSquare size={13} style={{ flexShrink: 0, color: isActive ? C.accent : C.textMuted }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5 }}>
                        {preview}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Bottom controls */}
          <div style={{ padding: "10px 10px 18px", borderTop: `1px solid ${C.border}` }}>
            <SidebarBtn icon={darkMode ? Sun : Moon} label={darkMode ? "Light mode" : "Dark mode"} onClick={() => setDarkMode(p => !p)} C={C} />
            <SidebarBtn icon={LogOut} label="Logout" onClick={() => setConfirmExit(true)} C={C} danger />
          </div>
        </aside>

        {/* ══════ MAIN AREA ══════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* Mobile header (hidden on desktop via media not available inline — keep minimal) */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            backgroundColor: C.sidebar,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div />
            <div style={{ display: "flex", gap: 4 }}>
              <IconBtn onClick={() => setDarkMode(p => !p)} C={C} title="Toggle theme">
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </IconBtn>
              <IconBtn onClick={() => setConfirmClear(true)} C={C} title="Clear chat">
                <Trash2 size={17} />
              </IconBtn>
              <IconBtn onClick={() => setConfirmExit(true)} C={C} title="Logout">
                <LogOut size={17} />
              </IconBtn>
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            ref={chatContainerRef}
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "24px 0" }}
          >
            {messages.length === 0 ? (
              <EmptyState C={C} onSuggest={send} />
            ) : (
              <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>
                {messages.map((msg, idx) => (
                  <MessageRow
                    key={msg.id || idx}
                    msg={msg}
                    idx={idx}
                    C={C}
                    copiedId={copiedId}
                    doCopy={doCopy}
                    fmtTime={fmtTime}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Scroll to bottom */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                style={{
                  position: "absolute", bottom: 100, right: 28, zIndex: 20,
                  width: 36, height: 36, borderRadius: "50%",
                  backgroundColor: C.surface, border: `1px solid ${C.border}`,
                  color: C.textMuted, cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                }}
              >
                <ChevronDown size={18} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Input bar ── */}
          <div style={{
            padding: "12px 20px 18px",
            backgroundColor: C.bg,
            borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>

              {/* Voice listening indicator */}
              <AnimatePresence>
                {listening && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 4 }}
                  >
                    <div style={{ position: "relative", width: 10, height: 10 }}>
                      <div style={{
                        position: "absolute", inset: 0, borderRadius: "50%",
                        backgroundColor: C.accent, animation: "pulse-ring 1.2s ease-out infinite",
                      }} />
                      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: C.accent }} />
                    </div>
                    <span style={{ fontSize: 12, color: C.accent, fontWeight: 500 }}>Listening…</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input box */}
              <div style={{
                display: "flex", alignItems: "flex-end", gap: 8,
                backgroundColor: C.inputBg,
                border: `1.5px solid ${C.border}`,
                borderRadius: 16,
                padding: "10px 10px 10px 16px",
                boxShadow: streaming ? `0 0 0 3px ${C.accentGlow}` : "0 2px 12px rgba(0,0,0,0.15)",
                transition: "box-shadow 0.2s, border 0.2s",
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask about NSE/BSE stocks or finance topics…"
                  rows={1}
                  disabled={streaming}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: C.text, fontSize: 14.5, fontFamily: FONT,
                    resize: "none", lineHeight: 1.6,
                    maxHeight: 200, overflowY: "auto",
                    opacity: streaming ? 0.55 : 1,
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!streaming) send();
                    }
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {/* Mic */}
                  <IconBtn
                    onClick={micToggle}
                    C={C}
                    title={listening ? "Stop" : "Voice input"}
                    style={{ color: listening ? C.accent : C.textDim }}
                  >
                    {listening ? <MicOff size={17} /> : <Mic size={17} />}
                  </IconBtn>

                  {/* Send / Stop */}
                  {streaming ? (
                    <motion.button
                      onClick={stopGen}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        backgroundColor: C.text,
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      title="Stop generating"
                    >
                      <Square size={13} color={C.bg} fill={C.bg} />
                    </motion.button>
                  ) : (
                    <motion.button
                      onClick={() => send()}
                      disabled={!input.trim()}
                      whileHover={input.trim() ? { scale: 1.08 } : {}}
                      whileTap={input.trim() ? { scale: 0.92 } : {}}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: input.trim()
                          ? `linear-gradient(135deg, ${C.accent} 0%, #0aaf84 100%)`
                          : C.surface,
                        border: "none",
                        cursor: input.trim() ? "pointer" : "not-allowed",
                        opacity: input.trim() ? 1 : 0.4,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: input.trim() ? `0 4px 16px ${C.accentGlow}` : "none",
                        transition: "all 0.2s",
                      }}
                      title="Send (Enter)"
                    >
                      <Send size={15} color={input.trim() ? "#fff" : C.textDim} />
                    </motion.button>
                  )}
                </div>
              </div>

              <p style={{ textAlign: "center", fontSize: 11, color: C.textDim, marginTop: 8, letterSpacing: "0.01em" }}>
                AI can make mistakes. Verify important information independently.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ MODALS ══════ */}
      <ConfirmModal
        isOpen={confirmClear}
        title="Clear conversation?"
        desc="All messages in this chat will be permanently deleted."
        confirmLabel="Clear chat"
        onClose={() => setConfirmClear(false)}
        onConfirm={clearChat}
        C={C}
      />
      <ConfirmModal
        isOpen={confirmExit}
        title="Sign out?"
        desc="You'll be redirected to the login page."
        confirmLabel="Sign out"
        onClose={() => setConfirmExit(false)}
        onConfirm={logout}
        C={C}
        danger
      />
    </>
  );
}

/* ═══════════════════════════════════════════
   EMPTY / WELCOME STATE
═══════════════════════════════════════════ */
function EmptyState({ C, onSuggest }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", padding: "40px 24px",
      minHeight: 400,
    }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{
          width: 64, height: 64, borderRadius: 20,
          background: `linear-gradient(135deg, ${C.accent} 0%, #6457f9 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24,
          boxShadow: `0 12px 40px ${C.accentGlow}`,
        }}
      >
        <Sparkles size={30} color="#fff" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: 26, fontWeight: 700,
          color: C.text, margin: "0 0 8px",
          textAlign: "center", letterSpacing: "-0.02em",
        }}
      >
        What finance question do you have today?
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        style={{ fontSize: 14, color: C.textMuted, margin: "0 0 32px", textAlign: "center" }}
      >
        Ask about Indian listed stocks (NSE/BSE), valuation, risk, portfolio allocation, or finance basics.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 10, maxWidth: 560, width: "100%",
        }}
      >
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={i}
            onClick={() => onSuggest(s)}
            whileHover={{ y: -2, boxShadow: `0 8px 24px rgba(0,0,0,0.2)` }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: "12px 14px", borderRadius: 12, textAlign: "left",
              backgroundColor: C.surface, border: `1px solid ${C.border}`,
              color: C.text, cursor: "pointer", fontSize: 13,
              fontFamily: FONT, fontWeight: 400, lineHeight: 1.5,
              transition: "background 0.15s",
            }}
          >
            {s}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MESSAGE ROW
═══════════════════════════════════════════ */
function normalizeMarkdownForRender(rawText) {
  if (typeof rawText !== "string") return "";

  let text = rawText.replace(/\r\n/g, "\n");
  const looksLikeCollapsedTable =
    text.includes("|") && !text.includes("\n") && text.includes("||");

  if (looksLikeCollapsedTable) {
    text = text
      .replace(/:\s*\|/g, ":\n|")
      .replace(/\|\|/g, "|\n|");
  }

  return text;
}

function MessageRow({ msg, idx, C, copiedId, doCopy, fmtTime }) {
  const [hovered, setHovered] = useState(false);
  const isUser    = msg.sender === "user";
  const msgCopyId = `msg-${idx}`;
  const codeCopyId = `code-${idx}`;
  const renderedMarkdown = normalizeMarkdownForRender(msg.text || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "10px 0",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      {/* Bubble / content */}
      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>

        {isUser ? (
          <div style={{
            backgroundColor: C.userBubbleBg,
            border: `1px solid ${C.userBubbleBd}`,
            color: C.text,
            padding: "10px 14px",
            borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
            fontSize: 14.5, lineHeight: 1.65,
            fontFamily: FONT,
            wordBreak: "break-word",
          }}>
            {msg.text}
          </div>
        ) : (
          <div
            className={`msg-content${msg.streaming && !msg.text ? "" : msg.streaming ? " cursor-blink" : ""}`}
            style={{ fontSize: 14.5, color: C.text, lineHeight: 1.72, wordBreak: "break-word" }}
          >
            {msg.text ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, children, ...props }) {
                    const codeText = String(children).replace(/\n$/, "");
                    if (inline) {
                      return (
                        <code
                          style={{
                            backgroundColor: C.codeBg,
                            color: C.accent,
                            borderRadius: 5,
                            padding: "2px 6px",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12.5,
                          }}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <div style={{ borderRadius: 10, overflow: "hidden", margin: "12px 0", border: `1px solid ${C.border}` }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          backgroundColor: C.codeHeader,
                          padding: "7px 14px",
                          borderBottom: `1px solid ${C.border}`,
                        }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                            code
                          </span>
                          <button
                            onClick={() => doCopy(codeText, codeCopyId)}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "none", border: "none",
                              color: copiedId === codeCopyId ? C.accent : C.textMuted,
                              cursor: "pointer", fontSize: 11.5, fontFamily: FONT,
                              padding: "2px 4px", borderRadius: 4,
                            }}
                          >
                            {copiedId === codeCopyId
                              ? <><Check size={11} /> Copied</>
                              : <><Copy size={11} /> Copy</>}
                          </button>
                        </div>
                        <pre style={{
                          backgroundColor: C.codeBg, margin: 0,
                          padding: "14px 16px", overflowX: "auto",
                          fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                          lineHeight: 1.65, color: C.text,
                        }}>
                          <code {...props}>{children}</code>
                        </pre>
                      </div>
                    );
                  },
                  table({ children }) {
                    return (
                      <div style={{ overflowX: "auto", margin: "12px 0", width: "100%" }}>
                        <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
                          {children}
                        </table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th style={{
                        border: `1px solid ${C.border}`,
                        backgroundColor: C.surface,
                        padding: "8px 10px",
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: "left",
                        fontFamily: FONT,
                      }}>
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td style={{
                        border: `1px solid ${C.border}`,
                        padding: "8px 10px",
                        fontSize: 13.5,
                        verticalAlign: "top",
                        fontFamily: FONT,
                      }}>
                        {children}
                      </td>
                    );
                  },
                  p({ children }) {
                    return (
                      <p style={{ margin: "0 0 10px", lineHeight: 1.72, fontSize: 14.5, fontFamily: FONT }}>
                        {children}
                      </p>
                    );
                  },
                }}
              >
                {renderedMarkdown}
              </ReactMarkdown>
            ) : (
              /* Skeleton shimmer while waiting for first chunk */
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                {[80, 60, 40].map((w, i) => (
                  <div key={i} style={{
                    height: 12, borderRadius: 6, width: `${w}%`,
                    background: `linear-gradient(90deg, ${C.surface} 25%, ${C.surfaceHover} 50%, ${C.surface} 75%)`,
                    backgroundSize: "800px 100%",
                    animation: "shimmer 1.4s ease-in-out infinite",
                    animationDelay: `${i * 0.12}s`,
                  }} />
                ))}
              </div>
            )}

            {/* Error badge */}
            {msg.error && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: C.danger, fontSize: 12 }}>
                <AlertCircle size={13} /> Error receiving response
              </div>
            )}

            {!isUser && (
              <div style={{ marginTop: 8, fontSize: 11, color: C.textDim }}>
                Model: {msg.model || "unknown"}
              </div>
            )}
          </div>
        )}

        {/* Hover actions */}
        <AnimatePresence>
          {hovered && msg.text && !msg.streaming && (
            <motion.div
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}
            >
              <button
                onClick={() => doCopy(msg.text, msgCopyId)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 7,
                  backgroundColor: C.surface, border: `1px solid ${C.border}`,
                  color: copiedId === msgCopyId ? C.accent : C.textMuted,
                  cursor: "pointer", fontSize: 11.5, fontFamily: FONT,
                  transition: "all 0.15s",
                }}
              >
                {copiedId === msgCopyId
                  ? <><Check size={11} /> Copied</>
                  : <><Copy size={11} /> Copy</>}
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
   SIDEBAR BUTTON
═══════════════════════════════════════════ */
function SidebarBtn({ icon: Icon, label, onClick, C, danger }) {
  const color = danger ? C.danger : C.textMuted;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 9,
        padding: "8px 10px", borderRadius: 8, border: "none",
        background: "transparent", color, cursor: "pointer",
        fontSize: 13, fontFamily: FONT, fontWeight: 400,
        transition: "all 0.15s", marginBottom: 2,
        textAlign: "left",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.color = danger ? C.danger : C.text; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = color; }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════
   ICON BUTTON
═══════════════════════════════════════════ */
function IconBtn({ children, onClick, C, title, style: extraStyle }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: "transparent", border: "none",
        color: C.textMuted, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
        ...extraStyle,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.color = C.text; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = extraStyle?.color || C.textMuted; }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════ */
function ConfirmModal({ isOpen, title, desc, confirmLabel, onClose, onConfirm, C, danger }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: C.sidebar,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: "24px 24px 20px",
              maxWidth: 360, width: "100%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "'Sora', sans-serif" }}>
                {title}
              </h3>
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", display: "flex", padding: 2, borderRadius: 6 }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: C.textMuted, lineHeight: 1.55, marginBottom: 20, fontFamily: FONT }}>
              {desc}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 18px", borderRadius: 9,
                  backgroundColor: C.surface, border: `1px solid ${C.border}`,
                  color: C.text, cursor: "pointer", fontSize: 13.5,
                  fontFamily: FONT, fontWeight: 500,
                  transition: "all 0.15s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: "8px 18px", borderRadius: 9,
                  background: danger
                    ? "linear-gradient(135deg, #ff5c5c 0%, #e03030 100%)"
                    : `linear-gradient(135deg, ${C.accent} 0%, #0aaf84 100%)`,
                  border: "none", color: "#fff",
                  cursor: "pointer", fontSize: 13.5,
                  fontFamily: FONT, fontWeight: 600,
                  boxShadow: danger ? "0 4px 16px rgba(255,92,92,0.35)" : `0 4px 16px ${C.accentGlow}`,
                  transition: "all 0.15s",
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  
}
