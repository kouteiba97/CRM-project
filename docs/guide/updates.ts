import type { Block, Guide, Section } from "./content";

/**
 * Chapters and changes for the features added after the first guide (accounts and security,
 * teams, emailed and recurring invoices, expenses, files, import, notifications, installing on
 * a phone, going live). `withUpdates` merges them into the base guide of content.ts.
 */
type Lang = "en" | "ar";
type Patch = {
  /** New chapters, inserted after the chapter with this id. */
  insert: { after: string; section: Section }[];
  /** Blocks appended to an existing chapter. */
  append: Record<string, Block[]>;
  /** Chapters whose blocks are replaced entirely. */
  replace: Record<string, { title?: string; blocks: Block[] }>;
};

const EN: Patch = {
  insert: [
    {
      after: "account",
      section: {
        id: "security",
        title: "Your account and security",
        blocks: [
          { shot: "security", caption: "Settings › Security: two-step login, signed-in devices and the security log." },
          { h: "Name, email and password (Settings › Account)" },
          {
            bullets: [
              "Change your name at any time.",
              "Change email: type the new address and your current password. We email a link to the new address; your email changes only when you click it, and the old address is told.",
              "Change password: type the current one and the new one twice. Every other device is signed out and you receive a notice by email.",
              "Signed up with Google? Use “Email me a link to set a password” to be able to sign in with your email too.",
            ],
          },
          { h: "Two-step login (Settings › Security)" },
          {
            steps: [
              "Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 2FAS…).",
              "Click “Turn on two-step login”, scan the QR code with the app, and type the 6-digit code it shows.",
              "Save the ten recovery codes (download them, tick “I saved my recovery codes”). Each works once if you lose your phone.",
              "From now on, sign-in asks for the code after your password.",
            ],
          },
          {
            bullets: [
              "“Sign out other devices” signs out every other browser and phone (lost phone, shared computer).",
              "“Security activity” lists the last sign-ins and important changes with the IP address and device.",
              "Settings › Data › “Download my data” gives you everything stored about you; owners and admins can download the whole workspace.",
              "Settings › Account › “Delete my account” removes your account for good (download your data first).",
            ],
          },
        ],
      },
    },
    {
      after: "security",
      section: {
        id: "team",
        title: "Working as a team",
        blocks: [
          { shot: "team", caption: "Settings › Team: members, roles and invitations." },
          {
            steps: [
              "Settings › Team: type a colleague's email, choose a role, click “Send invitation”.",
              "They receive an email and click “Accept the invitation”. If they have no account yet, they choose their name and a password; the link proves their email.",
              "They now see the same clients, invoices and tasks as you.",
            ],
          },
          {
            bullets: [
              "Owner: everything, including making other owners. A workspace always keeps at least one owner.",
              "Admin: manages the team, company details, data export, and can void invoices.",
              "Member: works with clients, leads, projects, tasks, documents and payments.",
              "Change a role from the list, or remove someone with ×. Invitations can be resent or cancelled.",
              "Someone in several workspaces switches between them from the workspace name at the top of the sidebar.",
            ],
          },
        ],
      },
    },
    {
      after: "payments",
      section: {
        id: "expenses",
        title: "Expenses and profit",
        blocks: [
          { shot: "expenses", caption: "Expenses by period and category." },
          {
            steps: [
              "Finance › Expenses › “New expense”: what it was for, amount, date, category, and who you paid.",
              "Link it to a client or project to see what each one really costs.",
              "Filter by month, last month, year or category; the total is shown above the list.",
            ],
          },
          { p: "Reports › “Expenses & profit” shows what you collected, what you spent, and the profit for the period." },
        ],
      },
    },
  ],
  append: {
    screen: [
      {
        bullets: [
          "The bell shows what happened for you: a payment received, a task given to you, a colleague who joined, an invoice gone overdue. Click one to open it; “Mark all read” clears the dot.",
          "On a phone: open the site, then the browser menu › “Add to Home screen” (or “Install app”). Apex CRM then opens full-screen like an app.",
        ],
      },
    ],
    clients: [
      { h: "Quick look, columns, files, import" },
      {
        bullets: [
          "The eye icon next to a name opens a quick look (contact, amount due, recent activity) without leaving the list. Esc closes it.",
          "“Columns” chooses which columns the list shows; your choice is remembered.",
          "A client's Files tab keeps contracts, briefs and photos (up to 4 MB each: PDF, images, Office, text, CSV, ZIP). Only your workspace can download them.",
        ],
      },
      { shot: "import", caption: "Importing a client list from a spreadsheet." },
      {
        steps: [
          "Clients › “Import” › choose a CSV or Excel (.xlsx) file with one client per row and column titles on the first row (a sample file is offered).",
          "Check the columns we matched (name, email, phone, city, tags, contact…) and the preview.",
          "Click “Import”. Rows without a name, with a broken email, or already in your list are skipped and listed.",
        ],
      },
    ],
    reports: [{ bullets: ["Expenses & profit: collected minus expenses, with your spending by category."] }],
  },
  replace: {
    documents: {
      blocks: [
        { shot: "editor", caption: "The invoice editor: lines on the left, live preview on the right." },
        {
          steps: [
            "Click “New invoice” (or press I), or “New quotation” in Quotations.",
            "Choose the client. Add lines: description, quantity, unit price, discount and tax. Press Enter to add the next line. Totals update as you type.",
            "The preview shows the real document, in the client's document language (French, English or Arabic).",
            "Save the draft, then click “Send”: check the email and click Send. The client receives it with the PDF attached, from your company name; replies come to you.",
            "“Download PDF” downloads the same PDF file.",
          ],
        },
        { shot: "invoice", caption: "An invoice after it was sent, with its payment summary and reminder schedule." },
        { h: "Recurring invoices" },
        {
          steps: [
            "Open an invoice you bill regularly and click “Repeat”.",
            "Choose every month, 3 months or year, the date of the first new invoice, and (optionally) when to stop.",
            "Tick “Email it to the client automatically” to send each new invoice, or leave it unticked to get a draft to check.",
            "Invoices › “Recurring invoices” lists every schedule, with Pause, Resume and Delete.",
          ],
        },
        {
          bullets: [
            "Numbers are automatic: INV-2026-0001 for invoices, Q-2026-001 for quotations.",
            "A quotation can be marked Accepted or Declined, and converted to an invoice in one click.",
            "An invoice becomes Overdue by itself after its due date. “Send reminder” emails the client a reminder with the PDF.",
            "Void an invoice (owners and admins) instead of deleting it; the number stays used, so your numbering has no gaps.",
          ],
        },
      ],
    },
    payments: {
      blocks: [
        { shot: "payments", caption: "All payments, with filters." },
        {
          steps: [
            "Open an invoice and click “Record payment”, or use “Record payment” in Payments.",
            "Type the amount, the date and the method (transfer, cash, cheque, card…). A partial amount leaves the rest outstanding; the invoice shows “Partially paid”.",
            "When everything is paid the invoice turns “Paid” by itself.",
          ],
        },
        {
          p: "Reminders go out by themselves: every morning, unpaid invoices get a polite email with the PDF on the due date, then 3, 7 and 14 days later. Each invoice shows its schedule (sent, due, skipped, upcoming). Switch reminders off for a client who prefers a phone call (client profile › Automatic payment reminders).",
        },
      ],
    },
    settings: {
      blocks: [
        { shot: "settings", caption: "Settings › Workspace: details printed on your documents." },
        {
          bullets: [
            "General: language, theme (light, dark, or follow the computer) and sidebar.",
            "Account: name, email, password, delete account.",
            "Security: two-step login, sign out other devices, security activity.",
            "Workspace (owners and admins): company name, address, NIF, RC, NIS, AI, IBAN, currency and document language — printed on every quotation and invoice.",
            "Team: members, roles and invitations. Data: download your data or the whole workspace.",
          ],
        },
        {
          keys: [
            ["Ctrl + K  ·  /", "Search and jump anywhere"],
            ["G → D / C / L / P / T / I", "Press G, then the letter: Dashboard / Clients / Leads / Projects / Tasks / Invoices"],
            ["C · L · P · I · T", "New client, lead, project, invoice, task"],
            ["[", "Fold or unfold the sidebar"],
            ["Esc", "Close a window or menu"],
          ],
        },
      ],
    },
    admin: {
      title: "For the owner: putting Apex CRM online",
      blocks: [
        {
          p: "The file DEPLOY.md in the project explains every step in detail. In short:",
        },
        {
          steps: [
            "Push the code to your private GitHub repository.",
            "Create a new, empty Neon project “apex-crm-production” — separate from the database you use for testing.",
            "Import the repository in Vercel, add the settings (DATABASE_URL of the production database, AUTH_SECRET, ENCRYPTION_KEY, CRON_SECRET, APP_URL, email, OPERATOR_NAME, CONTACT_EMAIL) and a private Blob store for files.",
            "Deploy. Tables are created automatically; the daily job (reminders, recurring invoices) runs every morning.",
            "Open /signup to create your owner account, fill in Settings › Workspace, turn on two-step login, invite your team.",
          ],
        },
        { h: "Email (needed for password reset, invitations and sending invoices)" },
        {
          steps: [
            "Simplest: a Gmail account. Turn on 2-Step Verification in your Google Account, then create an “App password” named Apex CRM (16 letters).",
            "Set SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=your Gmail address, SMTP_PASS=the 16 letters, MAIL_FROM=\"Your Company <your Gmail address>\".",
            "To send from your own domain or more than ~500 emails a day, use Brevo or Resend and paste their SMTP settings instead.",
          ],
        },
        {
          warn: "On your own computer, while SMTP_HOST is empty, no real email leaves: every email appears at http://localhost:3000/api/dev/mail.",
        },
        {
          tip: "Keep the settings private: they hold your database password and secret keys. They are never sent to GitHub.",
        },
      ],
    },
  },
};

