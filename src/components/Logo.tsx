import { Link } from "@tanstack/react-router";

type Size = "sm" | "md" | "lg";
// "blue" = para fundos claros · "white" = para fundos escuros
type Variant = "blue" | "white" | "auto";
type Lockup = "horizontal" | "vertical" | "icon";

// Altura do ícone (H) por tamanho, em px: celular → desktop.
// Toda a assinatura sai de H pela proporção áurea (φ = 1,618):
//   "vozes" = H/φ · "paranaenses" = H/φ² (as duas linhas somam H)
//   espaço ícone→nome e respiro = H/φ³
const H: Record<Size, [number, number]> = {
  sm: [32, 40],
  md: [40, 56],
  lg: [56, 72],
};

const CORES = {
  claro: { balao: "#1E5B45", v: "#FFFFFF", ponto: "#E29F65", nome: "#1E5B45", sub: "#4A5A53" },
  escuro: { balao: "#6FBF98", v: "#0F1714", ponto: "#E9A973", nome: "#FFFFFF", sub: "rgba(255,255,255,0.78)" },
};

/** Ícone: balão de fala com V e o ponto laranja (V e ponto pela proporção áurea). */
export function LogoIcon({ size, onDark = false, title }: { size: number; onDark?: boolean; title?: string }) {
  const c = onDark ? CORES.escuro : CORES.claro;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="shrink-0"
    >
      <path
        fill={c.balao}
        d="M64 28h120a48 48 0 0 1 48 48v84a48 48 0 0 1-48 48H108l-52 34a6 6 0 0 1-9.2-5.6L52 206A48 48 0 0 1 16 160V76a48 48 0 0 1 48-48z"
      />
      <polyline
        points="72.3,91.7 124,144.3 175.7,91.7"
        fill="none"
        stroke={c.v}
        strokeWidth={30}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={214} cy={46} r={34.4} fill={c.ponto} />
    </svg>
  );
}

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
  const c = onDark ? CORES.escuro : CORES.claro;
  const [hMob, hDesk] = H[size];
  const phi = 1.618;

  const marca = (h: number, extra = "") => (
    <span
      className={`items-center ${extra}`}
      style={{
        gap: h / phi ** 3,
        flexDirection: lockup === "vertical" ? "column" : "row",
      }}
    >
      <LogoIcon size={h} onDark={onDark} />
      {lockup !== "icon" && (
        <span
          className="flex flex-col"
          style={{
            fontFamily: "var(--font-marca)",
            fontWeight: 700,
            fontVariationSettings: '"SOFT" 100',
            textAlign: lockup === "vertical" ? "center" : "left",
          }}
        >
          <span style={{ fontSize: h / phi, lineHeight: 1, letterSpacing: "-0.01em", color: c.nome }}>vozes</span>
          <span style={{ fontSize: h / phi ** 2, lineHeight: 1, color: c.sub }}>paranaenses</span>
        </span>
      )}
    </span>
  );

  const img = (
    <span className="inline-flex select-none" aria-hidden={withLink ? true : undefined}>
      {marca(hMob, "flex md:hidden")}
      {marca(hDesk, "hidden md:flex")}
      {!withLink && <span className="sr-only">Vozes Paranaenses</span>}
    </span>
  );
  if (!withLink) return <div className={className}>{img}</div>;
  return (
    <Link to="/" aria-label="Vozes Paranaenses — Página inicial" className={`inline-flex items-center ${className}`}>
      {img}
    </Link>
  );
}
