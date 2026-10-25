import { useEffect, useRef, useState } from "react";
import "./MusicZone.css";
import OnlineMusic from "./OnlineMusic.jsx";

const MUSIC_DB_NAME = "goal-tracker-music";
const MUSIC_STORE_NAME = "tracks";

function openMusicDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB उपलब्ध नहीं है"));
      return;
    }

    const request = indexedDB.open(MUSIC_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MUSIC_STORE_NAME)) {
        db.createObjectStore(MUSIC_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMusicTrack(track) {
  const db = await openMusicDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUSIC_STORE_NAME, "readwrite");
    tx.objectStore(MUSIC_STORE_NAME).put(track);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("गाना सेव नहीं हुआ"));
    };
  });
}

async function loadMusicTracks() {
  const db = await openMusicDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUSIC_STORE_NAME, "readonly");
    const request = tx.objectStore(MUSIC_STORE_NAME).getAll();
    let result = [];

    request.onsuccess = () => {
      result = request.result || [];
    };
    tx.oncomplete = () => {
      db.close();
      result.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function deleteMusicTrack(id) {
  const db = await openMusicDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUSIC_STORE_NAME, "readwrite");
    tx.objectStore(MUSIC_STORE_NAME).delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}


export default function MusicZone() {
  const audio = useRef(null);
  const urls = useRef([]);
  const [tracks, setTracks] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");

  const current = tracks[index];

  useEffect(() => {
    return () => urls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let active = true;

    loadMusicTracks()
      .then(saved => {
        if (!active) return;

        const restored = saved.map(item => {
          const url = URL.createObjectURL(item.blob);
          urls.current.push(url);
          return { id: item.id, name: item.name, url, source: "phone" };
        });

        setTracks(restored);
        if (restored.length) {
          setMessage(restored.length + " सेव किए गए गाने लोड हुए।");
        }
      })
      .catch(() => {
        if (active) {
          setMessage("सेव की गई Playlist लोड नहीं हो सकी।");
        }
      });

    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
    const player = audio.current;
    if (!player || !current) return;

    setProgress(0);
    setDuration(0);
    player.load();

    if (autoPlay) {
      player.play()
        .then(() => {
          setPlaying(true);
          setMessage("");
        })
        .catch(() => {
          setPlaying(false);
          setMessage("गाना नहीं चल पाया। Play बटन दबाकर कोशिश करें।");
        });
      setAutoPlay(false);
    }
  }, [current?.url]);

  async function chooseFiles(event) {
    const selected = Array.from(event.target.files || []);
    const files = selected.filter(file =>
      file.type.startsWith("audio/") ||
      /\.(mp3|m4a|aac|wav|ogg|opus|flac|3gp|amr)$/i.test(file.name)
    );

    if (!files.length) {
      if (selected.length) setMessage("कृपया MP3, M4A या दूसरी ऑडियो फ़ाइल चुनें।");
      event.target.value = "";
      return;
    }

    const added = [];
    let saveFailed = false;

    for (const audioFile of files) {
      const id = globalThis.crypto?.randomUUID?.() ||
        (Date.now().toString(36) + Math.random().toString(36).slice(2));
      const name = audioFile.name.replace(/\.[^.]+$/, "");
      const url = URL.createObjectURL(audioFile);

      urls.current.push(url);
      added.push({ id, name, url, source: "phone" });

      try {
        await saveMusicTrack({
          id,
          name,
          blob: audioFile,
          createdAt: Date.now()
        });
      } catch {
        saveFailed = true;
      }
    }

    setTracks(old => [...old, ...added]);
    setPlaying(false);
    setAutoPlay(false);
    setMessage(
      saveFailed
        ? "गाने जोड़े गए, लेकिन कुछ सेव नहीं हो सके। स्टोरेज की अनुमति और जगह जाँचें।"
        : added.length + " गाने Playlist में जोड़े और सेव किए गए।"
    );
    event.target.value = "";
  }

  function addOnlineTrack(track) {
    const onlineId = "online-" + track.id;
    const existingIndex = tracks.findIndex(item => item.id === onlineId);

    if (existingIndex >= 0) {
      setIndex(existingIndex);
      setProgress(0);
      setDuration(0);
      setAutoPlay(true);
      setMessage("");
      return;
    }

    const onlineTrack = {
      id: onlineId,
      name: track.title,
      url: track.url,
      source: "online",
      license: track.license,
      pageUrl: track.pageUrl
    };

    setTracks(old => [...old, onlineTrack]);
    setIndex(tracks.length);
    setProgress(0);
    setDuration(0);
    setAutoPlay(true);
    setMessage("ऑनलाइन गाना साझा Playlist में जोड़ा गया।");
  }

  async function togglePlay() {
    const player = audio.current;
    if (!player || !current) return;

    if (!player.paused) {
      player.pause();
      setPlaying(false);
      return;
    }

    try {
      await player.play();
      setPlaying(true);
      setMessage("");
    } catch {
      setPlaying(false);
      setMessage("गाना नहीं चल पाया। दूसरी ऑडियो फ़ाइल चुनकर देखें।");
    }
  }

  function move(step) {
    if (tracks.length < 2) return;

    let next;
    if (shuffle && step === 1) {
      const choices = tracks.map((_, i) => i).filter(i => i !== index);
      next = choices[Math.floor(Math.random() * choices.length)];
    } else {
      next = (index + step + tracks.length) % tracks.length;
    }

    setIndex(next);
    setProgress(0);
    setDuration(0);
    setAutoPlay(true);
    setMessage("");
  }

  function selectTrack(i) {
    if (i === index) {
      togglePlay();
      return;
    }
    setIndex(i);
    setAutoPlay(true);
    setMessage("");
  }

  function removeTrack(i) {
    const removed = tracks[i];
    if (!removed) return;
    if (removed.source !== "online") {
      deleteMusicTrack(removed.id).catch(() => {
        setMessage("गाना हटाया गया, लेकिन सेव स्टोरेज से हटाने में समस्या हुई।");
      });
    }

    const wasCurrent = i === index;
    const nextTracks = tracks.filter((_, n) => n !== i);

    if (audio.current && wasCurrent) {
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
    }

    setTracks(nextTracks);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setAutoPlay(false);

    if (nextTracks.length === 0) {
      setIndex(0);
    } else if (i < index) {
      setIndex(index - 1);
    } else if (wasCurrent) {
      setIndex(Math.min(i, nextTracks.length - 1));
    }

    if (removed.source !== "online") {
      URL.revokeObjectURL(removed.url);
      urls.current = urls.current.filter(url => url !== removed.url);
    }
    setMessage("गाना प्लेलिस्ट से हटा दिया गया।");
  }

  function time(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  return (
    <section className="music-card">
      <div className="music-title">
        <span>🎵</span>
        <div>
          <h2>Music Zone</h2>
          <p>अपने फोन के गाने चुनें और सुनें</p>
        </div>
      </div>

      <label className="music-pick">
        <span>＋ गाने चुनें</span>
        <input
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.3gp,.amr"
          multiple
          onChange={chooseFiles}
        />
      </label>

      <div className="music-art">♫</div>
      <h3 className="music-track">
        {current ? current.name : "अभी कोई गाना नहीं चुना"}
      </h3>
      <p className="music-subtitle">
        {current ? `${index + 1} / ${tracks.length} गाने` : "फोन से ऑडियो फ़ाइल चुनें"}
      </p>

      <audio
        ref={audio}
        src={current?.url || undefined}
        preload="metadata"
        onTimeUpdate={e => setProgress(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => tracks.length > 1 ? move(1) : setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setMessage("यह ऑडियो फ़ाइल नहीं चल सकी। दूसरी फ़ाइल चुनकर देखें।");
        }}
      />

      <input
        className="music-progress"
        type="range"
        min="0"
        max={duration || 0}
        step="1"
        value={Math.min(progress, duration || 0)}
        disabled={!current || !duration}
        onChange={e => {
          const value = Number(e.target.value);
          if (audio.current) audio.current.currentTime = value;
          setProgress(value);
        }}
        aria-label="Music progress"
      />

      <div className="music-time">
        <span>{time(progress)}</span>
        <span>{time(duration)}</span>
      </div>

      <div className="music-controls">
        <button disabled={tracks.length < 2} onClick={() => move(-1)} aria-label="Previous track">⏮</button>
        <button className="music-play" disabled={!current} onClick={togglePlay}>
          {playing ? "Ⅱ Pause" : "▶ Play"}
        </button>
        <button disabled={tracks.length < 2} onClick={() => move(1)} aria-label="Next track">⏭</button>
      </div>

      <button
        className={`music-shuffle ${shuffle ? "active" : ""}`}
        disabled={tracks.length < 2}
        onClick={() => setShuffle(value => !value)}
      >
        🔀 Shuffle {shuffle ? "ON" : "OFF"}
      </button>

      {message && <p className="music-note" role="status">{message}</p>}

      <div className="music-playlist-heading">
        <h3>🎶 Playlist</h3>
        <span>{tracks.length} गाने</span>
      </div>

      {tracks.length > 0 ? (
        <div className="music-list">
          {tracks.map((track, i) => (
            <div className={`music-list-row ${i === index ? "selected" : ""}`} key={track.id || track.url}>
              <button className="music-track-select" onClick={() => selectTrack(i)}>
                <span>{i === index && playing ? "♫ " : "▶ "}{track.name}</span>
                <span>{i === index ? "चल रहा" : `${i + 1}`}</span>
              </button>
              <button className="music-remove" onClick={() => removeTrack(i)} aria-label={`${track.name} हटाएँ`}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="music-empty">आपके चुने हुए गाने यहाँ दिखाई देंगे।</p>
      )}

      <OnlineMusic onAddTrack={addOnlineTrack} />

      <p className="music-note">
        गाने इसी पेज पर चलेंगे। बैकग्राउंड प्लेबैक ब्राउज़र और डिवाइस की सीमाओं पर निर्भर है।
      </p>
    </section>
  );
}
