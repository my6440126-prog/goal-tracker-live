import { useEffect, useState } from "react";
import "./Profile.css";

const PROFILE_KEY = "gtlLocalProfile";

function makeGtlId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "GTL-";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function readProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    if (saved && typeof saved === "object" && saved.id) {
      return {
        id: saved.id,
        name: typeof saved.name === "string" ? saved.name : "",
        photo: typeof saved.photo === "string" ? saved.photo : "",
        avatar: typeof saved.avatar === "string" ? saved.avatar : "🎯",
      };
    }
  } catch {
    // Create a new local profile if saved data is invalid.
  }

  return {
    id: makeGtlId(),
    name: "",
    photo: "",
    avatar: "🎯",
  };
}

const avatars = ["🎯", "🚀", "⭐", "🌻", "🦁", "🐼", "🎧", "💎"];

export default function Profile() {
  const [profile, setProfile] = useState(readProfile);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      setMessage("सेव नहीं हुआ। फोटो छोटी करके दोबारा चुनें।");
    }
  }, [profile]);

  function update(field, value) {
    setProfile((old) => ({ ...old, [field]: value }));
    setMessage("प्रोफाइल अपने-आप सेव हो रही है।");
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("कृपया image फोटो चुनें।");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("फोटो 2 MB से छोटी चुनें।");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update("photo", reader.result);
        setMessage("फोटो चुनी गई। प्रोफाइल सेव हो रही है।");
      }
    };
    reader.onerror = () => setMessage("फोटो पढ़ी नहीं जा सकी। दोबारा कोशिश करें।");
    reader.readAsDataURL(file);
  }

  return (
    <section className="profile-panel">
      <div className="profile-heading">
        <span className="profile-kicker">YOUR PERSONAL SPACE</span>
        <h2>👤 My Profile</h2>
        <p>अपनी पहचान और प्रोफाइल को व्यवस्थित करें।</p>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          {profile.photo ? (
            <img src={profile.photo} alt="Profile" />
          ) : (
            <span>{profile.avatar}</span>
          )}
        </div>

        <h3>{profile.name.trim() || "आपका नाम"}</h3>
        <div className="profile-id-label">YOUR GTL ID</div>
        <div className="profile-id">{profile.id}</div>
        <button
          type="button"
          className="profile-copy"
          onClick={() => {
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(profile.id)
                .then(() => setMessage("GTL ID कॉपी हो गई।"))
                .catch(() => setMessage("आपकी GTL ID ऊपर दिखाई गई है।"));
            } else {
              setMessage("आपकी GTL ID ऊपर दिखाई गई है।");
            }
          }}
        >
          📋 GTL ID कॉपी करें
        </button>
      </div>

      <div className="profile-form">
        <label htmlFor="gtl-profile-name">आपका नाम</label>
        <input
          id="gtl-profile-name"
          type="text"
          maxLength={40}
          value={profile.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="अपना नाम लिखें"
        />

        <label>अपना Avatar चुनें</label>
        <div className="profile-avatars">
          {avatars.map((avatar) => (
            <button
              type="button"
              key={avatar}
              className={profile.avatar === avatar && !profile.photo ? "avatar-choice selected" : "avatar-choice"}
              onClick={() => {
                setProfile((old) => ({ ...old, avatar, photo: "" }));
                setMessage("Avatar चुना गया।");
              }}
              aria-label={`Avatar ${avatar}`}
            >
              {avatar}
            </button>
          ))}
        </div>

        <label htmlFor="gtl-profile-photo">Gallery से फोटो चुनें</label>
        <input
          id="gtl-profile-photo"
          className="profile-file"
          type="file"
          accept="image/*"
          onChange={selectPhoto}
        />

        {profile.photo && (
          <button
            type="button"
            className="profile-remove-photo"
            onClick={() => {
              setProfile((old) => ({ ...old, photo: "" }));
              setMessage("फोटो हटाई गई।");
            }}
          >
            फोटो हटाएँ
          </button>
        )}

        <p className="profile-note">
          🔒 आपकी प्रोफाइल इसी डिवाइस के ब्राउज़र में सेव होती है।
          GTL ID अभी ऑनलाइन अकाउंट या दूसरे फोन पर लॉगिन की सुविधा नहीं है।
        </p>

        <p className="profile-message" aria-live="polite">{message}</p>
      </div>
    </section>
  );
}
