import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { PageviewTracker } from "../lib/analytics";
import { SalesChatWidget } from "../components/SalesChatWidget";
import { AdminFloatingEditor } from "../components/AdminFloatingEditor";
import faviconAsset from "@/assets/favicon.png.asset.json";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-adsense-account", content: "ca-pub-3867318545397573" },
      { name: "google-site-verification", content: "_UUOkOVBK4wTpkZ9IlLPGIazk7i1z5xCLpk2M4Ml2DA" },
      { title: "Vozes Paranaenses — Notícias de todas as regiões do Estado" },
      {
        name: "description",
        content: "Portal de Curitiba, RMC, Litoral, Campos Gerais, Norte Pioneiro, Norte, Noroeste, Centro Oeste, Oeste, Sudoeste e Centro-Sul.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "geo.region", content: "BR-PR" },
      { name: "geo.country", content: "BR" },
      { name: "geo.placename", content: "Paraná, Brasil" },
      { httpEquiv: "content-language", content: "pt-BR" },
      { property: "og:title", content: "Vozes Paranaenses — Notícias de todas as regiões do Estado" },
      {
        property: "og:description",
        content: "Portal de Curitiba, RMC, Litoral, Campos Gerais, Norte Pioneiro, Norte, Noroeste, Centro Oeste, Oeste, Sudoeste e Centro-Sul.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Vozes Paranaenses" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Vozes Paranaenses — Notícias de todas as regiões do Estado" },
      { name: "twitter:description", content: "Portal de Curitiba, RMC, Litoral, Campos Gerais, Norte Pioneiro, Norte, Noroeste, Centro Oeste, Oeste, Sudoeste e Centro-Sul." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2502007b-1507-40f2-91dd-3accc599964a/id-preview-eab56619--22784275-0a66-4923-aa16-dc254fe2ec74.lovable.app-1783649457443.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2502007b-1507-40f2-91dd-3accc599964a/id-preview-eab56619--22784275-0a66-4923-aa16-dc254fe2ec74.lovable.app-1783649457443.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: faviconAsset.url },
      { rel: "apple-touch-icon", href: faviconAsset.url },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700;800&family=Bitter:wght@600;700&family=Playfair+Display:wght@700;900&family=Merriweather:wght@700;900&family=Oswald:wght@600;700&family=Poppins:wght@700;800&family=Rubik:wght@600;700&family=Archivo:wght@700;800&family=Space+Grotesk:wght@600;700&display=swap",
      },
    ],
    scripts: [
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-HPX9FLN7XV",
        async: true,
      },
      {
        children:
          "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-HPX9FLN7XV', { send_page_view: false });",
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsMediaOrganization",
          name: "Vozes Paranaenses",
          alternateName: "Vozes Paranaenses",
          url: "/",
          logo: { "@type": "ImageObject", url: faviconAsset.url },
          description:
            "Portal de notícias das 10 macrorregiões do Paraná — cobertura editorial regional com foco no impacto local.",
          inLanguage: "pt-BR",
          areaServed: {
            "@type": "State",
            name: "Paraná",
            containedInPlace: { "@type": "Country", name: "Brasil" },
          },
          knowsLanguage: "pt-BR",
          publishingPrinciples: "/politica-editorial",
          diversityPolicy: "/politica-editorial",
          ethicsPolicy: "/politica-editorial",
          actionableFeedbackPolicy: "/correcoes",
          correctionsPolicy: "/correcoes",
          missionCoveragePrioritiesPolicy: "/sobre",
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "Redação",
            email: "contato@vozesparanaenses.com.br",
            areaServed: "BR-PR",
            availableLanguage: ["Portuguese"],
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Vozes Paranaenses",
          url: "/",
          inLanguage: "pt-BR",
          potentialAction: {
            "@type": "SearchAction",
            target: "/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    // O AdSense nunca deve carregar em telas administrativas — são páginas
    // sem conteúdo editorial nenhum, exatamente o que a política do Google
    // proíbe ("anúncios em telas sem conteúdo do editor").
    if (isAdmin) return;
    if (document.getElementById("adsbygoogle-js")) return;
    const s = document.createElement("script");
    s.id = "adsbygoogle-js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3867318545397573";
    document.head.appendChild(s);
  }, [isAdmin]);

  return (
    <QueryClientProvider client={queryClient}>
      <PageviewTracker />
      {!isAdmin && <SalesChatWidget />}
      {!isAdmin && <AdminFloatingEditor />}
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
