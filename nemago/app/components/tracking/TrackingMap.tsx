"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { pointAlong, trackingState, type LatLng } from "@/lib/tracking";

// OpenStreetMap's own street tiles. No API key needed. (CartoDB's free tiles now
// answer "API key required", so we don't use them.) OpenStreetMap's tile policy is
// for light use: before real launch traffic, switch this one URL to a paid tile provider.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const VAN_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16V8a1 1 0 0 1 1-1h9v9"/><path d="M13 10h4l3 3v3h-7"/><circle cx="7" cy="17" r="2" fill="#0f172a"/><circle cx="16" cy="17" r="2" fill="#0f172a"/></svg>';
const PIN_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="#0f172a" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';

// An interactive street map: the road route, the driver's pin, and the mechanic's
// van gliding along the road. The mechanic's position is simulated from the real
// accept time and ETA (see lib/tracking.ts).
export function TrackingMap({
  points,
  status,
  acceptedAtMs,
  etaMinutes,
  speed = 1,
}: {
  points: LatLng[];
  status: string;
  acceptedAtMs: number;
  etaMinutes: number;
  speed?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  // The animation loop reads the newest values from here, so it never restarts.
  const live = useRef({ status, acceptedAtMs, etaMinutes, speed });
  live.current = { status, acceptedAtMs, etaMinutes, speed };

  useEffect(() => {
    const element = holder.current;
    if (!element || points.length < 2) return;
    let stopped = false;
    let frame = 0;
    let map: LeafletMap | null = null;

    import("leaflet").then((L) => {
      if (stopped || !holder.current) return;
      const touch = L.Browser.mobile;
      map = L.map(element, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false, // the page must still scroll past the map
        dragging: !touch, // one finger scrolls the page; two fingers zoom the map
      });
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);

      // The road: a white outline under a navy line, so it reads on any street.
      L.polyline(points, { color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round" }).addTo(map);
      const road = L.polyline(points, { color: "#0f172a", weight: 5, opacity: 1, lineCap: "round" }).addTo(map);

      const end = points[points.length - 1];
      L.marker(end, {
        icon: L.divIcon({
          className: "track-icon",
          html: '<div class="track-pin">' + PIN_SVG + "</div>",
          iconSize: [40, 40],
          iconAnchor: [20, 38],
        }),
        keyboard: false,
        zIndexOffset: 2000, // the pin stays visible when the van pulls up beside it
        title: "Your location",
      }).addTo(map);

      const van: Marker = L.marker(points[0], {
        icon: L.divIcon({
          className: "track-icon",
          html: '<div class="track-van">' + VAN_SVG + "</div>",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        keyboard: false,
        zIndexOffset: 1000,
        title: "Your mechanic",
      }).addTo(map);

      map.fitBounds(road.getBounds(), { padding: [36, 36] });
      // The card may still be laying out when the map starts.
      setTimeout(() => map?.invalidateSize(), 250);

      const step = () => {
        const s = live.current;
        const state = trackingState({
          status: s.status,
          acceptedAtMs: s.acceptedAtMs,
          etaMinutes: s.etaMinutes,
          nowMs: Date.now(),
          speed: s.speed,
        });
        van.setLatLng(pointAlong(points, state.fraction));
        frame = requestAnimationFrame(step);
      };
      step();
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      map?.remove();
    };
  }, [points]);

  return (
    <div
      ref={holder}
      className="track-map"
      role="img"
      aria-label="Street map showing your mechanic's route to you"
    />
  );
}
