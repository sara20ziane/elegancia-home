export const ELEGANCIA_PRESETS = [
  { fr: "Parure de drap", ar: "أطقم الشراشف" },
  { fr: "Parure housse de couette", ar: "أطقم أغطية اللحاف" },
  { fr: "Plaid", ar: "بطانيات خفيفة" },
  { fr: "Taies d’oreillers", ar: "أغطية الوسائد" },
  { fr: "Jetées", ar: "مفارش السرير" },
] as const;

export const COPY = {
  fr: {
    title: "Catégories de la boutique",
    intro:
      "Organise les modèles Elegancia comme les clientes les cherchent. Un même modèle peut appartenir à plusieurs catégories.",
    createTitle: "Ajouter une catégorie",
    arabic: "Nom arabe",
    french: "Nom français",
    frenchHint: "Utilisé dans la version française de la boutique.",
    add: "Ajouter",
    suggestions: "Suggestions Elegancia",
    suggestionsBody:
      "Clique sur une suggestion pour préremplir les deux noms. Rien n’est créé tant que tu n’appuies pas sur Ajouter.",
    alreadyAdded: "Déjà ajoutée",
    empty: "Aucune catégorie pour le moment.",
  },
  en: {
    title: "Store categories",
    intro:
      "Organise Elegancia models the way customers browse them. One model can belong to several categories.",
    createTitle: "Add a category",
    arabic: "Arabic name",
    french: "French name",
    frenchHint: "Used in the French version of the store.",
    add: "Add",
    suggestions: "Elegancia suggestions",
    suggestionsBody:
      "Choose a suggestion to prefill both names. Nothing is created until you press Add.",
    alreadyAdded: "Already added",
    empty: "No categories yet.",
  },
  ar: {
    title: "فئات المتجر",
    intro:
      "رتّبي موديلات Elegancia حسب طريقة بحث الزبونات. يمكن أن ينتمي نفس الموديل إلى أكثر من فئة.",
    createTitle: "إضافة فئة",
    arabic: "الاسم بالعربية",
    french: "الاسم بالفرنسية",
    frenchHint: "يظهر في النسخة الفرنسية من المتجر.",
    add: "إضافة",
    suggestions: "اقتراحات Elegancia",
    suggestionsBody: "اختاري اقتراحاً لملء الاسمين تلقائياً. لن يتم إنشاء شيء حتى تضغطي على إضافة.",
    alreadyAdded: "مضافة بالفعل",
    empty: "لا توجد فئات بعد.",
  },
} as const;
