import { Link } from "@tanstack/react-router";
import logo from "@/assets/vozes-paranaenses-logo.png.asset.json";

type Size = "sm" | "md" | "lg";

// Alturas seguindo proporção áurea (≈1.618) entre breakpoints:
// sm 40 → md 64 → lg 104. Largura automática preserva o aspecto da marca.
const HEIGHTS: Record<Size, string> = {
  sm: "h-10 md:h-12",
  md: "h-12 md:h-16 lg:h-20",
  lg: "h-16 md:h-24 lg:h-28",
};

export function Logo({
  size = "md",
  withLink = true,
  className = "",
}: {
  size?: Size;
  withLink?: boolean;
  className?: string;
}) {
  const img = (
    <img
      src={logo.url}
      alt="Vozes Paranaenses"
      className={`${HEIGHTS[size]} w-auto select-none`}
      draggable={false}
    />
  );
  if (!withLink) return <div className={className}>{img}</div>;
  return (
    <Link to="/" aria-label="Vozes Paranaenses — Página inicial" className={`inline-flex items-center ${className}`}>
      {img}
    </Link>
  );
}