import { useEffect, useState } from "react";
import "./App.css";

function App() {
const getToday = () => {
const date = new Date();
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");

return `${year}-${month}-${day}`;

};

const [goal, setGoal] = useState("");

const [goals, setGoals] = useState(() => {
try {
return JSON.parse(localStorage.getItem("goals")) || [];
} catch {
return [];
}
});

const [editingId, setEditingId] = useState(null);
const [editingText, setEditingText] = useState("");

const [history, setHistory] = useState(() => {
try {
return JSON.parse(localStorage.getItem("goalHistory")) || {};
} catch {
return {};
}
});

const [streak, setStreak] = useState(() => {
try {
return (
JSON.parse(localStorage.getItem("streak")) || {
current: 0,
lastCompletedDate: null,
}
);
} catch {
return {
current: 0,
lastCompletedDate: null,
};
}
});

useEffect(() => {
localStorage.setItem("goals", JSON.stringify(goals));
}, [goals]);

useEffect(() => {
localStorage.setItem("goalHistory", JSON.stringify(history));
}, [history]);

useEffect(() => {
localStorage.setItem("streak", JSON.stringify(streak));
}, [streak]);

const completed = goals.filter((item) => item.completed).length;

const progress =
goals.length === 0
? 0
: Math.round((completed / goals.length) * 100);

const saveProgress = (nextGoals) => {
const total = nextGoals.length;
const done = nextGoals.filter((item) => item.completed).length;

const percentage =
  total === 0 ? 0 : Math.round((done / total) * 100);

setHistory((previous) => ({
  ...previous,
  [getToday()]: {
    total,
    completed: done,
    progress: percentage,
  },
}));

};

const updateStreak = (nextGoals) => {
if (nextGoals.length === 0) return;

const allCompleted = nextGoals.every(
  (item) => item.completed
);

if (!allCompleted) return;

const today = getToday();

if (streak.lastCompletedDate === today) return;

let nextCurrent = 1;

if (streak.lastCompletedDate) {
  const previousDate = new Date(
    streak.lastCompletedDate + "T00:00:00"
  );

  const currentDate = new Date(
    today + "T00:00:00"
  );

  const difference = Math.round(
    (currentDate - previousDate) / 86400000
  );

  if (difference === 1) {
    nextCurrent = streak.current + 1;
  }
}

setStreak({
  current: nextCurrent,
  lastCompletedDate: today,
});

};

const addGoal = () => {
const trimmedGoal = goal.trim();

if (!trimmedGoal) return;

const nextGoals = [
  ...goals,
  {
    id: Date.now(),
    name: trimmedGoal,
    completed: false,
  },
];

setGoals(nextGoals);
saveProgress(nextGoals);
setGoal("");

};

const toggleGoal = (id) => {
const nextGoals = goals.map((item) =>
item.id === id
? {
...item,
completed: !item.completed,
}
: item
);

setGoals(nextGoals);
saveProgress(nextGoals);
updateStreak(nextGoals);

};

const deleteGoal = (id) => {
const nextGoals = goals.filter(
(item) => item.id !== id
);

setGoals(nextGoals);
saveProgress(nextGoals);

};

const startEdit = (item) => {
setEditingId(item.id);
setEditingText(item.name);
};

const saveEdit = (id) => {
const trimmedText = editingText.trim();

if (!trimmedText) return;

const nextGoals = goals.map((item) =>
  item.id === id
    ? {
        ...item,
        name: trimmedText,
      }
    : item
);

setGoals(nextGoals);
saveProgress(nextGoals);
setEditingId(null);
setEditingText("");

};

const getLastSevenDays = () => {
return Array.from({ length: 7 }, (_, index) => {
const date = new Date();

  date.setDate(date.getDate() - index);

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const key = `${year}-${month}-${day}`;

  let label;

  if (index === 0) {
    label = "Today";
  } else if (index === 1) {
    label = "Yesterday";
  } else {
    label = date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  return {
    key,
    label,
  };
});

};

const lastSevenDays = getLastSevenDays();

return (
<div className="app">

  <header>
    <h1>🎯 Goal Tracker Live</h1>

    <p>
      Build better habits, one goal at a time.
    </p>
  </header>

  {/* Progress */}

  <section className="progress-card">
    <h2>📊 Today's Progress</h2>

    <div className="progress-number">
      {progress}%
    </div>

    <p>
      {completed} of {goals.length} goals completed
    </p>

    <div
      style={{
        background: "#e5e7eb",
        borderRadius: "20px",
        height: "10px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background:
            "linear-gradient(90deg,#2563eb,#7c3aed)",
          transition: "width 0.3s ease",
        }}
      />
    </div>
  </section>

  {/* Add Goal */}

  <section className="add-goal">
    <h2>➕ Add New Goal</h2>

    <input
      type="text"
      placeholder="What do you want to achieve?"
      value={goal}
      maxLength={80}
      onChange={(e) => setGoal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          addGoal();
        }
      }}
    />

    <button onClick={addGoal}>
      Add Goal
    </button>
  </section>

  {/* Goals */}

  <section className="goals">
    <h2>🎯 My Goals</h2>

    {goals.length === 0 ? (
      <p>
        No goals yet. Add your first goal above 🚀
      </p>
    ) : (
      goals.map((item) => (
        <div
          className={`goal ${
            item.completed ? "done" : ""
          }`}
          key={item.id}
        >
          {editingId === item.id ? (
            <>
              <input
                type="text"
                value={editingText}
                maxLength={80}
                onChange={(e) =>
                  setEditingText(e.target.value)
                }
              />

              <button
                onClick={() =>
                  saveEdit(item.id)
                }
              >
                Save
              </button>
            </>
          ) : (
            <>
              <span>
                {item.completed ? "✅ " : "⭕ "}
                {item.name}
              </span>

              <button
                onClick={() =>
                  toggleGoal(item.id)
                }
              >
                {item.completed
                  ? "Undo"
                  : "Complete"}
              </button>

              <button
                onClick={() =>
                  startEdit(item)
                }
              >
                ✏️
              </button>

              <button
                onClick={() =>
                  deleteGoal(item.id)
                }
              >
                🗑️
              </button>
            </>
          )}
        </div>
      ))
    )}
  </section>

  {/* Streak */}

  <section className="streak">
    <h2>🔥 Current Streak</h2>

    <strong>
      {streak.current} Days
    </strong>

    <p>
      {streak.current > 0
        ? "Amazing! Keep going 🔥"
        : "Complete all your goals to start your streak."}
    </p>
  </section>

  {/* History */}

  <section className="history">
    <h2>📅 7-Day History</h2>

    {lastSevenDays.map((day) => {
      const record = history[day.key];

      return (
        <div key={day.key}>
          <strong>{day.label}</strong>

          {record ? (
            <>
              <p>
                {record.completed} of{" "}
                {record.total} completed ·{" "}
                {record.progress}%
              </p>

              <div
                style={{
                  background: "#e5e7eb",
                  height: "8px",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${record.progress}%`,
                    height: "100%",
                    background:
                      "linear-gradient(90deg,#2563eb,#7c3aed)",
                    transition:
                      "width 0.3s ease",
                  }}
                />
              </div>
            </>
          ) : (
            <p>No activity recorded</p>
          )}
        </div>
      );
    })}
  </section>

</div>

);
}

export default App;
