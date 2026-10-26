import { useEffect, useState } from "react";
import { registerPlugin } from "@capacitor/core";
import "./StepCounter.css";

const NativeStepCounter = registerPlugin("NativeStepCounter");
const KEY = "stepCounterData";
const DAILY_GOAL = 10000;

function getDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readLegacyToday() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const value = all[getDateKey()]?.steps;
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export default function StepCounter() {
  const [steps, setSteps] = useState(readLegacyToday);
  const [mode, setMode] = useState("starting");
  const [status, setStatus] = useState("फोन का असली Step Sensor शुरू हो रहा है…");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const sync = async () => {
      try {
        const result = await NativeStepCounter.getStatus();
        if (cancelled) return;

        const safe = Math.max(0, Math.floor(Number(result?.steps) || 0));
        setSteps(safe);

        try {
          const all = JSON.parse(localStorage.getItem(KEY) || "{}");
          const data = all && typeof all === "object" && !Array.isArray(all)
            ? all
            : {};
          data[getDateKey()] = { steps: safe };
          localStorage.setItem(KEY, JSON.stringify(data));
        } catch {
          // Native SharedPreferences remain the primary step record.
        }
      } catch {
        // The next poll can recover if the native bridge is temporarily unavailable.
      }
    };

    const start = async () => {
      try {
        const available = await NativeStepCounter.isAvailable();

        if (!available?.available) {
          throw new Error("इस फोन में असली TYPE_STEP_COUNTER सेंसर उपलब्ध नहीं है।");
        }

        const permission = await NativeStepCounter.requestActivityPermission();

        if (!permission?.granted) {
          throw new Error("कदम गिनने के लिए Activity Recognition अनुमति आवश्यक है।");
        }

        await NativeStepCounter.initializeToday({
          steps: readLegacyToday(),
        });

        await NativeStepCounter.startTracking();
        await sync();

        if (cancelled) return;

        setMode("sensor");
        setStatus("फोन का असली Step Sensor सक्रिय है। दैनिक गिनती सुरक्षित की जा रही है।");
        setError("");

        timer = window.setInterval(sync, 3000);
        document.addEventListener("visibilitychange", sync);
      } catch (e) {
        if (cancelled) return;

        setMode("error");
        setStatus("असली Step Sensor चालू नहीं हो सका।");
        setError(
          e?.message ||
          "Android ऐप में सेंसर और Activity Recognition अनुमति जाँचें।"
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);

      // Intentionally do not stop the native service on component unmount.
    };
  }, []);

  const percent = Math.min(100, Math.round((steps / DAILY_GOAL) * 100));
  const distance = (steps * 0.75) / 1000;
  const calories = Math.round(steps * 0.04);

  const badge = mode === "sensor"
    ? "SENSOR ACTIVE"
    : mode === "error"
      ? "UNAVAILABLE"
      : "STARTING";

  return (
    <section className="step-card">
      <div className="step-title-row">
        <div>
          <p className="step-label">DAILY ACTIVITY</p>
          <h2>👟 Step Counter</h2>
        </div>
        <span className="step-status-badge">{badge}</span>
      </div>

      <div className="step-total">
        <strong>{steps.toLocaleString("en-IN")}</strong>
        <span>कदम</span>
      </div>

      <div
        className="step-bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="दैनिक कदम लक्ष्य"
      >
        <div style={{ width: `${percent}%` }} />
      </div>

      <p className="step-percent">
        {percent}% · दैनिक लक्ष्य 10,000 कदम
      </p>

      <div className="step-stats">
        <div>
          <strong>{distance.toFixed(2)} km</strong>
          <span>अनुमानित दूरी</span>
        </div>
        <div>
          <strong>{calories}</strong>
          <span>अनुमानित kcal</span>
        </div>
      </div>

      <p className="step-message" aria-live="polite">{status}</p>
      {error && <p className="step-error">{error}</p>}

      <p className="step-note">
        कदम फोन के असली हार्डवेयर सेंसर से लिए जाते हैं। दूरी और कैलोरी अनुमान हैं।
        बैकग्राउंड गिनती Android की अनुमति, बैटरी सेटिंग और डिवाइस पर निर्भर करती है।
      </p>
    </section>
  );
}
