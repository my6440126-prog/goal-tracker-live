import { useEffect, useState } from "react";
import "./App.css";

function App() {
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

  const [history, setHistory] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("goalHistory")) || {}
      );
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("goals", JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem("streak", JSON.stringify(streak));
  }, [streak]);

  useEffect(() => {
    localStorage.setItem(
      "goalHistory",
      JSON.stringify(history)
    );
  }, [history]);

  // Today's date
  const getToday = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Save today's progress
  const saveProgress = (nextGoals) => {
    const completedCount = nextGoals.filter(
      (item) => item.completed
    ).length;

    const totalCount = nextGoals.length;

    const progressValue =
      totalCount === 0
        ? 0
        : Math.round(
            (completedCount / totalCount) * 100
          );

    setHistory((previous) => ({
      ...previous,
      [getToday()]: {
        total: totalCount,
        completed: completedCount,
        progress: progressValue,
      },
    }));
  };

  // Add Goal
  const addGoal = () => {
    if (!goal.trim()) return;

    const nextGoals = [
      ...goals,
      {
        id: Date.now(),
        name: goal.trim(),
        completed: false,
      },
    ];

    setGoals(nextGoals);
    saveProgress(nextGoals);
    setGoal("");
  };

  // Complete / Undo
  const toggleGoal = (id) => {
    const selectedGoal = goals.find(
      (item) => item.id === id
    );

    if (!selectedGoal) return;

    const nextGoals = goals.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          completed: !item.completed,
        };
      }

      return item;
    });

    setGoals(nextGoals);
    saveProgress(nextGoals);

    // Streak update when completing
    if (!selectedGoal.completed) {
      const today = getToday();

      if (streak.lastCompletedDate === today) {
        return;
      }

      let nextStreak = 1;

      if (streak.lastCompletedDate) {
        const lastDate = new Date(
          streak.lastCompletedDate + "T00:00:00"
        );

        const currentDate = new Date(
          today + "T00:00:00"
        );

        const difference = Math.round(
          (currentDate - lastDate) / 86400000
        );

        if (difference === 1) {
          nextStreak = streak.current + 1;
        }
      }

      setStreak({
        current: nextStreak,
        lastCompletedDate: today,
      });
    }
  };

  // Delete Goal
  const deleteGoal = (id) => {
    const nextGoals = goals.filter(
      (item) => item.id !== id
    );

    setGoals(nextGoals);
    saveProgress(nextGoals);
  };

  // Start Edit
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.name);
  };

  // Save Edit
  const saveEdit = (id) => {
    if (!editingText.trim()) return;

    const nextGoals = goals.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          name: editingText.trim(),
        };
      }

      return item;
    });

    setGoals(nextGoals);
    saveProgress(nextGoals);

    setEditingId(null);
    setEditingText("");
  };

  // Progress
  const completed = goals.filter(
    (item) => item.completed
  ).length;

  const progress =
    goals.length === 0
      ? 0
      : Math.round(
          (completed / goals.length) * 100
        );

  // Last 7 days
  const lastSevenDays = Array.from(
    { length: 7 },
    (_, index) => {
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
        label = date.toLocaleDateString(
          "en-IN",
          {
            weekday: "long",
            day: "numeric",
            month: "short",
          }
        );
      }

      return {
        key,
        label,
      };
    }
  );

  return (
    <div className="app">

      <header>
        <h1>🎯 Goal Tracker Live</h1>

        <p>
          Track your goals. Build your future.
        </p>
      </header>

      {/* Progress */}
      <section className="progress-card">
        <h2>Today's Progress</h2>

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
              background: "#16a34a",
            }}
          />
        </div>
      </section>

      {/* Add Goal */}
      <section className="add-goal">
        <h2>➕ Add Goal</h2>

        <input
          type="text"
          placeholder="Enter your goal..."
          value={goal}
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
            No goals yet. Add your first goal!
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
                  <span>{item.name}</span>

                  <button
                    onClick={() =>
                      toggleGoal(item.id)
                    }
                  >
                    {item.completed
                      ? "↩️ Undo"
                      : "Complete"}
                  </button>

                  <button
                    onClick={() =>
                      startEdit(item)
                    }
                  >
                    ✏️ Edit
                  </button>

                  <button
                    onClick={() =>
                      deleteGoal(item.id)
                    }
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </section>

      {/* Streak */}
      <section className="streak">
        <h2>🔥 Streak</h2>

        <strong>
          {streak.current} Days
        </strong>

        <p>
          {streak.current > 0
            ? "Great! Keep your streak going!"
            : "Complete a goal to start your streak!"}
        </p>
      </section>

      {/* History */}
      <section className="history">
        <h2>📅 7-Day History</h2>

        {lastSevenDays.map((day) => {
          const record = history[day.key];

          return (
            <div
              key={day.key}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <strong>{day.label}</strong>

              {record ? (
                <>
                  <p>
                    {record.completed} of{" "}
                    {record.total} goals completed ·{" "}
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
                        background: "#16a34a",
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