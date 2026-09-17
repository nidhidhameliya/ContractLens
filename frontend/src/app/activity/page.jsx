"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";
import TimelineEvent from "@/app/contracts/components/TimelineEvent";
import { Clock, Search, Cpu, User as UserIcon, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function SkeletonBlock({ h = 56 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 6 }} />;
}

export default function ActivityPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      try {
        const data = await api.listAuditLogs({ limit: 100 });
        if (isMounted) setEvents(data.events ?? []);
      } catch (e) { console.error(e); }
      finally { if (isMounted) setLoading(false); }
    };
    loadEvents();
    return () => { isMounted = false; };
  }, []);

  const filtered = events.filter((e) => {
    const matchesSearch =
      !search ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
      e.detail?.toLowerCase().includes(search.toLowerCase());

    const matchesActor =
      actorFilter === "all" ||
      (actorFilter === "ai" && !e.user_id) ||
      (actorFilter === "human" && !!e.user_id);

    return matchesSearch && matchesActor;
  });

  const grouped = filtered.reduce((acc, e) => {
    const date = new Date(e.timestamp).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(e);
    return acc;
  }, {});

  const actorButtons = [
    { key: "all",   label: "All",   icon: null },
    { key: "ai",    label: "AI",    icon: <Cpu size={12} /> },
    { key: "human", label: "Human", icon: <UserIcon size={12} /> },
  ];

  return (
    <div className="w-full max-w-full">
      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-2.5 mb-6 p-3 rounded-lg animate-slide-up delay-100"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* Search */}
        <div
          className="flex items-center gap-2 flex-1 min-w-56 px-3 rounded-md"
          style={{
            height: 34,
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Search size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
            }}
          />
          {search && (
            <Button
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, display: "flex" }}
            >
              <X size={12} />
            </Button>
          )}
        </div>

        {/* Actor filter */}
        <div
          className="flex gap-1 p-1 rounded-md"
          style={{
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {actorButtons.map(({ key, label, icon }) => (
            <Button
              key={key}
              onClick={() => setActorFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                background: actorFilter === key ? "var(--bg-surface)" : "transparent",
                color: actorFilter === key ? "var(--text-primary)" : "var(--text-tertiary)",
                border: actorFilter === key ? "1px solid var(--border-subtle)" : "1px solid transparent",
              }}
            >
              {icon}{label}
            </Button>
          ))}
        </div>

        {/* Count */}
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-md"
          style={{
            color: "var(--text-tertiary)",
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {filtered.length} events
        </span>
      </div>

      {/* Content */}
      <div className="surface-card p-6 animate-slide-up delay-200">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} h={52} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Clock size={16} />}
            title="No events found"
            description={search ? "Try adjusting your search." : "Events appear here as the system processes contracts."}
          />
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, dateEvents]) => (
              <div key={date}>
                {/* Date separator */}
                <div
                  className="flex items-center gap-3 mb-5"
                  style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}
                >
                  <Clock size={12} style={{ color: "var(--text-disabled)" }} />
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {date}
                  </span>
                </div>

                <div>
                  {dateEvents.map((e, i) => (
                    <TimelineEvent
                      key={e.id}
                      action={e.action}
                      entityType={e.entity_type}
                      userId={e.user_id}
                      detail={e.detail}
                      timestamp={e.timestamp}
                      isLast={i === dateEvents.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}