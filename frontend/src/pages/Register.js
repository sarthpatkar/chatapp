import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, CheckCircle2, X, ShieldCheck } from "lucide-react";

// ─── Toast Component ───────────────────────────────────────────────────────────
function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const isSuccess = type === "success";

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
        border: `1px solid ${isSuccess ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
        borderRadius: 14,
        padding: "14px 20px",
        color: isSuccess ? "#6ee7b7" : "#fca5a5",
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${isSuccess ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)"}`,
        backdropFilter: "blur(20px)",
        minWidth: 300,
        maxWidth: 420,
      }}
    >
      {isSuccess
        ? <CheckCircle2 size={18} color="#34d399" style={{ flexShrink: 0 }} />
        : <X size={18} color="#f87171" style={{ flexShrink: 0 }} />
      }
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(200,200,200,0.4)", display: "flex" }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ─── Password Strength Meter ───────────────────────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /\d/.test(password) },
    { label: "Special character", pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const levels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "#f87171", "#fb923c", "#facc15", "#34d399"];
  const widths = ["0%", "25%", "50%", "75%", "100%"];

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      style={{ marginTop: -12, marginBottom: 18, overflow: "hidden" }}
    >
      {/* Bar */}
      <div style={{
        height: 3,
        borderRadius: 99,
        background: "rgba(255,255,255,0.07)",
        marginBottom: 10,
        overflow: "hidden",
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: widths[score] }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{
            height: "100%",
            borderRadius: 99,
            background: colors[score],
            boxShadow: `0 0 8px ${colors[score]}88`,
          }}
        />
      </div>

      {/* Checks */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {checks.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: c.pass ? "#34d399" : "rgba(255,255,255,0.15)",
              transition: "background 0.2s",
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11.5,
              color: c.pass ? "rgba(110,231,183,0.8)" : "rgba(255,255,255,0.25)",
              transition: "color 0.2s",
            }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {score > 0 && (
        <p style={{
          marginTop: 6,
          fontSize: 11.5,
          fontFamily: "'DM Sans', sans-serif",
          color: colors[score],
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          {levels[score]}
        </p>
      )}
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
        <div style={{
          position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
          color: focused ? "#34d399" : "rgba(255,255,255,0.3)",
          transition: "color 0.2s ease", display: "flex", pointerEvents: "none",
        }}>
          <Icon size={17} />
        </div>

        <label style={{
          position: "absolute", left: 46,
          top: isFloating ? 9 : "50%",
          transform: isFloating ? "none" : "translateY(-50%)",
          fontSize: isFloating ? 10.5 : 14,
          color: error ? "rgba(248,113,113,0.7)" : isFloating ? "#34d399" : "rgba(255,255,255,0.3)",
          transition: "all 0.18s ease", pointerEvents: "none",
          fontWeight: isFloating ? 600 : 400,
          letterSpacing: isFloating ? "0.06em" : 0,
          textTransform: isFloating ? "uppercase" : "none",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {label}
        </label>

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
            background: "transparent", border: "none", outline: "none",
            color: "#f0fdf4", fontSize: 15,
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: "border-box",
            letterSpacing: type === "password" ? "0.12em" : 0,
          }}
        />

        {rightElement && (
          <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
            {rightElement}
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            style={{ margin: "6px 0 0 4px", fontSize: 12, color: "rgba(248,113,113,0.85)", fontFamily: "'DM Sans', sans-serif" }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Register Component ───────────────────────────────────────────────────
function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [toast, setToast] = useState(null); // { message, type }
  const [agreed, setAgreed] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: "" });
    if (apiError) setApiError("");
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Full name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address";
    if (!form.password.trim()) errs.password = "Password is required";
    else if (form.password.length < 6) errs.password = "Password must be at least 6 characters";
    if (!agreed) errs.agreed = "You must agree to the terms";
    return errs;
  };

  const handleRegister = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError("");

    try {
      const res = await fetch("http://localhost:8080/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });

      const data = await res.text();

      if (res.ok) {
        setToast({ message: "Account created successfully! Redirecting to login…", type: "success" });
        setTimeout(() => { navigate("/login"); }, 1800);
      } else {
        setApiError(data || "Registration failed. Please try again.");
      }
    } catch {
      setApiError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleRegister();
  };

  // Strength score for button CTA color hint
  const strengthChecks = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password),
    /\d/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ];
  const strengthScore = strengthChecks.filter(Boolean).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@300;400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .reg-btn {
          width: 100%;
          padding: 15px;
          border: none;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
          background: linear-gradient(135deg, #10b981 0%, #0d9488 50%, #6366f1 100%);
          color: #fff;
          box-shadow: 0 4px 24px rgba(16,185,129,0.35);
        }
        .reg-btn:not(:disabled):hover {
          box-shadow: 0 6px 32px rgba(16,185,129,0.5);
          transform: translateY(-1px);
        }
        .reg-btn:not(:disabled):active {
          transform: scale(0.98) translateY(0);
          box-shadow: 0 2px 12px rgba(16,185,129,0.3);
        }
        .reg-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .switch-link {
          background: none; border: none; cursor: pointer;
          color: #34d399; font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600; padding: 0;
          transition: color 0.15s;
          text-underline-offset: 3px;
        }
        .switch-link:hover { color: #6ee7b7; }

        .show-pw-btn {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.3); display: flex;
          align-items: center; padding: 4px; transition: color 0.15s;
        }
        .show-pw-btn:hover { color: rgba(255,255,255,0.7); }

        .terms-check {
          appearance: none;
          width: 16px; height: 16px;
          border: 1.5px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          cursor: pointer; position: relative; flex-shrink: 0;
          transition: all 0.15s;
        }
        .terms-check:checked {
          background: linear-gradient(135deg, #10b981, #0d9488);
          border-color: #10b981;
        }
        .terms-check:checked::after {
          content: '';
          position: absolute; left: 4px; top: 1px;
          width: 5px; height: 9px;
          border: 2px solid white;
          border-top: none; border-left: none;
          transform: rotate(45deg);
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* Page */}
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
          <circle cx="15%" cy="25%" r="300" fill="rgba(16,185,129,0.07)" filter="blur(70px)" />
          <circle cx="88%" cy="70%" r="240" fill="rgba(99,102,241,0.07)" filter="blur(70px)" />
          <circle cx="55%" cy="5%"  r="180" fill="rgba(20,184,166,0.05)" filter="blur(60px)" />
          <circle cx="30%" cy="90%" r="160" fill="rgba(99,102,241,0.04)" filter="blur(60px)" />
        </svg>

        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }} />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 36, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            width: "100%",
            maxWidth: 440,
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
          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <motion.div
              whileHover={{ scale: 1.06, rotate: 3 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              style={{
                width: 50,
                height: 50,
                borderRadius: 15,
                background: "linear-gradient(135deg, #10b981 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 28px rgba(16,185,129,0.38)",
                cursor: "default",
              }}
            >
              <ShieldCheck size={26} color="white" />
            </motion.div>
          </div>

          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <h1 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color: "#f0fdf4",
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}>
              Create your account
            </h1>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              color: "rgba(255,255,255,0.38)",
              fontWeight: 400,
            }}>
              Join thousands of teams already on the platform
            </p>
          </div>

          {/* Step badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
            {["Details", "Verify", "Done"].map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: i === 0 ? "linear-gradient(135deg, #10b981, #0d9488)" : "rgba(255,255,255,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: i === 0 ? "white" : "rgba(255,255,255,0.2)",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {i + 1}
                </div>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 500,
                  color: i === 0 ? "rgba(110,231,183,0.8)" : "rgba(255,255,255,0.2)",
                }}>
                  {step}
                </span>
                {i < 2 && (
                  <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.08)", marginLeft: 2 }} />
                )}
              </div>
            ))}
          </div>

          {/* Fields */}
          <FloatingInput
            icon={User} label="Full Name" name="name"
            value={form.name} onChange={handleChange} onKeyDown={handleKeyDown}
            error={errors.name}
          />

          <FloatingInput
            icon={Mail} label="Email address" name="email" type="email"
            value={form.email} onChange={handleChange} onKeyDown={handleKeyDown}
            error={errors.email}
          />

          <FloatingInput
            icon={Lock} label="Password" name="password"
            type={showPassword ? "text" : "password"}
            value={form.password} onChange={handleChange} onKeyDown={handleKeyDown}
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

          {/* Password strength */}
          <AnimatePresence>
            {form.password && <PasswordStrength password={form.password} />}
          </AnimatePresence>

          {/* Terms */}
          <div style={{ marginBottom: 22 }}>
            <label style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              cursor: "pointer", userSelect: "none",
            }}>
              <input
                type="checkbox"
                className="terms-check"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (errors.agreed) setErrors({ ...errors, agreed: "" });
                }}
                style={{ marginTop: 2 }}
              />
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                color: "rgba(255,255,255,0.35)", lineHeight: 1.55,
              }}>
                I agree to the{" "}
                <span style={{ color: "#34d399", cursor: "pointer", fontWeight: 500 }}>Terms of Service</span>
                {" "}and{" "}
                <span style={{ color: "#34d399", cursor: "pointer", fontWeight: 500 }}>Privacy Policy</span>
              </span>
            </label>
            <AnimatePresence>
              {errors.agreed && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  style={{ margin: "6px 0 0 26px", fontSize: 12, color: "rgba(248,113,113,0.85)", fontFamily: "'DM Sans', sans-serif" }}
                >
                  {errors.agreed}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* API Error */}
          <AnimatePresence>
            {apiError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 10, padding: "11px 14px", marginBottom: 18,
                  display: "flex", alignItems: "center", gap: 8,
                  color: "rgba(252,165,165,0.9)", fontSize: 13,
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
            className="reg-btn"
            onClick={handleRegister}
            disabled={loading}
            whileTap={!loading ? { scale: 0.97 } : {}}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={17} style={{ animation: "spin 0.8s linear infinite" }} />
                Creating your account…
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Create account
                <ArrowRight size={17} />
              </span>
            )}
          </motion.button>

          {/* Perks row */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 18,
            marginTop: 18,
            marginBottom: 20,
          }}>
            {["Free forever plan", "No credit card", "Cancel anytime"].map((perk) => (
              <div key={perk} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={12} color="rgba(52,211,153,0.6)" />
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11.5,
                  color: "rgba(255,255,255,0.25)", fontWeight: 400,
                }}>
                  {perk}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
              OR
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Switch to login */}
          <p style={{
            textAlign: "center",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: "rgba(255,255,255,0.3)",
          }}>
            Already have an account?{" "}
            <button type="button" className="switch-link" onClick={() => navigate("/login")}>
              Sign in
            </button>
          </p>
        </motion.div>

        {/* Footer label */}
        <p style={{
          position: "absolute", bottom: 20, left: 0, right: 0,
          textAlign: "center",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12, color: "rgba(255,255,255,0.12)",
          letterSpacing: "0.03em",
        }}>
          Protected by TLS encryption · © 2025 YourApp
        </p>
      </div>
    </>
  );
}
export default Register;