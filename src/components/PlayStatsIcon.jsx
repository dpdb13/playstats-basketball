export default function PlayStatsIcon({ className = "w-8 h-8" }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Tres barras de estadisticas */}
      <g strokeWidth="2">
        <rect x="2" y="22" width="5" height="8" rx="1" />
        <rect x="9" y="15" width="5" height="15" rx="1" />
        <rect x="16" y="7" width="5" height="23" rx="1" />
      </g>

      {/* Balon de baloncesto */}
      <g strokeWidth="1.2">
        <circle cx="26" cy="6" r="5" />
        <line x1="21" y1="6" x2="31" y2="6" />
        <path d="M26,1 C23.5,3.5 23.5,8.5 26,11" />
        <path d="M26,1 C28.5,3.5 28.5,8.5 26,11" />
      </g>
    </svg>
  );
}
