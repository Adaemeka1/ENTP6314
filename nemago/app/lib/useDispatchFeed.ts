"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { REQUEST_COLUMNS, type DispatchRequest } from "@/lib/dispatch";

// Keeps a list of dispatch requests up to date.
// 1. Supabase Realtime tells us the moment something changes.
// 2. As a safety net, we also check again every few seconds, so the screen
//    still updates if Realtime isn't switched on yet.
// Row Level Security decides what each person can see: a driver gets their own
// requests, a verified mechanic gets open requests plus the ones they accepted.
export function useDispatchFeed() {
  const [requests, setRequests] = useState<DispatchRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [live, setLive] = useState(false);

  const reload = useCallback(async () => {
    const { data, error } = await createClient()
      .from("dispatch_requests")
      .select(REQUEST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setFailed(true);
    } else {
      setFailed(false);
      setRequests((data ?? []) as unknown as DispatchRequest[]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let stopped = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      await reload();
      // Realtime must know who we are, or Row Level Security hides everything.
      const { data } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (stopped) return;
      channel = supabase
        .channel("dispatch-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table: "dispatch_requests" }, () => {
          reload();
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    }
    start();

    return () => {
      stopped = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(reload, live ? 10000 : 5000);
    return () => clearInterval(timer);
  }, [reload, live]);

  return { requests, loaded, failed, live, reload };
}

// A clock that ticks once a second, for "2 minutes ago" style text.
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
