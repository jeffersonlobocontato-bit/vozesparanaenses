import { Link } from "@tanstack/react-router";
import horizontalLight from "@/assets/vozes-horizontal-light.png.asset.json";
import horizontalDark from "@/assets/vozes-horizontal-dark.png.asset.json";
import verticalLight from "@/assets/vozes-vertical-light.png.asset.json";
import verticalDark from "@/assets/vozes-vertical-dark.png.asset.json";
import iconMark from "@/assets/vozes-icon-dark.png.asset.json";

type Size = "sm" | "md" | "lg";
// "blue" = para fundos claros (wordmark em navy) · "white" = para fundos escuros
type Variant = "blue" | "white" | "auto";
type Lockup = "horizontal" | "vertical" | "icon";

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
  lockup = "horizontal",
}: {
  size?: Size;
  withLink?: boolean;
  className?: string;
  variant?: Variant;
  lockup?: Lockup;
}) {
  const onDark = variant === "white";
  const src =
    lockup === "icon"
      ? iconMark.url
      : lockup === "vertical"
        ? (onDark ? verticalDark.url : verticalLight.url)
        : (onDark ? horizontalDark.url : horizontalLight.url);
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