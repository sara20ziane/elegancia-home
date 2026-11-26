import { useI18n } from "@/lib/i18n-context";
import { Link } from "@tanstack/react-router";

const styleCopy = {
  fr: {
    title: "Choisissez selon votre style",
    body: "Des ambiances douces et faciles à assortir pour créer une chambre qui vous ressemble.",
    items: [
      ["Nature & sauge", "Des tons calmes inspirés de la nature."],
      ["Romantique floral", "Fleurs délicates et détails féminins."],
      ["Neutres & beige", "Une élégance lumineuse et intemporelle."],
      ["Chic contemporain", "Motifs graphiques et nuances raffinées."],
      ["Tons poudrés", "Rose, mauve et couleurs douces."],
    ],
  },
  en: {
    title: "Shop by mood",
    body: "Soft, easy-to-coordinate palettes to create a bedroom that feels like you.",
    items: [
      ["Nature & sage", "Calm tones inspired by nature."],
      ["Romantic florals", "Delicate flowers and feminine details."],
      ["Neutrals & beige", "Bright, timeless elegance."],
      ["Contemporary chic", "Graphic patterns and refined shades."],
      ["Powder tones", "Rose, mauve and gentle colours."],
    ],
  },
  ar: {
    title: "اختاري حسب ستايلك",
    body: "ألوان هادئة وسهلة التنسيق لتصنعي غرفة تشبه ذوقك.",
    items: [
      ["طبيعي وأخضر هادئ", "درجات مريحة مستوحاة من الطبيعة."],
      ["ورود رومانسية", "نقوش زهرية ناعمة ولمسات أنثوية."],
      ["بيج ومحايد", "أناقة مضيئة لا تخرج من الموضة."],
      ["شيك عصري", "نقوش راقية ودرجات متوازنة."],
      ["ألوان بودر", "وردي وموف ودرجات ناعمة."],
    ],
  },
} as const;

const swatches = ["bg-sage", "bg-brand", "bg-taupe", "bg-slate-blue", "bg-ivory"] as const;

export function StyleDiscovery() {
  const { locale, t } = useI18n();
  const copy = styleCopy[locale];
  return (
    <section className="border-t border-outline bg-section-alt py-10 sm:py-14">
      <div className="container-page">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-primary sm:text-3xl">
              {copy.title}
            </h2>
            <p className="mt-3 max-w-xl text-base text-on-surface-muted">{copy.body}</p>
          </div>
          <Link
            to="/catalogue"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
          >
            {t("home.browseAll")}
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {copy.items.map(([title, body], index) => (
            <li key={title} className="overflow-hidden rounded-sm border border-outline bg-surface">
              <div className={`h-9 ${swatches[index]}`} aria-hidden="true" />
              <div className="p-3 sm:p-4">
                <h3 className="font-display text-lg text-primary">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
