import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, CheckCircle2, X } from "lucide-react";

// ─── Toast Component ───────────────────────────────────────────────────────────
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "linear-gradient(135deg, #0f2027 0%, #0d1f1a 100%)",
        border: "1px solid rgba(52,211,153,0.35)",
        borderRadius: 14,
        padding: "14px 20px",
        color: "#6ee7b7",
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(52,211,153,0.1)",
        backdropFilter: "blur(20px)",
        minWidth: 280,
      }}
    >
      <CheckCircle2 size={18} color="#34d399" />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(110,231,183,0.5)", display: "flex" }}
      >
        <X size={15} />
      </button>
    </motion.div>
  );
}

// ─── Floating Input ────────────────────────────────────────────────────────────
function FloatingInput({ icon: Icon, label, name, type = "text", value, onChange, onKeyDown, rightElement, error }) {
  const [focused, setFocused] = useState(false);
  const isFloating = focused || value?.length > 0;

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      <div
        style={{
          position: "relative",
          borderRadius: 12,
          border: `1.5px solid ${error ? "rgba(248,113,113,0.6)" : focused ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.09)"}`,
          background: focused ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.03)",
          transition: "all 0.2s ease",
          boxShadow: focused
            ? "0 0 0 3px rgba(52,211,153,0.12), 0 4px 20px rgba(0,0,0,0.3)"
            : "0 2px 10px rgba(0,0,0,0.2)",
        }}
      >
        {/* Icon */}
        <div style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          color: focused ? "#34d399" : "rgba(255,255,255,0.3)",
          transition: "color 0.2s ease",
          display: "flex",
          pointerEvents: "none",
        }}>
          <Icon size={17} />
        </div>

        {/* Floating Label */}
        <label style={{
          position: "absolute",
          left: 46,
          top: isFloating ? 9 : "50%",
          transform: isFloating ? "none" : "translateY(-50%)",
          fontSize: isFloating ? 10.5 : 14,
          color: error ? "rgba(248,113,113,0.7)" : isFloating ? "#34d399" : "rgba(255,255,255,0.3)",
          transition: "all 0.18s ease",
          pointerEvents: "none",
          fontWeight: isFloating ? 600 : 400,
          letterSpacing: isFloating ? "0.06em" : 0,
          textTransform: isFloating ? "uppercase" : "none",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {label}
        </label>

        {/* Input */}
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          style={{
            width: "100%",
            paddingTop: isFloating ? 26 : 18,
            paddingBottom: isFloating ? 10 : 18,
            paddingLeft: 46,
            paddingRight: rightElement ? 48 : 16,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#f0fdf4",
            fontSize: 15,
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: "border-box",
            letterSpacing: type === "password" ? "0.12em" : 0,
          }}
        />

        {/* Right element (show/hide password) */}
        {rightElement && (
          <div style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
          }}>
            {rightElement}
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              margin: "6px 0 0 4px",
              fontSize: 12,
              color: "rgba(248,113,113,0.85)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Login Component ──────────────────────────────────────────────────────
function Login({ onLogin, onSwitch, isRegister }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [toast, setToast] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  // Reset form when switching modes
  useEffect(() => {
    setForm({ name: "", email: "", password: "" });
    setErrors({});
    setApiError("");
    setShowPassword(false);
  }, [isRegister]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: "" });
    if (apiError) setApiError("");
  };

  const validate = () => {
    const errs = {};
    if (isRegister && !form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email";
    if (!form.password.trim()) errs.password = "Password is required";
    else if (form.password.length < 6) errs.password = "At least 6 characters";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");

    try {
      const url = isRegister
        ? "http://localhost:8080/auth/register"
        : "http://localhost:8080/auth/login";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);

      if (isRegister) {
        setToast("Account created! Please log in.");
        navigate("/login");
        return;
      }

      if (data && data.token) {
        // Prevent stale/legacy token usage; auth now reads from "user".
        localStorage.removeItem("token");
        localStorage.setItem("user", JSON.stringify(data));
        if (onLogin) onLogin(data);
        navigate("/chat");
      } else {
        setApiError(typeof data === "string" ? data : "Invalid credentials. Please try again.");
      }
    } catch {
      setApiError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  // ── Background orbs ──
  const orbs = [
    { cx: "10%", cy: "20%", r: 280, color: "rgba(16,185,129,0.07)" },
    { cx: "85%", cy: "75%", r: 220, color: "rgba(99,102,241,0.07)" },
    { cx: "60%", cy: "10%", r: 160, color: "rgba(20,184,166,0.05)" },
  ];

  return (
    <>
      {/* Google Font import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@300;400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }

        .auth-btn {
          width: 100%;
          padding: 15px;
          border: none;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.01em;
          position: relative;
          overflow: hidden;
          transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
          background: linear-gradient(135deg, #10b981 0%, #0d9488 50%, #6366f1 100%);
          color: #fff;
          box-shadow: 0 4px 24px rgba(16,185,129,0.35);
        }
        .auth-btn:not(:disabled):hover {
          box-shadow: 0 6px 32px rgba(16,185,129,0.5);
          transform: translateY(-1px);
        }
        .auth-btn:not(:disabled):active {
          transform: scale(0.98) translateY(0);
          box-shadow: 0 2px 12px rgba(16,185,129,0.3);
        }
        .auth-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .switch-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #34d399;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          padding: 0;
          transition: color 0.15s;
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: transparent;
        }
        .switch-btn:hover {
          color: #6ee7b7;
          text-decoration-color: rgba(52,211,153,0.4);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
          color: rgba(255,255,255,0.4);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
        }
        .checkbox-label input[type="checkbox"] {
          appearance: none;
          width: 16px;
          height: 16px;
          border: 1.5px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .checkbox-label input[type="checkbox"]:checked {
          background: linear-gradient(135deg, #10b981, #0d9488);
          border-color: #10b981;
        }
        .checkbox-label input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 5px;
          height: 9px;
          border: 2px solid white;
          border-top: none;
          border-left: none;
          transform: rotate(45deg);
        }

        .show-pw-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          padding: 4px;
          transition: color 0.15s;
        }
        .show-pw-btn:hover { color: rgba(255,255,255,0.7); }

        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 22px 0;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.07);
        }
        .divider-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.08em;
        }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast("")} />}
      </AnimatePresence>

      {/* Page wrapper */}
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#060d0b",
        position: "relative",
        overflow: "hidden",
        padding: "24px 16px",
      }}>
        {/* Ambient orbs */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {orbs.map((o, i) => (
            <circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={o.color} filter="blur(60px)" />
          ))}
        </svg>

        {/* Subtle grid */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }} />

        {/* Card */}
        <motion.div
          key={isRegister ? "register" : "login"}
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            width: "100%",
            maxWidth: 420,
            background: "linear-gradient(160deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 24,
            padding: "40px 36px 36px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.1)",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Logo mark */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "linear-gradient(135deg, #10b981 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(16,185,129,0.35)",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h1 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color: "#f0fdf4",
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}>
              {isRegister ? "Create an account" : "Welcome back"}
            </h1>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              color: "rgba(255,255,255,0.38)",
              fontWeight: 400,
            }}>
              {isRegister
                ? "Sign up to get started for free"
                : "Sign in to continue to your workspace"}
            </p>
          </div>

          {/* Form fields */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isRegister ? "reg-form" : "login-form"}
              initial={{ opacity: 0, x: isRegister ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRegister ? -20 : 20 }}
              transition={{ duration: 0.22 }}
            >
              {isRegister && (
                <FloatingInput
                  icon={User}
                  label="Full Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  error={errors.name}
                />
              )}

              <FloatingInput
                icon={Mail}
                label="Email address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                error={errors.email}
              />

              <FloatingInput
                icon={Lock}
                label="Password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                error={errors.password}
                rightElement={
                  <button
                    type="button"
                    className="show-pw-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </motion.div>
          </AnimatePresence>

          {/* Remember me / forgot */}
          {!isRegister && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, marginTop: -4 }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                Remember me
              </label>
              <button type="button" className="switch-btn" style={{ fontSize: 13, textDecoration: "none", color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={e => e.target.style.color = "#34d399"}
                onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.3)"}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* API error */}
          <AnimatePresence>
            {apiError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  marginBottom: 18,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "rgba(252,165,165,0.9)",
                  fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <X size={14} style={{ flexShrink: 0 }} />
                {apiError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            className="auth-btn"
            onClick={handleSubmit}
            disabled={loading}
            whileTap={!loading ? { scale: 0.97 } : {}}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={17} style={{ animation: "spin 0.8s linear infinite" }} />
                {isRegister ? "Creating account..." : "Signing in..."}
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {isRegister ? "Create account" : "Sign in"}
                <ArrowRight size={17} />
              </span>
            )}
          </motion.button>

          {/* Spinner keyframe */}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {/* Divider */}
          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">OR</span>
            <div className="divider-line" />
          </div>

          {/* Switch mode */}
          <p style={{
            textAlign: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: "rgba(255,255,255,0.3)",
          }}>
            {isRegister ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              className="switch-btn"
              onClick={() => {
                navigate(isRegister ? "/login" : "/register");
              }}
            >
              {isRegister ? "Sign in" : "Sign up free"}
            </button>
          </p>
        </motion.div>

        {/* Bottom label */}
        <p style={{
          position: "absolute",
          bottom: 20,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          color: "rgba(255,255,255,0.12)",
          letterSpacing: "0.03em",
        }}>
          Protected by TLS encryption · © 2025 YourApp
        </p>
      </div>
    </>
  );
}

export default Login;
