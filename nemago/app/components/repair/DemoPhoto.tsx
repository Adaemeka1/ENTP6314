import { photoLabel } from "@/lib/repair";

// Demo "photo proof" pictures. Real photo upload isn't switched on yet (it needs a consent
// and storage flow first), so the mechanic picks one of these. They are simple drawings
// in the app's colours and always carry a "Demo photo" tag.
function Scene({ id }: { id: string }) {
  switch (id) {
    case "brake_pads":
      return (
        <>
          <circle cx="120" cy="82" r="62" fill="#475569" />
          <circle cx="120" cy="82" r="48" fill="#94a3b8" />
          <circle cx="120" cy="82" r="14" fill="#1e293b" />
          <g fill="#1e293b">
            <circle cx="120" cy="52" r="4" />
            <circle cx="150" cy="82" r="4" />
            <circle cx="120" cy="112" r="4" />
            <circle cx="90" cy="82" r="4" />
          </g>
          <rect x="150" y="48" width="14" height="68" rx="4" fill="#0f172a" />
          <rect x="166" y="52" width="4" height="60" rx="2" fill="#cbd5e1" />
        </>
      );
    case "battery_terminal":
      return (
        <>
          <rect x="30" y="60" width="180" height="80" rx="8" fill="#334155" />
          <rect x="52" y="44" width="30" height="20" rx="3" fill="#94a3b8" />
          <rect x="158" y="44" width="30" height="20" rx="3" fill="#94a3b8" />
          <g fill="#d1fae5" stroke="#6ee7b7">
            <circle cx="60" cy="42" r="9" />
            <circle cx="76" cy="46" r="7" />
            <circle cx="52" cy="52" r="6" />
            <circle cx="68" cy="38" r="5" />
          </g>
          <text x="120" y="108" textAnchor="middle" fontSize="22" fontWeight="800" fill="#f8fafc">
            12V
          </text>
        </>
      );
    case "coolant_leak":
      return (
        <>
          <path d="M20 60 C70 60 70 100 120 100 S170 60 220 60" fill="none" stroke="#1e293b" strokeWidth="22" strokeLinecap="round" />
          <path d="M20 60 C70 60 70 100 120 100 S170 60 220 60" fill="none" stroke="#475569" strokeWidth="14" strokeLinecap="round" />
          <rect x="104" y="92" width="32" height="12" rx="3" fill="#94a3b8" />
          <g fill="#38bdf8">
            <path d="M120 116 q-7 12 0 18 q7 -6 0 -18z" />
            <path d="M108 128 q-5 9 0 13 q5 -4 0 -13z" />
            <path d="M132 130 q-5 9 0 13 q5 -4 0 -13z" />
          </g>
        </>
      );
    case "worn_belt":
      return (
        <>
          <circle cx="70" cy="80" r="34" fill="#475569" />
          <circle cx="70" cy="80" r="10" fill="#1e293b" />
          <circle cx="172" cy="80" r="26" fill="#475569" />
          <circle cx="172" cy="80" r="8" fill="#1e293b" />
          <path d="M70 46 L172 54 M70 114 L172 106" stroke="#0f172a" strokeWidth="9" />
          <g stroke="#94a3b8" strokeWidth="2">
            <path d="M96 50 l4 8 M118 52 l3 8 M142 53 l4 8 M104 110 l3 -8 M128 108 l4 -8" />
          </g>
        </>
      );
    default: // tire_damage
      return (
        <>
          <circle cx="120" cy="82" r="64" fill="#1e293b" />
          <circle cx="120" cy="82" r="38" fill="#94a3b8" />
          <circle cx="120" cy="82" r="12" fill="#475569" />
          <g stroke="#cbd5e1" strokeWidth="3">
            <path d="M120 44 v-8 M158 82 h8 M120 120 v8 M82 82 h-8" />
          </g>
          <path d="M168 50 l14 -12 l4 7 l-10 12z" fill="#94a3b8" />
          <path d="M172 52 q10 12 2 24" fill="none" stroke="#f8fafc" strokeWidth="2" strokeDasharray="3 3" />
        </>
      );
  }
}

export function DemoPhoto({ id, className }: { id: string; className?: string }) {
  return (
    <figure className={"demo-photo" + (className ? " " + className : "")}>
      <svg viewBox="0 0 240 164" role="img" aria-label={photoLabel(id) + " (demo photo)"}>
        <rect width="240" height="164" fill="#e2e8f0" />
        <Scene id={id} />
      </svg>
      <figcaption>
        <span className="badge badge-demo">Demo photo</span> {photoLabel(id)}
      </figcaption>
    </figure>
  );
}
