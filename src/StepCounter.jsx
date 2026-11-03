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

export default function StepCounter({ lang = "hi" }) {
  const tr = (en, hi) => lang === "en" ? en : hi;
  const [steps, setSteps] = useState(readLegacyToday);
  const [mode, setMode] = useState("starting");
  const [status, setStatus] = useState("starting");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const sync = async () => {
      try {
        const result = await NativeStepCounter.getStatus();
        if (cancelled) return;

        const safe = Math.max(readLegacyToday(), Math.max(0, Math.floor(Number(result?.steps) || 0)));
        setSteps(safe);
        setLastUpdated(Number(result?.lastUpdated) || 0);

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
        setStatus("active");
        setError("");

        timer = window.setInterval(sync, 3000);
        document.addEventListener("visibilitychange", sync);
      } catch (e) {
        if (cancelled) return;

        setMode("error");
        setStatus("failed");
        const reason = e?.message || "";
        setError(
          reason.includes("TYPE_STEP_COUNTER")
            ? "sensorUnavailable"
            : reason.includes("Activity Recognition")
              ? "permissionDenied"
              : "sensorHelp"
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

  const refreshSensor = async () => {
    if (refreshing) return;

    setRefreshing(true);
    setRefreshMessage("");

    try {
      const available = await NativeStepCounter.isAvailable();

      if (!available?.available) {
        throw new Error("sensorUnavailable");
      }

      const permission = await NativeStepCounter.requestActivityPermission();

      if (!permission?.granted) {
        throw new Error("permissionDenied");
      }

      await NativeStepCounter.initializeToday({
        steps: readLegacyToday(),
      });

      await NativeStepCounter.startTracking();

      const result = await NativeStepCounter.refreshSensor();

      if (!result?.available || !result?.tracking) {
        throw new Error("trackingFailed");
      }

      const safe = Math.max(readLegacyToday(), Math.max(0, Math.floor(Number(result?.steps) || 0)));
      const updatedAt = Number(result?.lastUpdated) || 0;

      setSteps(safe);
      if (updatedAt > 0) setLastUpdated(updatedAt);

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

      setMode("sensor");
      setStatus("active");
      setError("");

      setRefreshMessage(
        updatedAt > lastUpdated ? "success" : "waiting"
      );
    } catch (e) {
      const reason = e?.message || "";

      setRefreshMessage(
        reason.includes("permissionDenied") ||
        reason.includes("Activity Recognition")
          ? "permissionDenied"
          : reason.includes("sensorUnavailable") ||
            reason.includes("TYPE_STEP_COUNTER")
            ? "sensorUnavailable"
            : "failed"
      );
    } finally {
      setRefreshing(false);
    }
  };

  const percent = Math.min(100, Math.round((steps / DAILY_GOAL) * 100));
  const distance = (steps * 0.75) / 1000;
  const calories = Math.round(steps * 0.04);

  const badge = mode === "sensor"
    ? tr("SENSOR ACTIVE", "सेंसर सक्रिय")
    : mode === "error"
      ? tr("UNAVAILABLE", "उपलब्ध नहीं")
      : tr("STARTING", "शुरू हो रहा है");

  return (
    <section className="step-card">
      <div className="step-title-row">
        <div>
          <p className="step-label">{tr("DAILY ACTIVITY", "दैनिक गतिविधि")}</p>
          <h2>👟 {tr("Step Counter", "स्टेप काउंटर")}</h2>
        </div>
        <span className="step-status-badge">{badge}</span>
      </div>

      <div className="step-total">
        <strong>{steps.toLocaleString(lang === "en" ? "en-IN" : "hi-IN")}</strong>
        <span>{tr("steps", "कदम")}</span>
      </div>

      <div
        className="step-bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={tr("Daily step goal", "दैनिक कदम लक्ष्य")}
      >
        <div style={{ width: `${percent}%` }} />
      </div>

      <p className="step-percent">
        {percent}% · {tr("Daily goal: 10,000 steps", "दैनिक लक्ष्य: 10,000 कदम")}
      </p>

      <div className="step-stats">
        <div>
          <strong>{distance.toLocaleString(lang === "en" ? "en-IN" : "hi-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</strong>
          <span>{tr("Estimated distance", "अनुमानित दूरी")}</span>
        </div>
        <div>
          <strong>{calories}</strong>
          <span>{tr("Estimated calories", "अनुमानित कैलोरी")}</span>
        </div>
      </div>

      <p className="step-message" aria-live="polite">
        {status === "starting"
          ? tr("Starting the phone's real step sensor…", "फोन का असली Step Sensor शुरू हो रहा है…")
          : status === "active"
            ? tr("Phone's real step sensor is active. Daily count is being saved.", "फोन का असली Step Sensor सक्रिय है। दैनिक गिनती सुरक्षित की जा रही है।")
            : tr("The real step sensor could not start.", "असली Step Sensor चालू नहीं हो सका।")}
      </p>

      <div className="step-buttons">
        <button
          type="button"
          onClick={refreshSensor}
          disabled={refreshing}
          aria-label={tr("Refresh and reconnect step sensor", "स्टेप सेंसर रीफ्रेश और दोबारा कनेक्ट करें")}
        >
          {refreshing
            ? tr("Syncing…", "सिंक हो रहा है…")
            : tr("↻ Refresh / Reconnect", "↻ रीफ्रेश / दोबारा कनेक्ट")}
        </button>
      </div>

      {lastUpdated > 0 && (
        <p className="step-sync-time">
          {tr("Last sensor update:", "आखिरी सेंसर अपडेट:")}{" "}
          {new Date(lastUpdated).toLocaleTimeString(
            lang === "en" ? "en-IN" : "hi-IN",
            { hour: "2-digit", minute: "2-digit", second: "2-digit" }
          )}
        </p>
      )}

      {refreshMessage && (
        <p className="step-refresh-message" aria-live="polite">
          {refreshMessage === "success"
            ? tr("Sensor sync completed.", "सेंसर सिंक पूरा हुआ।")
            : refreshMessage === "waiting"
              ? tr("Refresh requested. Waiting for the next sensor reading.", "रीफ्रेश अनुरोध भेजा गया। सेंसर की अगली रीडिंग का इंतज़ार है।")
              : refreshMessage === "permissionDenied"
                ? tr("Activity Recognition permission is required.", "Activity Recognition अनुमति आवश्यक है।")
                : refreshMessage === "sensorUnavailable"
                  ? tr("Hardware step sensor is unavailable.", "फोन का हार्डवेयर स्टेप सेंसर उपलब्ध नहीं है।")
                  : tr("Could not sync the sensor. Try again.", "सेंसर सिंक नहीं हो सका। दोबारा कोशिश करें।")}
        </p>
      )}
      {error && (
        <p className="step-error">
          {error === "sensorUnavailable"
            ? tr("This phone does not have a TYPE_STEP_COUNTER sensor.", "इस फोन में असली TYPE_STEP_COUNTER सेंसर उपलब्ध नहीं है।")
            : error === "permissionDenied"
              ? tr("Activity Recognition permission is required to count steps.", "कदम गिनने के लिए Activity Recognition अनुमति आवश्यक है।")
              : tr("Check the sensor and Activity Recognition permission in the Android app.", "Android ऐप में सेंसर और Activity Recognition अनुमति जाँचें।")}
        </p>
      )}

      <p className="step-note">
        {tr(
          "Steps are measured by the phone's hardware sensor. Distance and calories are estimates. Background counting depends on Android permissions, battery settings, and the device.",
          "कदम फोन के असली हार्डवेयर सेंसर से लिए जाते हैं। दूरी और कैलोरी अनुमान हैं। बैकग्राउंड गिनती Android की अनुमति, बैटरी सेटिंग और डिवाइस पर निर्भर करती है।"
        )}
      </p>
    </section>
  );
}
