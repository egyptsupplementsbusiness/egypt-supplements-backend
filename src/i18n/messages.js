// Arabic for the messages the server sends to the website (errors, "only 2
// left", "wrong password"...). The website says which language it wants with
// the Accept-Language header; see translateResponses() below.
//
// EXACT: whole messages. PATTERNS: messages with names or numbers in them.
// Anything not listed is sent in English as before.

const EXACT = {
  // ---- sign in, accounts ----
  "Invalid email or password": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  "Please provide both an email and a password": "من فضلك اكتب البريد الإلكتروني وكلمة المرور",
  "This account has been deactivated. Please contact support.": "تم إيقاف هذا الحساب. من فضلك تواصل معنا.",
  "This account was closed. Contact the shop on WhatsApp if you'd like it back.":
    "تم إغلاق هذا الحساب. تواصل مع المتجر على واتساب إذا أردت إعادة فتحه.",
  "Your session has expired. Please sign in again.": "انتهت جلستك. من فضلك سجّل الدخول مرة أخرى.",
  "Not authorized, no token provided": "من فضلك سجّل الدخول أولًا.",
  "Not authorized, token failed or expired": "انتهت جلستك. من فضلك سجّل الدخول مرة أخرى.",
  "Not authorized, user no longer exists": "هذا الحساب لم يعد موجودًا.",
  "Not authorized as an admin": "هذه الصفحة للإدارة فقط.",
  "User already exists": "يوجد حساب بهذا البريد الإلكتروني بالفعل",
  "Please fill in all fields": "من فضلك املأ كل الخانات",
  "Invalid user data received": "البيانات غير صحيحة",
  "User not found": "المستخدم غير موجود",
  "Incorrect old password": "كلمة المرور الحالية غير صحيحة",
  "Please provide both old and new passwords": "من فضلك اكتب كلمة المرور الحالية والجديدة",
  "That password is incorrect": "كلمة المرور غير صحيحة",
  "That is already your email address": "هذا هو بريدك الإلكتروني بالفعل",
  "That email is already in use by another account": "هذا البريد مستخدم في حساب آخر",
  "Admin accounts can't be closed from here.": "لا يمكن إغلاق حسابات الإدارة من هنا.",
  "You cannot remove your own admin role": "لا يمكنك إزالة صلاحية الإدارة من حسابك",
  "You cannot suspend your own admin account": "لا يمكنك إيقاف حسابك",
  "You are not authorized to update email, password, or role from this endpoint.":
    "لا يمكن تغيير البريد أو كلمة المرور أو الصلاحية من هنا.",
  "You cannot update your role here": "لا يمكن تغيير الصلاحية من هنا",
  "You cannot update your email here": "لا يمكن تغيير البريد من هنا",
  "You cannot update your password here": "لا يمكن تغيير كلمة المرور من هنا",
  "If there's an account for that email, the shop has been notified and will contact you to reset it.":
    "إذا كان هناك حساب بهذا البريد فقد تم إبلاغ المتجر وسيتواصل معك لإعادة تعيين كلمة المرور.",
  "Your account has been closed.": "تم إغلاق حسابك.",
  "Request not found": "الطلب غير موجود",
  "Too many wrong sign-in attempts.": "محاولات دخول خاطئة كثيرة.",
  "Too many password-help requests.": "طلبات استعادة كلمة مرور كثيرة.",

  // ---- form checks ----
  "Please provide a valid email address": "من فضلك اكتب بريدًا إلكترونيًا صحيحًا",
  "Please add a valid email": "من فضلك اكتب بريدًا إلكترونيًا صحيحًا",
  "Email is too long": "البريد الإلكتروني طويل جدًا",
  "Password is required": "من فضلك اكتب كلمة المرور",
  "Password must be at least 8 characters": "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
  "New password must be at least 8 characters": "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل",
  "Password is too long": "كلمة المرور طويلة جدًا",
  "New password is too long": "كلمة المرور الجديدة طويلة جدًا",
  "Old password is required": "من فضلك اكتب كلمة المرور الحالية",
  "Please enter your password to confirm": "من فضلك اكتب كلمة المرور للتأكيد",
  "Name must be at least 2 characters": "الاسم يجب أن يكون حرفين على الأقل",
  "Name must be at least 3 characters": "الاسم يجب أن يكون 3 أحرف على الأقل",
  "Name is too long (80 letters at most)": "الاسم طويل جدًا (80 حرفًا بحد أقصى)",
  "Name is too long (120 letters at most)": "الاسم طويل جدًا (120 حرفًا بحد أقصى)",
  "Please enter a valid Egyptian mobile number, e.g. 01012345678": "من فضلك اكتب رقم موبايل مصري صحيح، مثال: 01012345678",
  "Address is too long": "العنوان طويل جدًا",
  "Please enter your full name": "من فضلك اكتب اسمك بالكامل",
  "Please choose your governorate": "من فضلك اختر المحافظة",
  "Please enter your city or area": "من فضلك اكتب المدينة أو المنطقة",
  "Please enter your street address": "من فضلك اكتب العنوان",
  "Invalid JSON in request body": "البيانات المرسلة غير صحيحة",
  "Validation failed: Check your input data": "من فضلك راجع البيانات المكتوبة",
  "Resource not found in the database": "غير موجود",

  // ---- cart, orders ----
  "Your cart is empty": "سلتك فارغة",
  "Quantity must be at least 1": "الكمية يجب أن تكون 1 على الأقل",
  "Quantity must be a whole number": "الكمية يجب أن تكون رقمًا صحيحًا",
  "Too many different items in one order": "منتجات مختلفة كثيرة في طلب واحد",
  "Too many items in the cart": "منتجات كثيرة في السلة",
  "One of the items in your cart is no longer available. Please remove it and try again.":
    "أحد المنتجات في سلتك لم يعد متاحًا. من فضلك احذفه وحاول مرة أخرى.",
  "Order not found": "الطلب غير موجود",
  "This order is already cancelled.": "هذا الطلب ملغي بالفعل.",
  "This order has already been delivered, so it can't be cancelled. Please contact us on WhatsApp.":
    "تم توصيل هذا الطلب بالفعل، لذلك لا يمكن إلغاؤه. من فضلك تواصل معنا على واتساب.",
  "This order has already been confirmed, so it can't be cancelled here. Please contact us on WhatsApp.":
    "تم تأكيد هذا الطلب بالفعل، لذلك لا يمكن إلغاؤه من هنا. من فضلك تواصل معنا على واتساب.",
  "This order has changed since you opened it. Please refresh and try again.":
    "تغيّر هذا الطلب منذ أن فتحته. من فضلك حدّث الصفحة وحاول مرة أخرى.",
  "Unknown order status": "حالة طلب غير معروفة",
  "Please wait until we confirm one (we'll contact you), or cancel one from My orders, then try again.":
    "انتظر حتى نؤكد أحدها (سنتصل بك)، أو ألغِ واحدًا من «طلباتي»، ثم حاول مرة أخرى.",

  // ---- products, categories (admin) ----
  "Product not found": "المنتج غير موجود",
  "Category not found": "القسم غير موجود",
  "Please pick a category for this product.": "من فضلك اختر قسمًا لهذا المنتج.",
  "That category no longer exists. Please pick another one from the list.": "هذا القسم لم يعد موجودًا. من فضلك اختر قسمًا آخر من القائمة.",
  "Each new flavor or size needs a price and a stock number.": "كل نكهة أو حجم جديد يحتاج سعرًا وعدد قطع في المخزون.",
  "A product needs at least one flavor or size with a price.": "المنتج يحتاج نكهة أو حجمًا واحدًا على الأقل بسعر.",
  "This product was changed while you were editing it.": "تغيّر هذا المنتج أثناء تعديلك له.",
  "One of the options you changed was deleted by someone else.": "أحد الاختيارات التي عدّلتها تم حذفه بواسطة شخص آخر.",
  "No product variants provided. You must add at least one price/stock entry.": "أضف اختيارًا واحدًا على الأقل بسعر ومخزون.",
  "At least one variant is required": "أضف اختيارًا واحدًا على الأقل",
  "Too many options (40 at most)": "اختيارات كثيرة (40 بحد أقصى)",
  "Price must be greater than 0": "السعر يجب أن يكون أكبر من 0",
  "That price is too high": "هذا السعر مرتفع جدًا",
  "Stock must be a whole number": "المخزون يجب أن يكون رقمًا صحيحًا",
  "Stock cannot be negative": "المخزون لا يمكن أن يكون بالسالب",
  "That stock number is too high": "رقم المخزون كبير جدًا",
  "Discounted price cannot be negative": "سعر العرض لا يمكن أن يكون بالسالب",
  "Price cannot be negative": "السعر لا يمكن أن يكون بالسالب",
  "Flavor is too long (60 letters at most)": "النكهة طويلة جدًا (60 حرفًا بحد أقصى)",
  "Size is too long (60 letters at most)": "الحجم طويل جدًا (60 حرفًا بحد أقصى)",
  "Servings is too long": "عدد الحصص طويل جدًا",
  "Product code is too long (60 letters at most)": "كود المنتج طويل جدًا (60 حرفًا بحد أقصى)",
  "Brand is too long (60 letters at most)": "الماركة طويلة جدًا (60 حرفًا بحد أقصى)",
  "Summary is too long": "الوصف القصير طويل جدًا",
  "Summary cannot exceed 200 characters": "الوصف القصير لا يزيد عن 200 حرف",
  "Full description is too long (5000 letters at most)": "الوصف الكامل طويل جدًا (5000 حرف بحد أقصى)",
  "Invalid image URL": "رابط الصورة غير صحيح",
  "Invalid id": "رقم غير صحيح",
  "Invalid category id": "قسم غير صحيح",
  "Please add a product name": "من فضلك اكتب اسم المنتج",
  "Please add a price": "من فضلك اكتب السعر",
  "Please add an image link": "من فضلك أضف صورة",
  "A category with this name already exists": "يوجد قسم بهذا الاسم بالفعل",
  "Please enter a category name": "من فضلك اكتب اسم القسم",
  "Category name must be at least 2 characters": "اسم القسم يجب أن يكون حرفين على الأقل",
  "Description is too long (160 letters at most)": "الوصف طويل جدًا (160 حرفًا بحد أقصى)",

  // ---- pictures ----
  "Image is too large. The maximum size is 4 MB.": "الصورة كبيرة جدًا. الحد الأقصى 4 ميجابايت.",
  "Only JPG, PNG or WEBP images are allowed": "مسموح فقط بصور JPG أو PNG أو WEBP",
  "No file uploaded": "لم يتم رفع أي ملف",
  "The picture couldn't be uploaded. Please try again.": "تعذّر رفع الصورة. حاول مرة أخرى.",
  "The picture couldn't be uploaded because the internet connection to the image service failed. Please check your internet and try again.":
    "تعذّر رفع الصورة لأن الاتصال بخدمة الصور فشل. تأكد من الإنترنت وحاول مرة أخرى.",

  // ---- settings ----
  "The hero can show at most 2 images": "يمكن عرض صورتين بحد أقصى في البانر",
  "Links must start with http:// or https://": "الروابط يجب أن تبدأ بـ http:// أو https://",
  "WhatsApp number should be digits only, with country code, e.g. 201012345678":
    "رقم واتساب يجب أن يكون أرقامًا فقط مع كود الدولة، مثال: 201012345678",
  "Enter a valid email": "اكتب بريدًا إلكترونيًا صحيحًا",
  "Fee can't be negative": "الرسوم لا يمكن أن تكون بالسالب",
  "That text is too long (600 letters at most)": "النص طويل جدًا (600 حرف بحد أقصى)",
  "Too many texts": "نصوص كثيرة",
  "Unknown text name": "اسم نص غير معروف",

  // ---- backup ----
  "Please confirm the restore first.": "من فضلك أكّد الاسترجاع أولًا.",
  "No backup file was received. Please choose the file again.": "لم يصل ملف النسخة. من فضلك اختر الملف مرة أخرى.",
  "This file isn't a shop backup (it couldn't be read). Nothing was changed.": "هذا الملف ليس نسخة احتياطية للمتجر (تعذّرت قراءته). لم يتغير شيء.",
  "This file isn't a backup from this shop. Nothing was changed.": "هذا الملف ليس نسخة احتياطية من هذا المتجر. لم يتغير شيء.",
  "This backup has no admin account, so nobody could sign in after restoring it. Nothing was changed.":
    "هذه النسخة لا تحتوي على حساب إدارة، فلن يستطيع أحد الدخول بعد استرجاعها. لم يتغير شيء.",

  // ---- general ----
  "Something went wrong on our side. Please try again in a moment.": "حدث خطأ لدينا. حاول مرة أخرى بعد قليل.",
  "The server is not set up yet. Please try again later.": "الخادم غير جاهز بعد. حاول مرة أخرى لاحقًا.",
  "The shop is having trouble reaching its database. Please try again in a minute.": "المتجر يواجه مشكلة في الوصول لقاعدة البيانات. حاول مرة أخرى بعد دقيقة.",
};

