import { useEffect, useState } from "react";
import { registerPlugin } from "@capacitor/core";
import "./StepCounter.css";

const NativeStepCounter = registerPlugin("NativeStepCounter");
const KEY = "stepCounterData";
const DAILY_GOAL = 10000;
const STEP_METERS = 0.75;

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function safeSteps(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function readAllHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    const result = {};
    Object.entries(raw).forEach(([date, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const steps = safeSteps(value?.steps);
      result[date] = { ...(value && typeof value === "object" ? value : {}), steps };
    });
    return result;
  } catch {
    return {};
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    // Native SharedPreferences remain the primary sensor record.
  }
}

function getMonday(date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatNumber(value, lang) {
  return Number(value || 0).toLocaleString(lang === "en" ? "en-IN" : "hi-IN");
}

function formatDistance(steps, lang) {
  return ((steps * STEP_METERS) / 1000).toLocaleString(
    lang === "en" ? "en-IN" : "hi-IN",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );
}

function formatDate(dateKey, lang, options = {}) {
  return parseDateKey(dateKey).toLocaleDateString(
    lang === "en" ? "en-IN" : "hi-IN",
    options
  );
}

async function syncNativeHistory() {
  const status = await NativeStepCounter.getStatus();

  let nativeResult = null;
  try {
    nativeResult = await NativeStepCounter.getHistory();
  } catch {
    // Older installed APK versions may not yet expose getHistory().
  }

  const today = getDateKey();
  const updatedAt =
    Number(status?.lastUpdated) ||
    Number(nativeResult?.lastUpdated) ||
    0;

  const history = readAllHistory();
  const nativeHistory = nativeResult?.history;

  if (
    nativeHistory &&
    typeof nativeHistory === "object" &&
    !Array.isArray(nativeHistory)
  ) {
    Object.entries(nativeHistory).forEach(([date, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

      // Do not replace today's old saved value until the sensor
      // has actually produced a reading for today.
      if (date === today && updatedAt <= 0) return;

      history[date] = {
        ...(history[date] || {}),
        steps: safeSteps(value),
      };
    });
  }

  if (updatedAt > 0) {
    history[today] = {
      ...(history[today] || {}),
      steps: safeSteps(status?.steps),
    };
  }

  saveHistory(history);

  return {
    history,
    steps: safeSteps(history[today]?.steps),
    lastUpdated: updatedAt,
  };
}

function calculateRecords(history) {
  const entries = Object.entries(history)
    .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .map(([date, value]) => ({
      date,
      steps: safeSteps(value?.steps),
    }));

  const bestDay = entries.reduce(
    (best, item) => item.steps > (best?.steps ?? -1) ? item : best,
    null
  );

  const weeks = {};
  const months = {};

  entries.forEach((item) => {
    const date = parseDateKey(item.date);
    const mondayKey = getDateKey(getMonday(date));
    const monthKey = item.date.slice(0, 7);

    weeks[mondayKey] = (weeks[mondayKey] || 0) + item.steps;
    months[monthKey] = (months[monthKey] || 0) + item.steps;
  });

  const bestWeek = Object.entries(weeks).reduce(
    (best, [start, steps]) =>
      steps > (best?.steps ?? -1) ? { start, steps } : best,
    null
  );

  const bestMonth = Object.entries(months).reduce(
    (best, [month, steps]) =>
      steps > (best?.steps ?? -1) ? { month, steps } : best,
    null
  );

  return { entries, bestDay, bestWeek, bestMonth };
}

export default function StepCounter({ lang = "hi" }) {
  const tr = (en, hi) => lang === "en" ? en : hi;
  const locale = lang === "en" ? "en-IN" : "hi-IN";

  const [history, setHistory] = useState(readAllHistory);
  const [steps, setSteps] = useState(() => {
    return safeSteps(readAllHistory()[getDateKey()]?.steps);
  });
  const [period, setPeriod] = useState("day");
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
        const result = await syncNativeHistory();
        if (cancelled) return;

        setHistory(result.history);
        setSteps(result.steps);
        setLastUpdated(result.lastUpdated);
      } catch {
        // The next poll can recover if the native bridge is unavailable.
      }
    };

    const start = async () => {
      try {
        const available = await NativeStepCounter.isAvailable();

        if (!available?.available) {
          throw new Error("TYPE_STEP_COUNTER");
        }

        const permission = await NativeStepCounter.requestActivityPermission();

        if (!permission?.granted) {
          throw new Error("Activity Recognition");
        }

        await NativeStepCounter.initializeToday({
          steps: readAllHistory()[getDateKey()]?.steps || 0,
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

      // Do not stop the native service when this component unmounts.
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
        steps: readAllHistory()[getDateKey()]?.steps || 0,
      });

      await NativeStepCounter.startTracking();

      const result = await NativeStepCounter.refreshSensor();

      if (!result?.available || !result?.tracking) {
        throw new Error("trackingFailed");
      }

      const synced = await syncNativeHistory();

      setHistory(synced.history);
      setSteps(synced.steps);
      setLastUpdated(synced.lastUpdated);
      setMode("sensor");
      setStatus("active");
      setError("");

      setRefreshMessage(
        synced.lastUpdated > lastUpdated ? "success" : "waiting"
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

  const today = getDateKey();
  const todaySteps = safeSteps(history[today]?.steps);
  const percent = Math.min(100, Math.round((todaySteps / DAILY_GOAL) * 100));
  const calories = Math.round(todaySteps * 0.04);

  const now = new Date();
  let chartItems = [];
  let periodTitle = "";
  let periodSteps = 0;

  if (period === "day") {
    chartItems = Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(now, index - 6);
      const key = getDateKey(date);
      return {
        key,
        label: date.toLocaleDateString(locale, { weekday: "short" }),
        steps: safeSteps(history[key]?.steps),
      };
    });
    periodTitle = tr("Today", "आज");
    periodSteps = todaySteps;
  } else if (period === "week") {
    const monday = getMonday(now);
    chartItems = Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(monday, index);
      const key = getDateKey(date);
      return {
        key,
        label: date.toLocaleDateString(locale, { day: "numeric" }),
        steps: safeSteps(history[key]?.steps),
      };
    });
    periodTitle = tr("This week", "इस सप्ताह");
    periodSteps = chartItems.reduce((sum, item) => sum + item.steps, 0);
  } else {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    chartItems = Array.from({ length: days }, (_, index) => {
      const date = shiftDate(first, index);
      const key = getDateKey(date);
      return {
        key,
        label: String(index + 1),
        steps: safeSteps(history[key]?.steps),
      };
    });
    periodTitle = tr("This month", "इस महीने");
    periodSteps = chartItems.reduce((sum, item) => sum + item.steps, 0);
  }

  const chartMax = Math.max(1, ...chartItems.map((item) => item.steps));
  const periodDistance = (periodSteps * STEP_METERS) / 1000;
  const records = calculateRecords(history);

  const recentHistory = [...records.entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const bestWeekEnd = records.bestWeek
    ? getDateKey(shiftDate(parseDateKey(records.bestWeek.start), 6))
    : "";

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
          <h2>{tr("Step Counter", "स्टेप काउंटर")}</h2>
        </div>
        <span className="step-status-badge">{badge}</span>
      </div>

      <div className="step-total">
        <strong>{formatNumber(todaySteps, lang)}</strong>
        <span>{tr("steps today", "आज के कदम")}</span>
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
          <strong>{formatDistance(todaySteps, lang)} km</strong>
          <span>{tr("Estimated distance", "अनुमानित दूरी")}</span>
        </div>
        <div>
          <strong>{formatNumber(calories, lang)}</strong>
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
            : tr("Refresh / Reconnect", "रीफ्रेश / दोबारा कनेक्ट")}
        </button>
      </div>

      {lastUpdated > 0 && (
        <p className="step-sync-time">
          {tr("Last sensor update:", "आखिरी सेंसर अपडेट:")}{" "}
          {new Date(lastUpdated).toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
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

      <div className="step-history">
        <div className="step-history-heading">
          <h3>{tr("Activity History", "गतिविधि हिस्ट्री")}</h3>
          <span>{tr("Steps & distance", "कदम और दूरी")}</span>
        </div>

        <div className="step-period-tabs">
          <button type="button" className={period === "day" ? "active" : ""} onClick={() => setPeriod("day")}>
            {tr("Day", "दिन")}
          </button>
          <button type="button" className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>
            {tr("Week", "सप्ताह")}
          </button>
          <button type="button" className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>
            {tr("Month", "महीना")}
          </button>
        </div>

        <div className="step-period-summary">
          <div>
            <span>{periodTitle}</span>
            <strong>{formatNumber(periodSteps, lang)}</strong>
            <small>{tr("total steps", "कुल कदम")}</small>
          </div>
          <div>
            <span>{tr("Distance", "दूरी")}</span>
            <strong>{formatDistance(periodSteps, lang)} km</strong>
            <small>{tr("estimated", "अनुमानित")}</small>
          </div>
        </div>

        <div className={`step-chart ${period === "month" ? "monthly" : ""}`}>
          {chartItems.map((item) => (
            <div className="step-chart-column" key={item.key} title={`${item.key}: ${item.steps} steps`}>
              <div className="step-chart-track">
                <div
                  className="step-chart-bar"
                  style={{ height: `${item.steps > 0 ? Math.max(4, (item.steps / chartMax) * 100) : 0}%` }}
                />
              </div>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <p className="step-chart-caption">
          {period === "day"
            ? tr("Last 7 days", "पिछले 7 दिन")
            : period === "week"
              ? tr("Monday to Sunday", "सोमवार से रविवार")
              : tr("Daily steps this month", "इस महीने के प्रतिदिन के कदम")}
        </p>
      </div>

      <div className="step-best-records">
        <h3>{tr("Personal Records", "सबसे अच्छे रिकॉर्ड")}</h3>
        <div className="step-record-grid">
          <div>
            <span>{tr("Best day", "सबसे अच्छा दिन")}</span>
            <strong>{formatNumber(records.bestDay?.steps || 0, lang)}</strong>
            <small>
              {records.bestDay
                ? formatDate(records.bestDay.date, lang, { day: "numeric", month: "short" })
                : "—"}
            </small>
          </div>
          <div>
            <span>{tr("Best week", "सबसे अच्छा सप्ताह")}</span>
            <strong>{formatNumber(records.bestWeek?.steps || 0, lang)}</strong>
            <small>
              {records.bestWeek
                ? `${formatDate(records.bestWeek.start, lang, { day: "numeric", month: "short" })} – ${formatDate(bestWeekEnd, lang, { day: "numeric", month: "short" })}`
                : "—"}
            </small>
          </div>
          <div>
            <span>{tr("Best month", "सबसे अच्छा महीना")}</span>
            <strong>{formatNumber(records.bestMonth?.steps || 0, lang)}</strong>
            <small>
              {records.bestMonth
                ? parseDateKey(`${records.bestMonth.month}-01`).toLocaleDateString(locale, { month: "short", year: "numeric" })
                : "—"}
            </small>
          </div>
        </div>
      </div>

      <div className="step-saved-history">
        <h3>{tr("Saved Daily Records", "सुरक्षित दैनिक रिकॉर्ड")}</h3>
        {recentHistory.length === 0 ? (
          <p>{tr("No saved history yet.", "अभी कोई सुरक्षित हिस्ट्री नहीं है।")}</p>
        ) : (
          <div className="step-history-list">
            {recentHistory.map((item) => (
              <div className="step-history-row" key={item.date}>
                <span>{formatDate(item.date, lang, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}</span>
                <strong>{formatNumber(item.steps, lang)} {tr("steps", "कदम")}</strong>
                <small>{formatDistance(item.steps, lang)} km</small>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="step-note">
        {tr(
          "Steps are measured by the phone's hardware sensor. Distance and calories are estimates. Background counting depends on Android permissions, battery settings, and the device. Older saved history is preserved.",
          "कदम फोन के असली हार्डवेयर सेंसर से लिए जाते हैं। दूरी और कैलोरी अनुमान हैं। बैकग्राउंड गिनती Android की अनुमति, बैटरी सेटिंग और डिवाइस पर निर्भर करती है। पुरानी सुरक्षित हिस्ट्री को रखा गया है।"
        )}
      </p>
    </section>
  );
}
