// Strings added in Release 3.0A (question banks, game length, duration). Merged into each locale in ./index.ts.
export const V3_EN = {
  'qb.questions': 'Questions', 'qb.quick': 'Quick', 'qb.standard': 'Standard', 'qb.extended': 'Deep Dive', 'qb.all': 'All questions',
  'qb.nQ': '{n} questions', 'qb.needs': 'Needs {n} more questions', 'qb.bank': '{n} questions available',
  'qb.selection': 'Question selection',
  'qb.s.fixed': 'Fixed order', 'qb.s.random': 'Random mix', 'qb.s.category': 'Balanced by category', 'qb.s.dimension': 'Balanced by dimension',
  'qb.sd.fixed': 'The same questions every time, in the order they were written.',
  'qb.sd.random': 'A fresh mix each time. Questions from your recent rooms come last.',
  'qb.sd.category': 'An even mix across all categories. Questions from your recent rooms come last.',
  'qb.sd.dimension': 'An even mix across all dimensions. Questions from your recent rooms come last.',
  'qb.duration': 'Estimated duration: about {m} min', 'qb.durationNote': 'Plus a few minutes for people to join.',
  'qb.yourGame': 'Your game', 'qb.summary': '{n} questions · {sel} · {r} s reading · {a} s answering',
  'qb.lobby': '{n} questions · about {m} min', 'qb.lobbyOf': '{n} of {b} questions',
  'qb.later': 'Coming later: presentation themes (Professional, Playful, Party).',
  'qb.cardMin': 'about {m} min', 'qb.allShort': 'all questions',
};
type D = Record<keyof typeof V3_EN, string>;

export const V3_DE: D = {
  'qb.questions': 'Fragen', 'qb.quick': 'Kurz', 'qb.standard': 'Standard', 'qb.extended': 'Tiefgang', 'qb.all': 'Alle Fragen',
  'qb.nQ': '{n} Fragen', 'qb.needs': 'Es fehlen {n} Fragen', 'qb.bank': '{n} Fragen verfügbar',
  'qb.selection': 'Fragenauswahl',
  'qb.s.fixed': 'Feste Reihenfolge', 'qb.s.random': 'Zufällige Mischung', 'qb.s.category': 'Ausgewogen nach Kategorie', 'qb.s.dimension': 'Ausgewogen nach Dimension',
  'qb.sd.fixed': 'Immer dieselben Fragen, in der geschriebenen Reihenfolge.',
  'qb.sd.random': 'Jedes Mal neu gemischt. Fragen aus deinen letzten Räumen kommen zuletzt dran.',
  'qb.sd.category': 'Gleichmässig über alle Kategorien gemischt. Fragen aus deinen letzten Räumen kommen zuletzt dran.',
  'qb.sd.dimension': 'Gleichmässig über alle Dimensionen gemischt. Fragen aus deinen letzten Räumen kommen zuletzt dran.',
  'qb.duration': 'Geschätzte Dauer: etwa {m} Min.', 'qb.durationNote': 'Dazu kommen ein paar Minuten zum Beitreten.',
  'qb.yourGame': 'Dein Spiel', 'qb.summary': '{n} Fragen · {sel} · {r} s Lesen · {a} s Antworten',
  'qb.lobby': '{n} Fragen · etwa {m} Min.', 'qb.lobbyOf': '{n} von {b} Fragen',
  'qb.later': 'Später verfügbar: Präsentationsstile (Professionell, Verspielt, Party).',
  'qb.cardMin': 'etwa {m} Min.', 'qb.allShort': 'alle Fragen',
};

export const V3_FR: D = {
  'qb.questions': 'Questions', 'qb.quick': 'Rapide', 'qb.standard': 'Standard', 'qb.extended': 'Immersion', 'qb.all': 'Toutes les questions',
  'qb.nQ': '{n} questions', 'qb.needs': 'Il manque {n} questions', 'qb.bank': '{n} questions disponibles',
  'qb.selection': 'Choix des questions',
  'qb.s.fixed': 'Ordre fixe', 'qb.s.random': 'Mélange aléatoire', 'qb.s.category': 'Équilibré par catégorie', 'qb.s.dimension': 'Équilibré par dimension',
  'qb.sd.fixed': 'Toujours les mêmes questions, dans l’ordre prévu.',
  'qb.sd.random': 'Un nouveau mélange à chaque fois. Les questions de tes salles récentes passent en dernier.',
  'qb.sd.category': 'Un mélange équilibré entre toutes les catégories. Les questions de tes salles récentes passent en dernier.',
  'qb.sd.dimension': 'Un mélange équilibré entre toutes les dimensions. Les questions de tes salles récentes passent en dernier.',
  'qb.duration': 'Durée estimée : environ {m} min', 'qb.durationNote': 'Plus quelques minutes pour que tout le monde rejoigne.',
  'qb.yourGame': 'Ta partie', 'qb.summary': '{n} questions · {sel} · {r} s de lecture · {a} s de réponse',
  'qb.lobby': '{n} questions · environ {m} min', 'qb.lobbyOf': '{n} questions sur {b}',
  'qb.later': 'Bientôt : styles de présentation (Professionnel, Ludique, Fête).',
  'qb.cardMin': 'environ {m} min', 'qb.allShort': 'toutes les questions',
};

// Arabic: counts are written as "label: n" to avoid number–noun agreement errors with variable numbers.
export const V3_AR: D = {
  'qb.questions': 'الأسئلة', 'qb.quick': 'سريعة', 'qb.standard': 'عادية', 'qb.extended': 'تعمّق', 'qb.all': 'كل الأسئلة',
  'qb.nQ': 'عدد الأسئلة: {n}', 'qb.needs': 'ينقص {n} من الأسئلة', 'qb.bank': 'الأسئلة المتاحة: {n}',
  'qb.selection': 'اختيار الأسئلة',
  'qb.s.fixed': 'ترتيب ثابت', 'qb.s.random': 'مزيج عشوائي', 'qb.s.category': 'متوازن حسب الفئة', 'qb.s.dimension': 'متوازن حسب البُعد',
  'qb.sd.fixed': 'الأسئلة نفسها في كل مرة، بالترتيب الذي كُتبت به.',
  'qb.sd.random': 'مزيج جديد في كل مرة. تأتي أسئلة غرفك الأخيرة في النهاية.',
  'qb.sd.category': 'مزيج متوازن بين كل الفئات. تأتي أسئلة غرفك الأخيرة في النهاية.',
  'qb.sd.dimension': 'مزيج متوازن بين كل الأبعاد. تأتي أسئلة غرفك الأخيرة في النهاية.',
  'qb.duration': 'المدة المتوقعة: حوالي {m} دقيقة', 'qb.durationNote': 'بالإضافة إلى بضع دقائق لانضمام المشاركين.',
  'qb.yourGame': 'لعبتك', 'qb.summary': 'الأسئلة: {n} · {sel} · القراءة: {r} ث · الإجابة: {a} ث',
  'qb.lobby': 'الأسئلة: {n} · حوالي {m} دقيقة', 'qb.lobbyOf': '{n} من أصل {b} سؤالًا',
  'qb.later': 'قريبًا: أنماط العرض (احترافي، مرح، حفلة).',
  'qb.cardMin': 'حوالي {m} دقيقة', 'qb.allShort': 'كل الأسئلة',
};
