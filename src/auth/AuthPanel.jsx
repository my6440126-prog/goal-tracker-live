import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";
import "./AuthPanel.css";

export default function AuthPanel({
  onLogin,
  recoveryMode = false,
  recoveryUrl = "",
  onRecoveryComplete,
}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [recoverySession, setRecoverySession] = useState(false);

  useEffect(() => {
    if (recoveryMode) {
      setMode("reset");
    }
  }, [recoveryMode]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (mode === "forgot") {
      if (!cleanEmail) {
        setMessage("पहले अपना ईमेल भरें।");
        return;
      }

      setLoading(true);
      try {
        const redirectTo = Capacitor.isNativePlatform() ? "goaltracker://auth" : `${window.location.origin}${window.location.pathname}?reset-password=1`;
        const { error } = await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          { redirectTo }
        );

        if (error) throw error;

        setMessage(
          "अगर इस ईमेल से अकाउंट मौजूद है, तो पासवर्ड रीसेट करने का ईमेल भेज दिया गया है। Gmail के Inbox और Spam फ़ोल्डर जाँचें। लिंक खोलने के बाद इसी ऐप में वापस आएँ।"
        );
      } catch (error) {
        setMessage(error.message || "रीसेट ईमेल भेजा नहीं जा सका।");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "reset") {
      if (password.length < 8) {
        setMessage("नया पासवर्ड कम-से-कम 8 अक्षरों का रखें।");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("दोनों पासवर्ड एक जैसे नहीं हैं।");
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        setPassword("");
        setConfirmPassword("");
        setRecoverySession(false);
        setMode("login");
        setMessage("✅ पासवर्ड सफलतापूर्वक बदल गया। अब नए पासवर्ड से Login करें।");
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        setMessage(
          error.message || "पासवर्ड नहीं बदल सका। रीसेट ईमेल का लिंक दोबारा खोलें।"
        );
      } finally {
        setLoading(false);
      }
      return;
    }

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
          onRecoveryComplete?.();
        } else {
          setMessage(
            "✅ आपका अकाउंट बन गया है। Gmail खोलें और Supabase का verification ईमेल देखें। ईमेल न मिले तो Spam फ़ोल्डर जाँचें। Confirm Email लिंक पर टैप करने के बाद इस ऐप में वापस आकर Login करें।"
          );
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

  useEffect(() => {
    let active = true;

    const handleRecovery = (event, session) => {
      if (event === "PASSWORD_RECOVERY" && active) {
        setEmail(session?.user?.email || "");
        setRecoverySession(true);
        setMode("reset");
        setMessage("रीसेट लिंक सत्यापित हो गया है। अब नया पासवर्ड बनाएँ।");
      }
    };

    const { data } = supabase.auth.onAuthStateChange(handleRecovery);

    async function processRecoveryUrl(rawUrl) {
      try {
        const url = new URL(rawUrl);
        const params = new URLSearchParams(
          url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
        );
        const queryParams = url.searchParams;
        const type = params.get("type") || queryParams.get("type");
        const accessToken = params.get("access_token") || queryParams.get("access_token");
        const refreshToken = params.get("refresh_token") || queryParams.get("refresh_token");
        const code = queryParams.get("code");

        if (type === "recovery" && accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;

          if (active) {
            setEmail(data.session?.user?.email || "");
            setRecoverySession(true);
            setMode("reset");
            setMessage("रीसेट लिंक सत्यापित हो गया है। अब नया पासवर्ड बनाएँ।");
          }
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          const { data: sessionData } = await supabase.auth.getSession();

          if (active && sessionData.session) {
            setEmail(sessionData.session.user?.email || "");
            setRecoverySession(true);
            setMode("reset");
            setMessage("रीसेट लिंक सत्यापित हो गया है। अब नया पासवर्ड बनाएँ।");
          }
        }
      } catch (error) {
        if (active) {
          setRecoverySession(false);
          setMode("login");
          setMessage("रीसेट लिंक सत्यापित नहीं हो सका। Forgot Password से नया लिंक मँगाएँ।");
        }
      }
    }


    if (recoveryUrl) {
      void processRecoveryUrl(recoveryUrl);
    }

    if (window.location.search.includes("reset-password=1")) {
      void (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        if (active && sessionData.session) {
          setEmail(sessionData.session.user?.email || "");
          setRecoverySession(true);
          setMode("reset");
          setMessage("रीसेट लिंक सत्यापित हो गया है। अब नया पासवर्ड बनाएँ।");
        }
      })();
    } else if (window.location.hash.includes("type=recovery")) {
      void processRecoveryUrl(window.location.href);
    }

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [recoveryUrl]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">🎯</div>
        <h1>Goal Tracker Live</h1>
        <p className="auth-subtitle">आपके लक्ष्य, आपके हर डिवाइस पर</p>

        {mode !== "forgot" && mode !== "reset" && (
          <div className="auth-switch">
            <button
              type="button"
              className={mode === "login" ? "selected" : ""}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "signup" ? "selected" : ""}
              onClick={() => switchMode("signup")}
            >
              Create Account
            </button>
          </div>
        )}

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
              readOnly={mode === "reset"}
            />
          </label>

          {mode !== "forgot" && (
            <label>
              {mode === "reset" ? "नया पासवर्ड" : "पासवर्ड"}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={mode === "reset" || mode === "signup" ? "new-password" : "current-password"}
                placeholder="कम-से-कम 8 अक्षर"
              />
            </label>
          )}

          {mode === "reset" && (
            <label>
              नया पासवर्ड फिर से भरें
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="नया पासवर्ड दोबारा लिखें"
              />
            </label>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "कृपया प्रतीक्षा करें..."
              : mode === "signup"
                ? "✨ Create Account"
                : mode === "forgot"
                  ? "📩 Reset Link भेजें"
                  : mode === "reset"
                    ? "🔐 नया पासवर्ड सेव करें"
                    : "🔐 Login"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            className="auth-text-button"
            onClick={() => switchMode("forgot")}
          >
            पासवर्ड भूल गए? Forgot Password
          </button>
        )}

        {(mode === "forgot" || mode === "reset") && (
          <button
            type="button"
            className="auth-text-button"
            onClick={() => switchMode("login")}
          >
            ← वापस Login पर जाएँ
          </button>
        )}

        {message && <p className="auth-message" role="status">{message}</p>}

        {mode === "reset" && !recoverySession && (
          <p className="auth-footnote">
            रीसेट ईमेल में आए लिंक से इस स्क्रीन पर आएँ। लिंक एक्सपायर हो गया हो तो Forgot Password से नया लिंक मँगाएँ।
          </p>
        )}

        <p className="auth-footnote">
          आपका पासवर्ड केवल Supabase Authentication में सत्यापित होगा।
          इसे किसी के साथ साझा न करें।
        </p>
      </section>
    </main>
  );
}
