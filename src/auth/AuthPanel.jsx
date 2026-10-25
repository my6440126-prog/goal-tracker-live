import { useState } from "react";
import { supabase } from "../lib/supabase";
import "./AuthPanel.css";

export default function AuthPanel({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage("ईमेल और पासवर्ड भरें।");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setMessage("पासवर्ड कम-से-कम 8 अक्षरों का रखें।");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          await onLogin(data.session.user);
        } else {
          setMessage("✅ आपका अकाउंट बन गया है। अब अपने ईमेल ऐप (जैसे Gmail) को खोलें। Inbox में Supabase का verification ईमेल देखें। ईमेल न मिले तो Spam फ़ोल्डर भी जाँचें। उसमें Confirm Email या Verification Link पर टैप करें। पुष्टि होने के बाद इस ऐप में वापस आकर Login करें।");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
        await onLogin(data.user);
      }
    } catch (error) {
      setMessage(error.message || "अभी लॉगिन नहीं हो सका।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">🎯</div>
        <h1>Goal Tracker Live</h1>
        <p className="auth-subtitle">आपके लक्ष्य, आपके हर डिवाइस पर</p>

        <div className="auth-switch">
          <button
            type="button"
            className={mode === "login" ? "selected" : ""}
            onClick={() => { setMode("login"); setMessage(""); }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "signup" ? "selected" : ""}
            onClick={() => { setMode("signup"); setMessage(""); }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label>
              आपका नाम
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={40}
                placeholder="अपना नाम"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            ईमेल
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label>
            पासवर्ड
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="कम-से-कम 8 अक्षर"
            />
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "कृपया प्रतीक्षा करें..."
              : mode === "signup" ? "✨ Create Account" : "🔐 Login"}
          </button>
        </form>

        {message && <p className="auth-message" role="status">{message}</p>}

        <p className="auth-footnote">
          आपका पासवर्ड केवल Supabase Authentication में सत्यापित होगा।
          इसे किसी के साथ साझा न करें।
        </p>
      </section>
    </main>
  );
}
