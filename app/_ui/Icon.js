// Ícones do sistema (SVG em linha, herdam a cor do texto). Use no lugar de emojis/símbolos.
const PATHS = {
  x: "M6 6l12 12M18 6 6 18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2",
  check: "m5 12.5 4.5 4.5L19 7",
  info: "M12 11v6M12 7.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  alert: "M12 8v5M12 16.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  play: "M8 5.5v13l11-6.5z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  camera: "M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};
const FILLED = new Set(["play", "spark"]);

export default function Icon({ name, size = 18, className = "", title }) {
  const filled = FILLED.has(name);
  return (
    <svg className={`ico ico-${name} ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined}
      fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
