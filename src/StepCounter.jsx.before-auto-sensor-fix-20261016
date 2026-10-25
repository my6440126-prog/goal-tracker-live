
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
    const record = all[getDateKey()];
    return Number.isSafeInteger(record?.steps) && record.steps >= 0
      ? record.steps
      : 0;
  } catch {
    return 0;
  }
}

function saveToday(steps) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const data = all && typeof all === "object" && !Array.isArray(all) ? all : {};
    data[getDateKey()] = { steps: Math.max(0, Math.floor(steps)) };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    console.warn("Step data could not be saved.");
  }
}

export default function StepCounter() {
  const [steps, setSteps] = useState(readToday);
  const [mode, setMode] = useState("idle");
  const [status, setStatus] = useState("कदम गिनना शुरू करने के लिए बटन दबाएँ।");
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

  const stop = async () => {
    active.current = false;

    if (listener.current) {
      await listener.current.remove().catch(() => {});
      listener.current = null;
    }

    await CapacitorPedometer.stopMeasurementUpdates().catch(() => {});
    await CapacitorAccelerometer.stopMeasurementUpdates().catch(() => {});

    setMode("idle");
    setStatus("Tracking बंद है।");
  };

  useEffect(() => {
    return () => {
      active.current = false;
      if (listener.current) listener.current.remove().catch(() => {});
      CapacitorPedometer.stopMeasurementUpdates().catch(() => {});
      CapacitorAccelerometer.stopMeasurementUpdates().catch(() => {});
    };
  }, []);

  const startSensor = async () => {
    setError("");

    try {
      const available = await CapacitorPedometer.isAvailable();
      if (!available.stepCounting) {
        throw new Error("Step sensor उपलब्ध नहीं है। Motion fallback इस्तेमाल करें।");
      }

      const permission = await CapacitorPedometer.requestPermissions();
      if (permission.activityRecognition !== "granted") {
        throw new Error("Activity Recognition permission की अनुमति दें।");
      }

      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);

      const refresh = async () => {
        const result = await CapacitorPedometer.getMeasurement({
          start: midnight.getTime(),
          end: Date.now(),
        });

        if (active.current && Number.isFinite(result.numberOfSteps)) {
          updateSteps(result.numberOfSteps);
        }
      };

      listener.current = await CapacitorPedometer.addListener(
        "measurement",
        () => refresh().catch(() => {})
      );

      await CapacitorPedometer.startMeasurementUpdates();
      active.current = true;
      setMode("sensor");
      setStatus("फोन का step sensor चालू है।");
      await refresh();
    } catch (e) {
      setError(e?.message || "Step sensor शुरू नहीं हो पाया।");
    }
  };

  const startMotion = async () => {
    setError("");

    try {
      const available = await CapacitorAccelerometer.isAvailable();
      if (!available.isAvailable) {
        throw new Error("Accelerometer उपलब्ध नहीं है।");
      }

      const permission = await CapacitorAccelerometer.requestPermissions();
      if (permission.accelerometer !== "granted") {
        throw new Error("Motion sensor permission की अनुमति दें।");
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

      await CapacitorAccelerometer.startMeasurementUpdates();
      active.current = true;
      setMode("motion");
      setStatus("Motion fallback चालू है; कदम अनुमानित हैं।");
    } catch (e) {
      setError(e?.message || "Motion fallback शुरू नहीं हुआ।");
    }
  };

  const percent = Math.min(100, Math.round((steps / DAILY_GOAL) * 100));
  const distance = (steps * 0.75) / 1000;
  const calories = Math.round(steps * 0.04);

  return (
    <section className="step-card">
      <div className="step-title-row">
        <div>
          <p className="step-label">DAILY ACTIVITY</p>
          <h2>👟 Step Counter</h2>
        </div>
        <span className="step-status-badge">
          {mode === "idle" ? "READY" : "ACTIVE"}
        </span>
      </div>

      <div className="step-total">
        <strong>{steps.toLocaleString("en-IN")}</strong>
        <span>कदम</span>
      </div>

      <div className="step-bar">
        <div style={{ width: `${percent}%` }} />
      </div>

      <p className="step-percent">{percent}% · दैनिक लक्ष्य 10,000 कदम</p>

      <div className="step-stats">
        <div><strong>{distance.toFixed(2)} km</strong><span>अनुमानित दूरी</span></div>
        <div><strong>{calories}</strong><span>अनुमानित kcal</span></div>
      </div>

      <p className="step-message">{status}</p>
      {error && <p className="step-error">{error}</p>}

      <div className="step-buttons">
        <button onClick={startSensor} disabled={mode !== "idle"}>📱 Step Sensor</button>
        <button onClick={startMotion} disabled={mode !== "idle"}>🏃 Motion Fallback</button>
        <button onClick={stop} disabled={mode === "idle"}>⏹ Stop</button>
      </div>

      <p className="step-note">
        दूरी और कैलोरी अनुमान हैं। Motion fallback सटीक step counter नहीं है।
        लगातार background tracking की गारंटी नहीं है।
      </p>
    </section>
  );
}
