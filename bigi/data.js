/* ==========================================================================
   ביגי ספקים — נתוני דמו (קטגוריות של ספקי אירועים, ספקים, ביקורות, סטטיסטיקות)
   ========================================================================== */

const CATEGORIES = [
  { id: "dj",       name: "DJ ומוזיקה",           icon: "🎧", count: 184, grad: "g1", keywords: "די ג'יי דיג'יי דיגיי תקליטן מוזיקה" },
  { id: "photo",    name: "צילום ווידאו",          icon: "📸", count: 231, grad: "g2", keywords: "צלם צלמת צלמים מצלמה סטילס וידאו צילומים" },
  { id: "catering", name: "קייטרינג ומזון",        icon: "🍽️", count: 198, grad: "g3", keywords: "אוכל שף מזון כשר קייטרינג" },
  { id: "design",   name: "עיצוב והפקת אירועים",   icon: "🎈", count: 142, grad: "g4", keywords: "מעצב מעצבת הפקה מפיק מפיקה בלונים" },
  { id: "venues",   name: "אולמות וגני אירועים",   icon: "🏛️", count: 96,  grad: "g5", keywords: "אולם גן מקום לאירוע" },
  { id: "magic",    name: "קוסמים ואמני חושים",    icon: "🎩", count: 78,  grad: "g6", keywords: "קוסם ליצן ליצנים מופע ילדים" },
  { id: "bands",    name: "להקות וזמרים",          icon: "🎤", count: 113, grad: "g7", keywords: "להקה זמר זמרת נגנים הופעה חיה" },
  { id: "invites",  name: "הזמנות ועיצוב גרפי",    icon: "💌", count: 87,  grad: "g8", keywords: "הזמנה גרפיקה גרפיקאי מעצב גרפי" },
  { id: "flowers",  name: "פרחים ועיצוב שולחנות",  icon: "💐", count: 104, grad: "g1", keywords: "פרח זר זרים שולחנות" },
  { id: "beauty",   name: "איפור ושיער לכלה",      icon: "💄", count: 156, grad: "g2", keywords: "מאפרת איפור תסרוקת שיער כלה" },
  { id: "rentals",  name: "השכרת תאורה והגברה",    icon: "💡", count: 69,  grad: "g3", keywords: "הגברה תאורה סאונד רמקולים ציוד" },
  { id: "transport", name: "הסעות לאירועים",       icon: "🚌", count: 52,  grad: "g4", keywords: "הסעה אוטובוס מיניבוס נהג" },
];

const CITIES = ["תל אביב", "ירושלים", "חיפה", "באר שבע", "ראשון לציון", "פתח תקווה", "נתניה", "אשדוד", "רמת גן", "הרצליה"];