const unitMinutes = (n) => (Number(n) === 1 ? "دقيقة واحدة" : Number(n) === 2 ? "دقيقتين" : Number(n) <= 10 ? `${n} دقائق` : `${n} دقيقة`);

// [regex, (match) => Arabic]
const PATTERNS = [
  [/^(.*) Please wait (\d+) minutes? and try again\.$/, (m) => `${translateOne(m[1])} من فضلك انتظر ${unitMinutes(m[2])} وحاول مرة أخرى.`],
  [/^You already have (\d+) orders waiting for the shop to confirm them\. (.*)$/, (m) => `لديك بالفعل ${m[1]} طلبات في انتظار تأكيد المتجر. ${translateOne(m[2])}`],
  [/^(.+) is sold out\.$/, (m) => `نفدت كمية ${m[1]}.`],
  [/^Only (\d+) left of (.+)\.$/, (m) => `متبقٍ ${m[1]} فقط من ${m[2]}.`],
  [/^Sorry, (.+) just sold out\. Please update your cart and try again\.$/, (m) => `عذرًا، نفدت كمية ${m[1]} للتو. من فضلك حدّث سلتك وحاول مرة أخرى.`],
  [/^Not enough stock left of (.+) to bring this order back\.$/, (m) => `لا يوجد مخزون كافٍ من ${m[1]} لاسترجاع هذا الطلب.`],
  [/^You can order up to (\d+) of one item$/, (m) => `يمكنك طلب ${m[1]} قطع بحد أقصى من المنتج الواحد`],
  [/^That (\w+) is already in use$/, () => "هذه القيمة مستخدمة بالفعل"],
  [/^A product called "(.+)"(?: by (.+))? already exists\. Edit that one to add stock or options, or use a different name\.$/, (m) =>
    `يوجد منتج باسم «${m[1]}»${m[2] ? ` من ${m[2]}` : ""} بالفعل. عدّله لإضافة مخزون أو اختيارات، أو استخدم اسمًا آخر.`],
  [/^Another product is already called "(.+)"(?: by (.+))? in this category\. Please use a different name\.$/, (m) =>
    `يوجد منتج آخر باسم «${m[1]}»${m[2] ? ` من ${m[2]}` : ""} في هذا القسم. من فضلك استخدم اسمًا آخر.`],
  [/^There's no category called "(.+)"\. Please pick one from the list, or add it under Categories first\.$/, (m) =>
    `لا يوجد قسم باسم «${m[1]}». اختر قسمًا من القائمة، أو أضفه من صفحة الأقسام أولًا.`],
  [/^The sale price \((.+)\) must be lower than the normal price \((.+)\) and above 0\.$/, (m) =>
    `سعر العرض (${m[1]}) يجب أن يكون أقل من السعر الأصلي (${m[2]}) وأكبر من 0.`],
  [/^Stock of (.+) is now (\d+)\. It was (\d+) when you opened this product \(new orders or another change since\)\.$/, (m) =>
    `مخزون ${m[1] === "this option" ? "هذا الاختيار" : m[1]} أصبح ${m[2]}. كان ${m[3]} عندما فتحت المنتج (طلبات جديدة أو تغيير آخر منذ ذلك الوقت).`],
  [/^The (.+) of (.+) was changed by someone else\.$/, (m) =>
    `تم تغيير ${FIELD_AR[m[1]] || m[1]} لـ${m[2] === "this option" ? "هذا الاختيار" : m[2]} بواسطة شخص آخر.`],
  [/^The (.+) was changed by someone else\.$/, (m) => `تم تغيير ${FIELD_AR[m[1]] || m[1]} بواسطة شخص آخر.`],
  [/^Not Found - (.*)$/, () => "الصفحة غير موجودة"],
];

