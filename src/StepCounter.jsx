import { useEffect, useRef, useState } from "react";
import { CapacitorPedometer } from "@capgo/capacitor-pedometer";
import { CapacitorAccelerometer } from "@capgo/capacitor-accelerometer";
import "./StepCounter.css";

const KEY = "stepCounterData";
const DAILY_GOAL = 10000;

function getDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readToday() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const value = all[getDateKey()]?.steps;
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveToday(steps) {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    const all =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};

    all[getDateKey()] = { steps: Math.max(0, Math.floor(steps)) };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    console.warn("Step data could not be saved.");
  }
}

export default function StepCounter() {
  const [steps, setSteps] = useState(readToday);
  const [mode, setMode] = useState("starting");
  const [status, setStatus] = useState("फोन का सेंसर शुरू हो रहा है…");
  const [error, setError] = useState("");

  const active = useRef(false);
  const listener = useRef(null);
  const lastMotion = useRef(null);
  const lastStepAt = useRef(0);
  const estimatedSteps = useRef(readToday());

  const updateSteps = (value) => {
    const safe = Math.max(0, Math.floor(value));
    setSteps(safe);
    saveToday(safe);
  };

  const clearSensors = async () => {
    active.current = false;

    if (listener.current) {
      try {
        await listener.current.remove();
      } catch {}
      listener.current = null;
    }

    try {
      await CapacitorPedometer.stopMeasurementUpdates();
    } catch {}

    try {
      await CapacitorAccelerometer.stopMeasurementUpdates();
    } catch {}
  };

  const startPedometer = async () => {
    const available = await CapacitorPedometer.isAvailable();

    if (!available?.stepCounting) {
      throw new Error("असली Step Sensor उपलब्ध नहीं है।");
    }

    const permission = await CapacitorPedometer.requestPermissions();

    if (permission?.activityRecognition !== "granted") {
      throw new Error("Activity Recognition अनुमति नहीं मिली।");
    }

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const refresh = async () => {
      const result = await CapacitorPedometer.getMeasurement({
        start: midnight.getTime(),
        end: Date.now(),
      });

      if (active.current && Number.isFinite(result?.numberOfSteps)) {
        updateSteps(result.numberOfSteps);
      }
    };

    listener.current = await CapacitorPedometer.addListener(
      "measurement",
      () => refresh().catch(() => {})
    );

    active.current = true;

    try {
      await CapacitorPedometer.startMeasurementUpdates();
      await refresh();
      setMode("sensor");
      setStatus("फोन का Step Sensor सक्रिय है।");
      setError("");
    } catch (e) {
      await clearSensors();
      throw e;
    }
  };

  const startAccelerometer = async () => {
    const available = await CapacitorAccelerometer.isAvailable();

    if (!available?.isAvailable) {
      throw new Error("Accelerometer उपलब्ध नहीं है।");
    }

    const permission = await CapacitorAccelerometer.requestPermissions();

    if (permission?.accelerometer !== "granted") {
      throw new Error("Motion sensor अनुमति नहीं मिली।");
    }

    lastMotion.current = null;
    lastStepAt.current = 0;
    estimatedSteps.current = readToday();

    listener.current = await CapacitorAccelerometer.addListener(
      "measurement",
      ({ x, y, z }) => {
        if (!active.current) return;

        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const previous = lastMotion.current;
        lastMotion.current = magnitude;

        if (
          previous !== null &&
          Math.abs(magnitude - previous) > 0.16 &&
          Date.now() - lastStepAt.current > 350
        ) {
          lastStepAt.current = Date.now();
          estimatedSteps.current += 1;
          updateSteps(estimatedSteps.current);
        }
      }
    );

    active.current = true;

    try {
      await CapacitorAccelerometer.startMeasurementUpdates();
      setMode("motion");
      setStatus("Motion fallback सक्रिय है। कदम अनुमानित हैं।");
      setError("");
    } catch (e) {
      await clearSensors();
      throw e;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const startAutomatically = async () => {
      setMode("starting");
      setStatus("ऑटोमैटिक सेंसर चुना जा रहा है…");
      setError("");

      try {
        await startPedometer();
      } catch (sensorError) {
        if (cancelled) return;
        await clearSensors();
        setMode("error");
        setStatus("असली Step Sensor उपलब्ध नहीं है। गलत गिनती से बचने के लिए Motion Mode बंद है।");
        setError(sensorError?.message || "Pedometer शुरू नहीं हो सका। Android ऐप में सेंसर और Activity Recognition permission जाँचें।");
      }
    };

    startAutomatically();

    return () => {
      cancelled = true;
      active.current = false;

      if (listener.current) {
        listener.current.remove().catch(() => {});
        listener.current = null;
      }

      CapacitorPedometer.stopMeasurementUpdates().catch(() => {});
      CapacitorAccelerometer.stopMeasurementUpdates().catch(() => {});
    };
  }, []);

  const percent = Math.min(100, Math.round((steps / DAILY_GOAL) * 100));
  const distance = (steps * 0.75) / 1000;
  const calories = Math.round(steps * 0.04);

  const badge =
    mode === "sensor"
      ? "SENSOR ACTIVE"
      : mode === "motion"
        ? "MOTION MODE"
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
        सेंसर अपने-आप चुना जाता है। दूरी और कैलोरी अनुमान हैं।
        Motion mode में कदमों की सटीकता की गारंटी नहीं है।
        बैकग्राउंड ट्रैकिंग Android की अनुमति, डिवाइस और बैटरी
        सेटिंग पर निर्भर करती है।
      </p>
    </section>
  );
}
