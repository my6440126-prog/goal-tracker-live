import { useEffect, useState } from "react";
import "./ExerciseTimer.css";

const KEY = "goalTrackerExerciseSessions";
const activities = ["Walking", "Running", "Cycling", "Workout", "Yoga", "Skipping"];

function readSessions() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(n => String(n).padStart(2, "0"))
    .join(":");
}

export default function ExerciseTimer() {
  const [activity, setActivity] = useState("Walking");
  const [timerType, setTimerType] = useState("stopwatch");
  const [minutes, setMinutes] = useState("15");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(readSessions);

  const duration = Math.max(1, Number(minutes) || 1) * 60;
  const shownTime = timerType === "countdown"
    ? Math.max(0, duration - elapsed)
    : elapsed;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (timerType === "countdown" && elapsed >= duration && running) {
      setRunning(false);
    }
  }, [elapsed, duration, timerType, running]);

  function start() {
    if (timerType === "countdown" && elapsed >= duration) setElapsed(0);
    setRunning(true);
  }

  function finish() {
    setRunning(false);
    if (elapsed > 0) {
      const entry = {
        id: Date.now(),
        activity,
        seconds: timerType === "countdown" ? Math.min(elapsed, duration) : elapsed,
        date: new Date().toISOString()
      };
      const updated = [entry, ...sessions].slice(0, 100);
      setSessions(updated);
      try {
        localStorage.setItem(KEY, JSON.stringify(updated));
      } catch {
        console.warn("Exercise history could not be saved.");
      }
    }
    setElapsed(0);
  }

  return (
    <section className="exercise-card">
      <div className="exercise-heading">
        <span>⏱️</span>
        <div>
          <h2>Exercise Timer</h2>
          <p>अपनी एक्सरसाइज़ का समय ट्रैक करें</p>
        </div>
      </div>

      <label className="exercise-label">Activity</label>
      <select value={activity} onChange={e => setActivity(e.target.value)} disabled={running}>
        {activities.map(item => <option key={item}>{item}</option>)}
      </select>

      <div className="exercise-mode">
        <button className={timerType === "stopwatch" ? "active" : ""}
          onClick={() => { setRunning(false); setElapsed(0); setTimerType("stopwatch"); }}>
          Stopwatch
        </button>
        <button className={timerType === "countdown" ? "active" : ""}
          onClick={() => { setRunning(false); setElapsed(0); setTimerType("countdown"); }}>
          Countdown
        </button>
      </div>

      {timerType === "countdown" && (
        <label className="exercise-label">
          लक्ष्य समय (मिनट)
          <input type="number" min="1" max="300" value={minutes}
            disabled={running}
            onChange={e => setMinutes(e.target.value)} />
        </label>
      )}

      <div className="exercise-clock">{clock(shownTime)}</div>
      <p className="exercise-status">
        {running ? "● Exercise चल रही है" : elapsed > 0 ? "Paused" : "शुरू करने के लिए तैयार"}
      </p>

      <div className="exercise-actions">
        {!running ? (
          <button onClick={start}>{elapsed > 0 ? "▶ Resume" : "▶ Start"}</button>
        ) : (
          <button onClick={() => setRunning(false)}>Ⅱ Pause</button>
        )}
        <button className="finish" onClick={finish} disabled={elapsed === 0}>
          ■ Finish
        </button>
      </div>

      <div className="exercise-history">
        <h3>📋 Exercise History</h3>
        {sessions.length === 0 ? <p>अभी कोई Exercise Session सेव नहीं है।</p> :
          sessions.slice(0, 5).map(item => (
            <div className="exercise-session" key={item.id}>
              <span>{item.activity}<small>{new Date(item.date).toLocaleDateString("en-IN")}</small></span>
              <strong>{clock(item.seconds)}</strong>
            </div>
          ))}
      </div>
    </section>
  );
}
