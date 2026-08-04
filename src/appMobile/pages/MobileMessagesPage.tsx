import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Edit3,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Send,
  Shield,
  Star,
  User,
  Zap,
} from "lucide-react";
import MobilePageShell from "../MobilePageShell";

type MessageFilter = "all" | "unread" | "important" | "sent";

type MobileMessage = {
  id: string;
  from: string;
  role: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  important: boolean;
  sent?: boolean;
};

const sampleMessages: MobileMessage[] = [
  {
    id: "1",
    from: "Mai Troll System",
    role: "system",
    subject: "Welcome to your mobile inbox",
    preview: "This is where app messages, role alerts, staff mail, and system updates will show.",
    time: "Now",
    unread: true,
    important: true,
  },
  {
    id: "2",
    from: "Broadcast Alerts",
    role: "live",
    subject: "Go Live tools are being prepared",
    preview: "Your fresh mobile app shell is ready for broadcast messaging and live notifications.",
    time: "5m",
    unread: true,
    important: false,
  },
  {
    id: "3",
    from: "Wallet Updates",
    role: "wallet",
    subject: "Hype Coin conversion ready",
    preview: "Hype Coin conversion can be connected to your existing backend RPC logic.",
    time: "12m",
    unread: false,
    important: true,
  },
  {
    id: "4",
    from: "Sent Message",
    role: "sent",
    subject: "Creator invite draft",
    preview: "Your sent messages and Tromail history can appear here later.",
    time: "1h",
    unread: false,
    important: false,
    sent: true,
  },
];

const filters: Array<{
  key: MessageFilter;
  label: string;
  icon: React.ElementType;
}> = [
  {
    key: "all",
    label: "All",
    icon: Mail,
  },
  {
    key: "unread",
    label: "Unread",
    icon: Bell,
  },
  {
    key: "important",
    label: "Important",
    icon: Star,
  },
  {
    key: "sent",
    label: "Sent",
    icon: Send,
  },
];

function getFilteredMessages(messages: MobileMessage[], filter: MessageFilter) {
  if (filter === "unread") return messages.filter((message) => message.unread);
  if (filter === "important") return messages.filter((message) => message.important);
  if (filter === "sent") return messages.filter((message) => message.sent);
  return messages;
}

export default function MobileMessagesPage() {
  const [activeFilter, setActiveFilter] = useState<MessageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMessages = useMemo(() => {
    const baseMessages = getFilteredMessages(sampleMessages, activeFilter);

    if (!searchQuery.trim()) return baseMessages;

    const query = searchQuery.toLowerCase();

    return baseMessages.filter((message) => {
      return (
        message.from.toLowerCase().includes(query) ||
        message.subject.toLowerCase().includes(query) ||
        message.preview.toLowerCase().includes(query)
      );
    });
  }, [activeFilter, searchQuery]);

  const unreadCount = sampleMessages.filter((message) => message.unread).length;
  const importantCount = sampleMessages.filter((message) => message.important).length;

  return (
    <MobilePageShell
      title="Messages"
      eyebrow="Inbox"
      subtitle="Mobile inbox for system alerts, role messages, creator updates, and Tromail-style communication."
      rightAction={
        <button
          type="button"
          className="tc-mobile-messages__compose-btn"
          aria-label="Compose message"
        >
          <Edit3 size={18} />
        </button>
      }
    >
      <section className="tc-mobile-messages__hero">
        <div className="tc-mobile-messages__hero-glow" />

        <div className="tc-mobile-messages__hero-left">
          <div className="tc-mobile-messages__hero-icon">
            <MessageCircle size={32} />
          </div>

          <div>
            <p>City Inbox</p>
            <h2>{filteredMessages.length} Messages</h2>
            <span>{unreadCount} unread alerts waiting</span>
          </div>
        </div>

        <div className="tc-mobile-messages__hero-badge">
          <Zap size={15} />
          <span>Live</span>
        </div>
      </section>

      <section className="tc-mobile-messages__search-card">
        <Search size={18} />

        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search messages..."
        />
      </section>

      <section className="tc-mobile-messages__filter-row">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.key;

          return (
            <button
              key={filter.key}
              type="button"
              className={[
                "tc-mobile-messages__filter",
                isActive ? "tc-mobile-messages__filter--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveFilter(filter.key)}
            >
              <Icon size={15} />
              <span>{filter.label}</span>
            </button>
          );
        })}
      </section>

      <section className="tc-mobile-messages__stats-grid">
        <div className="tc-mobile-messages__stat">
          <Bell size={17} />
          <strong>{unreadCount}</strong>
          <span>Unread</span>
        </div>

        <div className="tc-mobile-messages__stat">
          <Star size={17} />
          <strong>{importantCount}</strong>
          <span>Important</span>
        </div>

        <div className="tc-mobile-messages__stat">
          <Send size={17} />
          <strong>{sampleMessages.filter((message) => message.sent).length}</strong>
          <span>Sent</span>
        </div>
      </section>

      <section className="tc-mobile-messages__list">
        {filteredMessages.length === 0 ? (
          <div className="tc-mobile-messages__empty">
            <Mail size={30} />
            <h3>No messages found</h3>
            <p>Try a different filter or search term.</p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <article
              key={message.id}
              className={[
                "tc-mobile-messages__message-card",
                message.unread ? "tc-mobile-messages__message-card--unread" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="tc-mobile-messages__message-avatar">
                {message.from.slice(0, 2).toUpperCase()}
              </div>

              <div className="tc-mobile-messages__message-body">
                <div className="tc-mobile-messages__message-top">
                  <strong>{message.from}</strong>
                  <span>{message.time}</span>
                </div>

                <div className="tc-mobile-messages__message-role">
                  <Shield size={12} />
                  <span>{message.role}</span>
                </div>

                <h3>{message.subject}</h3>
                <p>{message.preview}</p>

                <div className="tc-mobile-messages__message-actions">
                  {message.unread && (
                    <span className="tc-mobile-messages__pill">
                      <Bell size={12} />
                      Unread
                    </span>
                  )}

                  {message.important && (
                    <span className="tc-mobile-messages__pill tc-mobile-messages__pill--important">
                      <Star size={12} />
                      Important
                    </span>
                  )}
                </div>
              </div>

              <button type="button" className="tc-mobile-messages__open-btn" aria-label="Open message">
                <ArrowRight size={17} />
              </button>
            </article>
          ))
        )}
      </section>

      <section className="tc-mobile-messages__quick-card">
        <div className="tc-mobile-messages__quick-icon">
          <Plus size={22} />
        </div>

        <div>
          <h3>Compose later</h3>
          <p>
            This page is ready for wiring into Tromail, staff inboxes, role mail, and system messages.
          </p>
        </div>
      </section>

      <section className="tc-mobile-messages__links">
        <NavLink to="/notifications">
          <Bell size={18} />
          <span>Notifications</span>
          <ArrowRight size={17} />
        </NavLink>

        <NavLink to="/profile">
          <User size={18} />
          <span>Profile</span>
          <ArrowRight size={17} />
        </NavLink>

        <NavLink to="/settings">
          <CheckCircle2 size={18} />
          <span>Message Settings</span>
          <ArrowRight size={17} />
        </NavLink>
      </section>
    </MobilePageShell>
  );
}