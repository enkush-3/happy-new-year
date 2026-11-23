import type { FallingObjectKind } from "./model";

const pickupArt = {
  gift: (
    <>
      <path d="M20 10q-9-1-9-5 0-3 3-2 3 1 6 7 9-1 9-5 0-3-3-2-3 1-6 7Z" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="6" y="10" width="28" height="28" rx="4" fill="#f5b731" />
      <path d="M20 10v28M6 24h28" stroke="#ef4444" strokeWidth="3" />
    </>
  ),
  coal: (
    <>
      <polygon points="4,18 14,5 30,7 37,20 29,34 11,35" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <polygon points="11,17 16,9 27,11 22,17" fill="#475569" />
    </>
  ),
  snowball: (
    <>
      <circle cx="20" cy="20" r="16" fill="#e2e8f0" stroke="#38bdf8" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path d="M9 22q1 9 10 11 8 1 12-6-13 6-22-5Z" fill="#94a3b8" />
    </>
  ),
};

export function FallingSprite({ kind }: { kind: FallingObjectKind }) {
  return <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">{pickupArt[kind]}</svg>;
}

export function BasketSprite() {
  return (
    <svg viewBox="0 0 64 24" aria-hidden="true" focusable="false">
      <path d="M5 6h54l-7 13a5 5 0 0 1-4.4 2.7H16.4A5 5 0 0 1 12 19Z" fill="#f8fafc" />
      <rect x="2" y="3" width="60" height="6" rx="3" fill="#f5b731" />
    </svg>
  );
}

export function WinterScenery() {
  return (
    <svg className="gift-catcher__scenery" aria-hidden="true" focusable="false">
      <g fill="#94a3b8">
        <circle cx="11%" cy="20%" r="1.5" />
        <circle cx="24%" cy="13%" r="1" />
        <circle cx="34%" cy="37%" r="1" />
        <circle cx="47%" cy="22%" r="1.5" />
        <circle cx="61%" cy="13%" r="1" />
        <circle cx="73%" cy="30%" r="1" />
        <circle cx="88%" cy="19%" r="1.5" />
      </g>
      <svg width="100%" height="100%" viewBox="0 0 800 440" preserveAspectRatio="none">
        <path d="M0 424Q400 392 800 424V440H0Z" fill="#cbd5e1" />
      </svg>
    </svg>
  );
}
