// Muestra el icono del equipo: emoji (texto) o imagen (URL)
export default function TeamIcon({ icon, size = "text-3xl", imgSize = "w-10 h-10", className = "" }) {
  const isUrl = icon && (icon.startsWith('http') || icon.startsWith('data:'));

  if (isUrl) {
    return (
      <img
        src={icon}
        alt="Team"
        className={`${imgSize} rounded-lg object-cover ${className}`}
      />
    );
  }

  return <span className={`${size} ${className}`}>{icon || '🏀'}</span>;
}