const FIELD_AR = {
  name: "الاسم",
  brand: "الماركة",
  category: "القسم",
  "short description": "الوصف القصير",
  "full description": "الوصف الكامل",
  photo: "الصورة",
  "home page setting": "إعداد الصفحة الرئيسية",
  "shown/hidden in the shop": "الظهور في المتجر",
  flavor: "النكهة",
  size: "الحجم",
  servings: "عدد الحصص",
  price: "السعر",
  stock: "المخزون",
  "sale price": "سعر العرض",
  "product code": "كود المنتج",
};

function translateOne(text) {
  if (typeof text !== "string" || !text) return text;
  if (EXACT[text]) return EXACT[text];
  for (const [re, make] of PATTERNS) {
    const m = text.match(re);
    if (m) return make(m);
  }
  return text;
}

/** English server message -> Arabic. Several form errors joined with ", " are translated one by one. */
export const toArabic = (text) => {
  if (typeof text !== "string" || !text) return text;
  const whole = translateOne(text);
  if (whole !== text) return whole;
  if (!text.includes(", ")) return text;
  // Several messages joined with ", " (some contain commas themselves, like
  // "...number, e.g. 0101..."), so match the known ones from the start.
  const known = Object.keys(EXACT).sort((a, b) => b.length - a.length);
  const parts = [];
  let rest = text;
  while (rest) {
    const hit = known.find((k) => rest.startsWith(k) && (rest.length === k.length || rest.startsWith(", ", k.length)));
    const piece = hit || (rest.includes(", ") ? rest.slice(0, rest.indexOf(", ")) : rest);
    parts.push(translateOne(piece));
    rest = rest.slice(piece.length).replace(/^, /, "");
  }
  return parts.join("، ");
};

const wantsArabic = (req) => /^ar\b/i.test(String(req.headers["accept-language"] || ""));

/**
 * Express middleware: when the website asks for Arabic, the "message" (and
 * "conflicts") in every JSON reply is translated. The English wording stays
 * in "messageEn" so the website can still recognise it.
 */
export const translateResponses = (req, res, next) => {
  if (!wantsArabic(req)) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const out = { ...body };
      if (typeof out.message === "string") {
        out.messageEn = out.message;
        out.message = toArabic(out.message);
      }
      if (Array.isArray(out.conflicts)) out.conflicts = out.conflicts.map(toArabic);
      return json(out);
    }
    return json(body);
  };
  next();
};
