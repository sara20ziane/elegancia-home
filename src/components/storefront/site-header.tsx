import { Link } from "@tanstack/react-router";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useRef } from "react";
import { BrandSignature } from "@/components/brand-signature";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { brandCopy } from "@/lib/brand";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n-context";

export function SiteHeader() {
  const { t, locale } = useI18n();
  const { count, openCart } = useCart();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const copy = brandCopy(locale);
  const links = [
    { to: "/catalogue", label: t("nav.shop") },
    { to: "/livraison", label: t("nav.delivery") },
    { to: "/track", label: t("nav.trackOrder") },
  ] as const;

  function closeMenu() {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-outline bg-nav-bg/95 backdrop-blur">
      <div className="container-page flex min-h-[68px] items-center justify-between gap-2 lg:gap-6">
        <Link to="/" className="flex min-h-11 min-w-0 items-center">
          <BrandSignature />
        </Link>

        <nav className="hidden items-center gap-2 lg:flex" aria-label={copy.menu}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-sm px-3 py-2 text-sm font-semibold text-on-surface-muted hover:bg-surface-high hover:text-primary"
              activeProps={{ className: "bg-surface-high text-primary" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LocaleSwitcher className="hidden sm:block" />
          <ThemeToggle />
          <Link
            to="/search"
            className="header-icon hidden lg:inline-flex"
            aria-label={t("nav.search")}
          >
            <Search size={18} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={openCart}
            data-testid="cart-open"
            className="header-icon relative inline-flex"
            aria-label={t("cart.title")}
          >
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="sr-only" aria-live="polite">
              {count > 0 ? t("cart.itemMany", { count }) : ""}
            </span>
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -end-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-0.5 text-xs font-semibold text-on-primary"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
          <details
            ref={mobileMenu}
            id="mobile-shop-nav"
            className="group lg:hidden"
            suppressHydrationWarning
          >
            <summary
              className="header-icon mobile-menu-summary inline-flex list-none"
              aria-label={copy.mobileMenu}
            >
              <Menu size={18} className="group-open:hidden" aria-hidden="true" />
              <X size={18} className="hidden group-open:block" aria-hidden="true" />
            </summary>
            <nav
              className="absolute inset-x-0 top-full border-y border-outline bg-nav-bg py-3 shadow-md"
              aria-label={copy.menu}
            >
              <div className="container-page flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={closeMenu}
                    className="rounded-sm px-3 py-3 text-sm font-semibold hover:bg-surface-high"
                    activeProps={{ className: "bg-surface-high text-primary" }}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/search"
                  onClick={closeMenu}
                  className="flex items-center gap-2 rounded-sm px-3 py-3 text-sm font-semibold hover:bg-surface-high"
                >
                  <Search size={17} aria-hidden="true" />
                  {t("nav.search")}
                </Link>
                <LocaleSwitcher className="mt-2 sm:hidden" />
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
