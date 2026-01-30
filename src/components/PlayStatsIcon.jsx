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
      {/* Trofeo - copa */}
      <g strokeWidth="2">
        <path d="M8,4 L24,4 L22,16 C21,20 11,20 10,16 Z" />
        <path d="M8,6 C4,6 3,10 6,13 L10,13" />
        <path d="M24,6 C28,6 29,10 26,13 L22,13" />
        <line x1="16" y1="20" x2="16" y2="25" />
        <path d="M11,25 L21,25 L22,28 L10,28 Z" />
      </g>
      {/* Estrella en el trofeo */}
      <g strokeWidth="1.2">
        <path d="M16,8 L17.2,11 L20.5,11 L18,13 L19,16 L16,14 L13,16 L14,13 L11.5,11 L14.8,11 Z" />
      </g>
    </svg>
  );
}
