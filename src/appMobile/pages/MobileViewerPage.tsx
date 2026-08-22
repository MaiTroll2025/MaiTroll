import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Coins,
  Gift,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Radio,
  Send,
  Share2,
  Sofa,
  Sparkles,
  UserPlus,
  Volume2,
  Zap,
} from "lucide-react";

type ViewerTab = "chat" | "gifts" | "seats";

const sampleChat = [
  {
    id: "1",
    username: "TrollKing",
    message: "This stream looking clean 🔥",
  },
  {
    id: "2",
    username: "QueenTroll",
    message: "Send gifts y’all 😂",
  },
  {
    id: "3",
    username: "HypeLord",
    message: "Battle energy tonight!",
  },
];

const sampleGifts = [
  {
    id: "heart",
    name: "Troll Heart",
    price: 10,
    emoji: "💙",
  },
  {
    id: "flame",
    name: "Hype Flame",
    price: 50,
    emoji: "🔥",
  },
  {
    id: "crown",
    name: "City Crown",
    price: 250,
    emoji: "👑",
  },
  {
    id: "rocket",
    name: "Troll Rocket",
    price: 500,
    emoji: "🚀",
  },
];

const sampleSeats = [
  {
    id: "seat-1",
    label: "Seat 1",
    status: "Open",
  },
  {
    id: "seat-2",
    label: "Seat 2",
    status: "Open",
  },
  {
    id: "seat-3",
    label: "Seat 3",
    status: "Locked",
  },
  {
    id: "seat-4",
    label: "Seat 4",
    status: "Open",
  },
];

export default function MobileViewerPage() {
  const navigate = useNavigate();
  const { streamId } = useParams<{ streamId: string }>();

  const [activeTab, setActiveTab] = useState<ViewerTab>("chat");
  const [chatMessage, setChatMessage] = useState("");
  const [liked, setLiked] = useState(false);

  const displayStreamId = useMemo(() => {
    if (!streamId) return "Preview";
    return streamId.slice(0, 8);
  }, [streamId]);

  return (
    <main className="tc-mobile-viewer">
      <section className="tc-mobile-viewer__stage">
        <div className="tc-mobile-viewer__video-bg" />

        <div className="tc-mobile-viewer__top-overlay">
          <button
            type="button"
            className="tc-mobile-viewer__icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="tc-mobile-viewer__live-pill">
            <Radio size={14} />
            <span>LIVE</span>
          </div>

          <button type="button" className="tc-mobile-viewer__icon-btn" aria-label="More options">
            <MoreHorizontal size={20} />
          </button>
        </div>

        <div className="tc-mobile-viewer__center-preview">
          <div className="tc-mobile-viewer__broadcast-orb">
            <Radio size={54} />
          </div>

          <h1>Viewer Page</h1>
          <p>Stream preview area. We will wire Mux/LiveKit here next.</p>

          <div className="tc-mobile-viewer__stream-id">
            Stream: <span>{displayStreamId}</span>
          </div>
        </div>

        <div className="tc-mobile-viewer__creator-card">
          <div className="tc-mobile-viewer__avatar">TC</div>

          <div className="tc-mobile-viewer__creator-meta">
            <strong>@creator</strong>
            <span>Fresh mobile viewer layout</span>
          </div>

          <button type="button" className="tc-mobile-viewer__follow-btn">
            <UserPlus size={15} />
            Follow
          </button>
        </div>

        <div className="tc-mobile-viewer__side-actions">
          <button
            type="button"
            className={[
              "tc-mobile-viewer__action",
              liked ? "tc-mobile-viewer__action--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setLiked((value) => !value)}
          >
            <Heart size={21} />
            <span>Like</span>
          </button>

          <button type="button" className="tc-mobile-viewer__action">
            <Gift size={21} />
            <span>Gift</span>
          </button>

          <button type="button" className="tc-mobile-viewer__action">
            <Sofa size={21} />
            <span>Seat</span>
          </button>

          <button type="button" className="tc-mobile-viewer__action">
            <Share2 size={21} />
            <span>Share</span>
          </button>
        </div>

        <div className="tc-mobile-viewer__bottom-panel">
          <div className="tc-mobile-viewer__tabs">
            <button
              type="button"
              className={activeTab === "chat" ? "tc-mobile-viewer__tab--active" : ""}
              onClick={() => setActiveTab("chat")}
            >
              <MessageCircle size={15} />
              Chat
            </button>

            <button
              type="button"
              className={activeTab === "gifts" ? "tc-mobile-viewer__tab--active" : ""}
              onClick={() => setActiveTab("gifts")}
            >
              <Gift size={15} />
              Gifts
            </button>

            <button
              type="button"
              className={activeTab === "seats" ? "tc-mobile-viewer__tab--active" : ""}
              onClick={() => setActiveTab("seats")}
            >
              <Sofa size={15} />
              Seats
            </button>
          </div>

          {activeTab === "chat" && (
            <section className="tc-mobile-viewer__chat-panel">
              <div className="tc-mobile-viewer__floating-chat">
                {sampleChat.map((item) => (
                  <div key={item.id} className="tc-mobile-viewer__chat-message">
                    <strong>@{item.username}</strong>
                    <span>{item.message}</span>
                  </div>
                ))}
              </div>

              <div className="tc-mobile-viewer__chat-input-row">
                <input
                  value={chatMessage}
                  onChange={(event) => setChatMessage(event.target.value)}
                  placeholder="Say something..."
                />

                <button
                  type="button"
                  disabled={!chatMessage.trim()}
                  onClick={() => setChatMessage("")}
                  aria-label="Send message"
                >
                  <Send size={17} />
                </button>
              </div>
            </section>
          )}

          {activeTab === "gifts" && (
            <section className="tc-mobile-viewer__gift-grid">
              {sampleGifts.map((gift) => (
                <button key={gift.id} type="button" className="tc-mobile-viewer__gift-card">
                  <span className="tc-mobile-viewer__gift-emoji">{gift.emoji}</span>
                  <strong>{gift.name}</strong>
                  <span>
                    <Coins size={13} />
                    {gift.price}
                  </span>
                </button>
              ))}
            </section>
          )}

          {activeTab === "seats" && (
            <section className="tc-mobile-viewer__seat-grid">
              {sampleSeats.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  className={[
                    "tc-mobile-viewer__seat-card",
                    seat.status === "Locked" ? "tc-mobile-viewer__seat-card--locked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={seat.status === "Locked"}
                >
                  <Sofa size={20} />
                  <strong>{seat.label}</strong>
                  <span>{seat.status}</span>
                </button>
              ))}
            </section>
          )}
        </div>

        <div className="tc-mobile-viewer__earn-pill">
          <Zap size={14} />
          <span>Earn Hype while watching</span>
        </div>

        <div className="tc-mobile-viewer__sound-pill">
          <Volume2 size={14} />
          <span>Sound ready</span>
        </div>
      </section>
    </main>
  );
}