const AR: Patch = {
  insert: [
    {
      after: "account",
      section: {
        id: "security",
        title: "حسابك وأمانه",
        blocks: [
          { shot: "security", caption: "الإعدادات › الأمان: الدخول بخطوتين، والأجهزة المتصلة، وسجل الأمان." },
          { h: "الاسم والبريد وكلمة المرور (الإعدادات › الحساب)" },
          {
            bullets: [
              "غيّر اسمك في أي وقت.",
              "تغيير البريد: اكتب العنوان الجديد وكلمة المرور الحالية. نرسل رابطًا إلى العنوان الجديد، ولا يتغيّر بريدك إلا عند الضغط عليه، ويُبلَّغ العنوان القديم.",
              "تغيير كلمة المرور: اكتب الحالية ثم الجديدة مرتين. يُسجَّل الخروج من كل الأجهزة الأخرى وتصلك رسالة تنبيه.",
              "سجّلت عبر Google؟ استخدم «أرسل لي رابطًا لتعيين كلمة مرور» لتتمكّن من الدخول ببريدك أيضًا.",
            ],
          },
          { h: "الدخول بخطوتين (الإعدادات › الأمان)" },
          {
            steps: [
              "ثبّت تطبيق مصادقة على هاتفك (Google Authenticator أو Microsoft Authenticator أو 2FAS…).",
              "اضغط «تفعيل الدخول بخطوتين»، وامسح رمز QR بالتطبيق، واكتب الرمز المكوّن من 6 أرقام.",
              "احفظ رموز الاسترداد العشرة (نزّلها وضع علامة «حفظتُ رموز الاسترداد»). يعمل كل رمز مرة واحدة إذا فقدت هاتفك.",
              "من الآن يطلب تسجيل الدخول الرمز بعد كلمة المرور.",
            ],
          },
          {
            bullets: [
              "«تسجيل الخروج من الأجهزة الأخرى» يُخرج كل المتصفحات والهواتف الأخرى (هاتف مفقود، حاسوب مشترك).",
              "«نشاط الأمان» يعرض آخر عمليات الدخول والتغييرات المهمة مع عنوان IP والجهاز.",
              "الإعدادات › البيانات › «تنزيل بياناتي» يعطيك كل ما نحفظه عنك، ويمكن للمالكين والمسؤولين تنزيل مساحة العمل كاملة.",
              "الإعدادات › الحساب › «حذف حسابي» يحذف حسابك نهائيًا (نزّل بياناتك أولًا).",
            ],
          },
        ],
      },
    },
    {
      after: "security",
      section: {
        id: "team",
        title: "العمل ضمن فريق",
        blocks: [
          { shot: "team", caption: "الإعدادات › الفريق: الأعضاء والأدوار والدعوات." },
          {
            steps: [
              "الإعدادات › الفريق: اكتب بريد زميلك، واختر دوره، واضغط «إرسال الدعوة».",
              "يتلقّى رسالة ويضغط «قبول الدعوة». إن لم يكن لديه حساب، يختار اسمه وكلمة مرور، والرابط يثبت ملكيته للبريد.",
              "يرى الآن نفس العملاء والفواتير والمهام التي تراها.",
            ],
          },
          {
            bullets: [
              "المالك: كل الصلاحيات، بما فيها تعيين مالكين آخرين. تبقى لكل مساحة عمل مالك واحد على الأقل.",
              "المسؤول: يدير الفريق وبيانات الشركة وتصدير البيانات، ويمكنه إلغاء الفواتير.",
              "العضو: يعمل على العملاء والعملاء المحتملين والمشاريع والمهام والمستندات والمدفوعات.",
              "غيّر الدور من القائمة، أو أزل عضوًا بالزر ×. يمكن إعادة إرسال الدعوات أو إلغاؤها.",
              "من ينتمي إلى عدة مساحات عمل يتنقّل بينها من اسم مساحة العمل أعلى الشريط الجانبي.",
            ],
          },
        ],
      },
    },
    {
      after: "payments",
      section: {
        id: "expenses",
        title: "المصروفات والأرباح",
        blocks: [
          { shot: "expenses", caption: "المصروفات حسب الفترة والفئة." },
          {
            steps: [
              "المالية › المصروفات › «مصروف جديد»: الغرض، والمبلغ، والتاريخ، والفئة، والجهة المدفوع لها.",
              "اربطه بعميل أو مشروع لترى ما يكلّفه كلٌّ منهما فعلًا.",
              "صفِّ حسب الشهر أو الشهر الماضي أو السنة أو الفئة؛ يظهر المجموع فوق القائمة.",
            ],
          },
          { p: "التقارير › «المصروفات والأرباح» يعرض ما حصّلته وما أنفقته والربح في الفترة." },
        ],
      },
    },
  ],
  append: {
    screen: [
      {
        bullets: [
          "يعرض الجرس ما يخصّك: دفعة مستلمة، مهمة أُسندت إليك، زميل انضمّ، فاتورة أصبحت متأخرة. اضغط عليه لفتحه، و«تعليم الكل كمقروء» يزيل النقطة.",
          "على الهاتف: افتح الموقع ثم قائمة المتصفح › «إضافة إلى الشاشة الرئيسية» (أو «تثبيت التطبيق»). يفتح Apex CRM عندها بملء الشاشة كتطبيق.",
        ],
      },
    ],
    clients: [
      { h: "نظرة سريعة، الأعمدة، الملفات، الاستيراد" },
      {
        bullets: [
          "أيقونة العين بجانب الاسم تفتح نظرة سريعة (جهة الاتصال، المبلغ المستحق، آخر النشاطات) دون مغادرة القائمة. Esc يغلقها.",
          "«الأعمدة» يختار الأعمدة الظاهرة في القائمة، ويُحفظ اختيارك.",
          "تبويب «الملفات» لدى العميل يحفظ العقود والملفات والصور (حتى 4 ميغابايت للملف: PDF وصور وOffice ونص وCSV وZIP). لا يمكن تنزيلها إلا من مساحة عملك.",
        ],
      },
      { shot: "import", caption: "استيراد قائمة عملاء من جدول بيانات." },
      {
        steps: [
          "العملاء › «استيراد» › اختر ملف CSV أو Excel (‎.xlsx‎) فيه عميل في كل سطر وعناوين الأعمدة في السطر الأول (يتوفّر ملف مثال).",
          "تحقّق من الأعمدة التي طابقناها (الاسم، البريد، الهاتف، المدينة، الوسوم، جهة الاتصال…) ومن المعاينة.",
          "اضغط «استيراد». تُتجاهل الأسطر بلا اسم أو ذات بريد غير صالح أو الموجودة مسبقًا، وتُعرض في قائمة.",
        ],
      },
    ],
    reports: [{ bullets: ["المصروفات والأرباح: المحصّل ناقص المصروفات، مع إنفاقك حسب الفئة."] }],
  },
  replace: {
    documents: {
      blocks: [
        { shot: "editor", caption: "محرّر الفاتورة: الأسطر من جهة، والمعاينة المباشرة من الجهة الأخرى." },
        {
          steps: [
            "اضغط «فاتورة جديدة» (أو اضغط I)، أو «عرض سعر جديد» في عروض الأسعار.",
            "اختر العميل. أضف الأسطر: الوصف، الكمية، سعر الوحدة، الخصم والضريبة. اضغط Enter لإضافة السطر التالي. تتحدّث المجاميع أثناء الكتابة.",
            "تُظهر المعاينة المستند الحقيقي بلغة مستندات العميل (الفرنسية أو الإنجليزية أو العربية).",
            "احفظ المسودة ثم اضغط «إرسال»: راجع الرسالة واضغط إرسال. يتلقّاها العميل مع ملف PDF مرفق وباسم شركتك، وتصلك الردود.",
            "«تنزيل PDF» ينزّل ملف PDF نفسه.",
          ],
        },
        { shot: "invoice", caption: "فاتورة بعد إرسالها، مع ملخص المدفوعات وجدول التذكيرات." },
        { h: "الفواتير المتكرّرة" },
        {
          steps: [
            "افتح فاتورة تصدرها بانتظام واضغط «تكرار».",
            "اختر كل شهر أو كل 3 أشهر أو كل سنة، وتاريخ أول فاتورة جديدة، و(اختياريًا) متى تتوقّف.",
            "ضع علامة على «إرسالها تلقائيًا إلى العميل بالبريد» لإرسال كل فاتورة جديدة، أو اتركها لتحصل على مسودة تراجعها.",
            "الفواتير › «الفواتير المتكرّرة» تعرض كل التكرارات مع الإيقاف المؤقت والاستئناف والحذف.",
          ],
        },
        {
          bullets: [
            "الترقيم تلقائي: INV-2026-0001 للفواتير و Q-2026-001 لعروض الأسعار.",
            "يمكن تسجيل عرض السعر كمقبول أو مرفوض، وتحويله إلى فاتورة بضغطة واحدة.",
            "تصبح الفاتورة متأخرة تلقائيًا بعد تاريخ الاستحقاق. «إرسال تذكير» يرسل للعميل تذكيرًا بالبريد مع ملف PDF.",
            "ألغِ الفاتورة (للمالكين والمسؤولين) بدل حذفها؛ يبقى رقمها مستخدمًا فلا تكون في ترقيمك فجوات.",
          ],
        },
      ],
    },
    payments: {
      blocks: [
        { shot: "payments", caption: "كل المدفوعات مع أدوات التصفية." },
        {
          steps: [
            "افتح فاتورة واضغط «تسجيل دفعة»، أو استخدم «تسجيل دفعة» في المدفوعات.",
            "اكتب المبلغ والتاريخ وطريقة الدفع (تحويل، نقدًا، شيك، بطاقة…). المبلغ الجزئي يترك الباقي مستحقًا، وتظهر الفاتورة «مدفوعة جزئيًا».",
            "عند سداد كامل المبلغ تصبح الفاتورة «مدفوعة» تلقائيًا.",
          ],
        },
        {
          p: "تُرسل التذكيرات وحدها: كل صباح، تتلقّى الفواتير غير المدفوعة رسالة لطيفة مع ملف PDF في تاريخ الاستحقاق ثم بعد 3 و7 و14 يومًا. تُظهر كل فاتورة جدولها (أُرسل، مستحق، تم تخطّيه، قادم). أوقف التذكيرات لعميل يفضّل المكالمة (ملف العميل › تذكيرات الدفع التلقائية).",
        },
      ],
    },
    settings: {
      blocks: [
        { shot: "settings", caption: "الإعدادات › مساحة العمل: البيانات المطبوعة على مستنداتك." },
        {
          bullets: [
            "عام: اللغة، والمظهر (فاتح، داكن، أو حسب الحاسوب)، والشريط الجانبي.",
            "الحساب: الاسم والبريد وكلمة المرور وحذف الحساب.",
            "الأمان: الدخول بخطوتين، وتسجيل الخروج من الأجهزة الأخرى، ونشاط الأمان.",
            "مساحة العمل (للمالكين والمسؤولين): اسم الشركة، العنوان، NIF، RC، NIS، AI، IBAN، العملة ولغة المستندات — تُطبع على كل عرض سعر وفاتورة.",
            "الفريق: الأعضاء والأدوار والدعوات. البيانات: تنزيل بياناتك أو مساحة العمل كاملة.",
          ],
        },
        {
          keys: [
            ["Ctrl + K  ·  /", "البحث والانتقال إلى أي مكان"],
            ["G → D / C / L / P / T / I", "اضغط G ثم الحرف للذهاب إلى لوحة التحكم / العملاء / العملاء المحتملين / المشاريع / المهام / الفواتير"],
            ["C · L · P · I · T", "عميل، عميل محتمل، مشروع، فاتورة، مهمة جديدة"],
            ["[", "طيّ الشريط الجانبي أو توسيعه"],
            ["Esc", "إغلاق نافذة أو قائمة"],
          ],
        },
      ],
    },
    admin: {
      title: "للمالك: نشر Apex CRM على الإنترنت",
      blocks: [
        { p: "يشرح الملف DEPLOY.md في المشروع كل خطوة بالتفصيل. باختصار:" },
        {
          steps: [
            "ارفع الشيفرة إلى مستودعك الخاص على GitHub.",
            "أنشئ مشروع Neon جديدًا وفارغًا باسم «apex-crm-production» — منفصلًا عن قاعدة البيانات التي تستخدمها للتجربة.",
            "استورد المستودع في Vercel، وأضف الإعدادات (DATABASE_URL لقاعدة الإنتاج، AUTH_SECRET، ENCRYPTION_KEY، CRON_SECRET، APP_URL، البريد، OPERATOR_NAME، CONTACT_EMAIL) ومخزن Blob خاصًا للملفات.",
            "انشر. تُنشأ الجداول تلقائيًا، وتعمل المهمة اليومية (التذكيرات، الفواتير المتكرّرة) كل صباح.",
            "افتح ‎/signup‎ لإنشاء حساب المالك، واملأ الإعدادات › مساحة العمل، وفعّل الدخول بخطوتين، وادعُ فريقك.",
          ],
        },
        { h: "البريد الإلكتروني (ضروري لإعادة تعيين كلمة المرور والدعوات وإرسال الفواتير)" },
        {
          steps: [
            "الأسهل: حساب Gmail. فعّل التحقّق بخطوتين في حسابك على Google، ثم أنشئ «كلمة مرور تطبيق» باسم Apex CRM (ستة عشر حرفًا).",
            "اضبط SMTP_HOST=smtp.gmail.com و SMTP_PORT=465 و SMTP_USER=عنوان Gmail و SMTP_PASS=الأحرف الستة عشر و MAIL_FROM=\"اسم شركتك <عنوان Gmail>\".",
            "للإرسال من نطاقك الخاص أو لأكثر من نحو 500 رسالة يوميًا، استخدم Brevo أو Resend والصق إعدادات SMTP الخاصة بهما.",
          ],
        },
        { warn: "على حاسوبك، ما دام SMTP_HOST فارغًا، لا تخرج أي رسالة حقيقية: تظهر كل رسالة في http://localhost:3000/api/dev/mail." },
        { tip: "احتفظ بالإعدادات سرّية: فيها كلمة مرور قاعدة البيانات والمفاتيح السرية. لا تُرفع أبدًا إلى GitHub." },
      ],
    },
  },
};

export function withUpdates(guide: Guide): Guide {
  const patch = guide.lang === "ar" ? AR : EN;
  let sections = guide.sections.map((s) => {
    const r = patch.replace[s.id];
    const extra = patch.append[s.id] ?? [];
    return { ...s, title: r?.title ?? s.title, blocks: [...(r ? r.blocks : s.blocks), ...extra] };
  });
  for (const { after, section } of patch.insert) {
    const i = sections.findIndex((s) => s.id === after);
    sections = [...sections.slice(0, i + 1), section, ...sections.slice(i + 1)];
  }
  return { ...guide, sections };
}

export type { Lang };