const VENDORS = [
  { id: 1,  name: "DJ אלון רועי",        cat: "dj",        city: "תל אביב",   rating: 5.0, reviews: 289, priceFrom: 2200, badge: "מומלץ",      tag: "DJ לחתונות ואירועים", grad: "g1", emoji: "🎧", phone: "972501234501" },
  { id: 2,  name: "סטודיו לומן",         cat: "photo",     city: "תל אביב",   rating: 4.9, reviews: 212, priceFrom: 1800, badge: "מומלץ",      tag: "צילום סטילס לאירועים", grad: "g2", emoji: "📷", phone: "972501234502" },
  { id: 3,  name: "קייטרינג טעם המלך",   cat: "catering",  city: "אשדוד",     rating: 4.8, reviews: 176, priceFrom: 6500, badge: "מומלץ",      tag: "קייטרינג לחתונות",    grad: "g3", emoji: "🍽️", phone: "972501234503" },
  { id: 4,  name: "סטודיו בלון פרודקשנס", cat: "design",   city: "רמת גן",    rating: 4.7, reviews: 94,  priceFrom: 2600, badge: "זמין השבוע", tag: "עיצוב והפקת אירועים", grad: "g4", emoji: "🎈", phone: "972501234504" },
  { id: 5,  name: "גני האחוזה הירוקה",    cat: "venues",   city: "הרצליה",    rating: 4.9, reviews: 143, priceFrom: 18000, badge: "מומלץ",     tag: "גן אירועים",          grad: "g5", emoji: "🏛️", phone: "972501234505" },
  { id: 6,  name: "קוסם דני הפלאות",     cat: "magic",     city: "חיפה",      rating: 4.9, reviews: 61,  priceFrom: 900,  badge: "חדש",        tag: "קוסם לאירועים",       grad: "g6", emoji: "🎩", phone: "972501234506" },
  { id: 7,  name: "להקת סטריט לייב",     cat: "bands",     city: "תל אביב",   rating: 4.8, reviews: 87,  priceFrom: 5200, badge: "זמין השבוע", tag: "להקה חיה לחתונות",    grad: "g7", emoji: "🎤", phone: "972501234507" },
  { id: 8,  name: "סטודיו הזמנה מושלמת", cat: "invites",   city: "פתח תקווה", rating: 4.6, reviews: 58,  priceFrom: 450,  badge: null,          tag: "עיצוב הזמנות דיגיטליות", grad: "g8", emoji: "💌", phone: "972501234508" },
  { id: 9,  name: "פרחי גן עדן",         cat: "flowers",   city: "רמת גן",    rating: 4.8, reviews: 102, priceFrom: 1200, badge: "מומלץ",      tag: "עיצוב פרחים לאירועים", grad: "g1", emoji: "💐", phone: "972501234509" },
  { id: 10, name: "קרן שיער ואיפור כלות", cat: "beauty",   city: "נתניה",     rating: 4.9, reviews: 234, priceFrom: 900,  badge: "מומלץ",      tag: "איפור ושיער לכלה",    grad: "g2", emoji: "💄", phone: "972501234510" },
  { id: 11, name: "סאונד אנד לייט פרו",  cat: "rentals",   city: "ראשון לציון", rating: 4.6, reviews: 73, priceFrom: 1500, badge: "זמין השבוע", tag: "השכרת הגברה ותאורה", grad: "g3", emoji: "💡", phone: "972501234511" },
  { id: 12, name: "הסעות VIP אירועים",   cat: "transport", city: "באר שבע",   rating: 4.4, reviews: 46,  priceFrom: 1100, badge: null,          tag: "הסעות אורחים לאירוע", grad: "g4", emoji: "🚌", phone: "972501234512" },
  { id: 13, name: "וידאו קסם הפקות",     cat: "photo",     city: "פתח תקווה", rating: 4.9, reviews: 88,  priceFrom: 3400, badge: "מומלץ",      tag: "וידאו לחתונות",       grad: "g5", emoji: "🎬", phone: "972501234513" },
  { id: 14, name: "DJ שירה כהן",         cat: "dj",        city: "חיפה",      rating: 4.7, reviews: 121, priceFrom: 1900, badge: "חדש",        tag: "DJ לבר/בת מצווה",     grad: "g6", emoji: "🎚️", phone: "972501234514" },
  { id: 15, name: "מטבח האחוזה קייטרינג", cat: "catering", city: "ירושלים",  rating: 4.7, reviews: 132, priceFrom: 5800, badge: null,          tag: "קייטרינג כשר",        grad: "g7", emoji: "🥘", phone: "972501234515" },
  { id: 16, name: "אולמי הגפן הזהובה",   cat: "venues",    city: "רמת גן",    rating: 4.5, reviews: 167, priceFrom: 22000, badge: null,         tag: "אולם אירועים",        grad: "g8", emoji: "🏰", phone: "972501234516" },
  { id: 17, name: "ליצן קפיץ",           cat: "magic",     city: "אשדוד",     rating: 4.8, reviews: 54,  priceFrom: 700,  badge: "חדש",         tag: "ליצן ואמן בלונים",    grad: "g1", emoji: "🤡", phone: "972501234517" },
  { id: 18, name: "בוטיק שולחנות שביל הזהב", cat: "flowers", city: "תל אביב", rating: 4.9, reviews: 76,  priceFrom: 1600, badge: "מומלץ",      tag: "עיצוב שולחנות אירוע", grad: "g2", emoji: "🌸", phone: "972501234518" },
];

const PACKAGES = {
  events: [
    { name: "חבילת בסיס", price: 1800, items: ["3 שעות צילום/הפעלה", "50 תמונות ערוכות", "אלבום דיגיטלי"] },
    { name: "חבילה מורחבת", price: 3200, items: ["5 שעות צילום/הפעלה", "150 תמונות ערוכות", "אלבום מודפס", "וידאו קצר"] },
    { name: "חבילת פרימיום", price: 5400, items: ["אירוע מלא מתחילתו ועד סופו", "כל התמונות ערוכות", "אלבום יוקרה", "וידאו + דרון"] },
  ],
};

const REVIEWS = [
  { name: "מיכל א.", rating: 5, text: "הגיעו לחתונה שלנו והיו מדהימים, כל האורחים שאלו מי הספק!", days: 3 },
  { name: "דני כ.", rating: 5, text: "מקצועיים, הגיעו בזמן ועבדו מעולה. ממליץ בחום לכל אירוע.", days: 9 },
  { name: "רותם ל.", rating: 4, text: "תוצאה מצוינת, תקשורת מראש קצת איטית אבל ביום האירוע הכל היה מושלם.", days: 14 },
  { name: "עומר ש.", rating: 5, text: "בדיוק מה שחיפשנו לאירוע — מקצועיות, טעם טוב ומחיר הוגן.", days: 21 },
];

const STATS = [
  { value: 127, suffix: "", label: "הזמנות אירוע היום" },
  { value: 2140, suffix: "+", label: "ספקי אירועים פעילים" },
  { value: 18500, suffix: "+", label: "אירועים מוצלחים" },
  { value: 4.8, suffix: "★", label: "דירוג ממוצע", decimals: 1 },
];
