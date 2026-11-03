import { useI18n } from "@/lib/i18n-context";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
const styleCopy = {
  fr: {
    eyebrow: "VOTRE UNIVERS",
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
    eyebrow: "YOUR STYLE",
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
    eyebrow: "ذوقك الخاص",
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

/** Always-visible editorial entry points, even before the first product is added. */
export function StyleDiscovery() {
  const { locale } = useI18n();
  const copy = styleCopy[locale];
  const palettes = [
    "linear-gradient(145deg,#89947F,#D7DDD0)",
    "linear-gradient(145deg,#A67278,#ECD8D8)",
    "linear-gradient(145deg,#B9A38D,#F2E9DE)",
    "linear-gradient(145deg,#6F716E,#D8D6D1)",
    "linear-gradient(145deg,#B68B95,#EEDFE2)",
  ];

  return (
    <section className="container-page py-14 sm:py-16">
      <div className="mb-8 max-w-2xl">
        <span className="text-[0.68rem] font-semibold tracking-[0.16em] text-primary">
          {copy.eyebrow}
        </span>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-[#38281E] sm:text-3xl">
          {copy.title}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[#76685E] sm:text-base">{copy.body}</p>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {copy.items.map(([title, body], index) => (
          <Link
            key={title}
            to="/catalogue"
            className="group relative min-h-[230px] min-w-[72%] snap-start overflow-hidden rounded-[22px] border border-white/70 p-5 shadow-[0_12px_32px_rgba(74,53,38,0.09)] transition-transform duration-300 hover:-translate-y-1 sm:min-w-0"
            style={{ background: palettes[index] }}
          >
            <span className="absolute inset-0 bg-gradient-to-t from-[#2C2018]/65 via-[#2C2018]/8 to-white/10" />
            <span className="relative flex h-full flex-col justify-end text-white">
              <span className="font-display text-xl font-semibold">{title}</span>
              <span className="mt-1.5 max-w-[220px] text-xs leading-5 text-white/85">{body}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold">
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
