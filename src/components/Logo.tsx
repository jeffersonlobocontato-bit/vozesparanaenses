import { Link } from "@tanstack/react-router";
import logoBlue from "@/assets/vozes-logo-blue.png.asset.json";
import logoWhite from "@/assets/vozes-logo-white.png.asset.json";

type Size = "sm" | "md" | "lg";
type Variant = "blue" | "white" | "auto";

// Alturas seguindo proporção áurea (≈1.618) entre breakpoints:
// sm 40 → md 64 → lg 104. Largura automática preserva o aspecto da marca.
const HEIGHTS: Record<Size, string> = {
  sm: "h-12 md:h-14",
  md: "h-16 md:h-20 lg:h-24",
  lg: "h-20 md:h-28 lg:h-36",
};

export function Logo({
  size = "md",
  withLink = true,
  className = "",
  variant = "blue",
}: {
  size?: Size;
  withLink?: boolean;
  className?: string;
  variant?: Variant;
}) {
  const src = variant === "white" ? logoWhite.url : logoBlue.url;
  const img = (
    <img
      src={src}
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