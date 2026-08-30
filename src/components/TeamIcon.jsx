import { useState } from 'react';

// Muestra el icono del equipo: emoji (texto) o imagen (URL).
// Si la imagen no carga, cae al emoji por defecto: un <img> roto renderiza su
// texto alternativo, que se sale de la caja y desplaza el layout en móvil.
// Se guarda QUÉ url falló (no un booleano) para que al cambiar de icono se
// reintente sola, sin necesidad de un efecto que resetee el estado.
export default function TeamIcon({ icon, size = "text-3xl", imgSize = "w-10 h-10", className = "" }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const isUrl = icon && (icon.startsWith('http') || icon.startsWith('data:'));

  if (isUrl && failedUrl !== icon) {
    return (
      <img
        src={icon}
        alt=""
        onError={() => setFailedUrl(icon)}
        className={`${imgSize} shrink-0 rounded-lg object-cover ${className}`}
      />
    );
  }

  return <span className={`${size} shrink-0 ${className}`}>{isUrl ? '🏀' : (icon || '🏀')}</span>;
}
