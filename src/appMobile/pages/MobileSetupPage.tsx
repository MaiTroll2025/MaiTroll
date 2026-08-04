import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Mic,
  MonitorUp,
  Radio,
  Save,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import MobilePageShell from "../MobilePageShell";

type StreamMode = "camera" | "obs" | "screen";
type StreamCategory = "general" | "battle" | "gaming" | "podcast" | "auction" | "church";

const categories: Array<{
  key: StreamCategory;
  label: string;
  description: string;
}> = [
  {
    key: "general",
    label: "General",
    description: "Regular live broadcast.",
  },
  {
    key: "battle",
    label: "Battle",
    description: "Start with battle energy.",
  },
  {
    key: "gaming",
    label: "Gaming",
    description: "OBS or gameplay stream.",
  },
  {
    key: "podcast",
    label: "Podcast",
    description: "Talk show or audio room.",
  },
  {
    key: "auction",
    label: "Auction",
    description: "Sell live with viewers.",
  },
  {
    key: "church",
    label: "Church",
    description: "Pastor/church live session.",
  },
];

const setupChecks = [
  {
    label: "Camera access",
    icon: Camera,
  },
  {
    label: "Microphone access",
    icon: Mic,
  },
  {
    label: "Broadcast rules",
    icon: ShieldCheck,
  },
  {
    label: "Gift system",
    icon: Sparkles,
  },
];

export default function MobileSetupPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<StreamCategory>("general");
  const [streamMode, setStreamMode] = useState<StreamMode>("camera");
  const [saveBroadcast, setSaveBroadcast] = useState(false);
  const [paidChatEnabled, setPaidChatEnabled] = useState(false);
  const [seatPrice, setSeatPrice] = useState("0");
  const [isStarting, setIsStarting] = useState(false);

  const canStart = title.trim().length >= 3 && !isStarting;

  const handleStartBroadcast = async () => {
    if (!canStart) return;

    setIsStarting(true);

    try {
      // Fresh mobile app placeholder:
      // Later we will wire this into the existing desktop/shared stream-start logic.
      console.log("[MobileSetupPage] Start broadcast requested", {
        title,
        category,
        streamMode,
        saveBroadcast,
        paidChatEnabled,
        seatPrice,
      });

      // Keep user inside fresh app flow for now.
      // Once real mobile stream creation is wired, navigate to `/broadcast/${streamId}`.
      navigate("/broadcast/preview");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <MobilePageShell
      title="Go Live Setup"
      eyebrow="Broadcast"
      subtitle="Fresh mobile setup flow. This will connect to the existing stream-start logic after the app shell is stable."
      showBackButton
      rightAction={
        <button
          type="button"
          className="tc-mobile-setup__save-btn"
          onClick={() => console.log("[MobileSetupPage] Save draft clicked")}
        >
          <Save size={17} />
        </button>
      }
    >
      <section className="tc-mobile-setup__preview-card">
        <div className="tc-mobile-setup__preview-glow" />

        <div className="tc-mobile-setup__preview-screen">
          {streamMode === "camera" && <Video size={42} />}
          {streamMode === "obs" && <MonitorUp size={42} />}
          {streamMode === "screen" && <Radio size={42} />}

          <div>
            <h2>{streamMode === "obs" ? "OBS Preview" : streamMode === "screen" ? "Screen Preview" : "Camera Preview"}</h2>
            <p>Media preview will connect here.</p>
          </div>
        </div>

        <div className="tc-mobile-setup__mode-grid">
          <button
            type="button"
            className={[
              "tc-mobile-setup__mode-btn",
              streamMode === "camera" ? "tc-mobile-setup__mode-btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setStreamMode("camera")}
          >
            <Camera size={18} />
            <span>Camera</span>
          </button>

          <button
            type="button"
            className={[
              "tc-mobile-setup__mode-btn",
              streamMode === "obs" ? "tc-mobile-setup__mode-btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setStreamMode("obs")}
          >
            <MonitorUp size={18} />
            <span>OBS</span>
          </button>

          <button
            type="button"
            className={[
              "tc-mobile-setup__mode-btn",
              streamMode === "screen" ? "tc-mobile-setup__mode-btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setStreamMode("screen")}
          >
            <Radio size={18} />
            <span>Screen</span>
          </button>
        </div>
      </section>

      <section className="tc-mobile-setup__section">
        <div className="tc-mobile-setup__section-head">
          <p>Stream Info</p>
          <h3>Broadcast details</h3>
        </div>

        <label className="tc-mobile-setup__field">
          <span>Stream title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you going live about?"
          />
        </label>

        <div className="tc-mobile-setup__category-grid">
          {categories.map((item) => (
            <button
              key={item.key}
              type="button"
              className={[
                "tc-mobile-setup__category",
                category === item.key ? "tc-mobile-setup__category--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setCategory(item.key)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tc-mobile-setup__section">
        <div className="tc-mobile-setup__section-head">
          <p>Options</p>
          <h3>Live room settings</h3>
        </div>

        <div className="tc-mobile-setup__toggle-list">
          <button
            type="button"
            className={[
              "tc-mobile-setup__toggle-row",
              saveBroadcast ? "tc-mobile-setup__toggle-row--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setSaveBroadcast((value) => !value)}
          >
            <div>
              <strong>Save broadcast</strong>
              <span>Record this live for playback later.</span>
            </div>
            <span className="tc-mobile-setup__switch">{saveBroadcast && <CheckCircle2 size={18} />}</span>
          </button>

          <button
            type="button"
            className={[
              "tc-mobile-setup__toggle-row",
              paidChatEnabled ? "tc-mobile-setup__toggle-row--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setPaidChatEnabled((value) => !value)}
          >
            <div>
              <strong>Paid chat</strong>
              <span>Let viewers pay coins for highlighted messages.</span>
            </div>
            <span className="tc-mobile-setup__switch">{paidChatEnabled && <CheckCircle2 size={18} />}</span>
          </button>
        </div>

        <label className="tc-mobile-setup__field">
          <span>Seat price</span>
          <input
            value={seatPrice}
            onChange={(event) => setSeatPrice(event.target.value)}
            inputMode="numeric"
            placeholder="0"
          />
        </label>
      </section>

      <section className="tc-mobile-setup__checks">
        {setupChecks.map((check) => {
          const Icon = check.icon;

          return (
            <div key={check.label} className="tc-mobile-setup__check">
              <Icon size={17} />
              <span>{check.label}</span>
              <CheckCircle2 size={16} />
            </div>
          );
        })}
      </section>

      <section className="tc-mobile-setup__start-panel">
        <div>
          <p>Ready?</p>
          <h3>Start your Mai Troll broadcast</h3>
        </div>

        <button
          type="button"
          className="tc-mobile-setup__start-btn"
          disabled={!canStart}
          onClick={handleStartBroadcast}
        >
          {isStarting ? (
            "Starting..."
          ) : (
            <>
              <Zap size={19} />
              <span>Start Live</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </section>
    </MobilePageShell>
  );
}