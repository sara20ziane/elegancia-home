import { Link } from "@tanstack/react-router";
import { BedDouble, Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n-context";
import { useStoreSettings } from "@/lib/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

/** Storefront header with a premium Elegancia Home wordmark fallback. */
export function SiteHeader() {
  const { t } = useI18n();
  const { count, openCart } = useCart();
  const { data: settings } = useStoreSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  const storeName = settings?.name?.trim() || "Elegancia Home";

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/catalogue", label: t("nav.shop") },
    { to: "/track", label: t("nav.trackOrder") },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E8DDD3] bg-[#FFFDF9]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FFFDF9]/88">
      <div className="container-page flex h-[68px] items-center gap-3">
        <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2.5">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt={storeName}
              className="h-10 max-w-[150px] shrink-0 object-contain sm:max-w-[180px]"
            />
          ) : (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[#DECABA] bg-[#F7F1EA] text-primary">
                <BedDouble size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 items-baseline gap-1.5 text-[#38281E]">
                <span className="truncate font-display text-[1.34rem] font-semibold tracking-[-0.03em] sm:text-[1.5rem]">
                  Elegancia
                </span>
                <span className="hidden text-[0.62rem] font-semibold tracking-[0.22em] text-primary uppercase xs:inline sm:inline">
                  Home
                </span>
              </span>
            </>
          )}
        </Link>

        <nav className="ms-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[#74665C] transition-colors hover:bg-[#F5ECE4] hover:text-[#38281E]"
              activeOptions={{ exact: link.to === "/" }}
              activeProps={{ className: "bg-[#F5ECE4] text-[#38281E]" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitcher className="hidden sm:block" />
          <ThemeToggle />

          <button
            type="button"
            onClick={openCart}
            data-testid="cart-open"
            className="relative inline-flex size-10 items-center justify-center rounded-full border border-[#E1D4C9] bg-white/70 text-[#38281E] transition-colors hover:bg-[#F5ECE4]"
            aria-label={t("cart.title")}
          >
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="sr-only" aria-live="polite">
              {count > 0 ? t("cart.itemMany", { count }) : ""}
            </span>
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -end-1 grid size-5 place-items-center rounded-full bg-primary font-mono text-[0.65rem] font-semibold text-on-primary"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-[#E1D4C9] bg-white/70 text-[#38281E] transition-colors hover:bg-[#F5ECE4] md:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t("common.close") : t("nav.shop")}
          >
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-[#E8DDD3] bg-[#FFFDF9] transition-[max-height] duration-300 ease-out-soft md:hidden",
          menuOpen ? "max-h-64" : "max-h-0",
        )}
      >
        <nav className="container-page flex flex-col gap-1 py-3" aria-label="Mobile">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className="rounded-[12px] px-3 py-3 text-sm font-medium text-[#58483D] hover:bg-[#F5ECE4]"
            >
              {link.label}
            </Link>
          ))}
          <LocaleSwitcher className="mt-2 sm:hidden" />
        </nav>
      </div>
    </header>
  );
}
