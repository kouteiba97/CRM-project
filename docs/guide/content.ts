/**
 * Apex CRM user guide: the words of the PDF and the captions of the video tour, in English and
 * Arabic. `shot` names a screenshot that capture.spec.ts takes in the same language.
 */
export type Block =
  | { h: string }
  | { p: string }
  | { steps: string[] }
  | { bullets: string[] }
  | { tip: string }
  | { warn: string }
  | { shot: string; caption: string }
  | { keys: [string, string][] };

export type Section = { id: string; title: string; blocks: Block[] };
export type Guide = {
  lang: "en" | "ar";
  dir: "ltr" | "rtl";
  title: string;
  subtitle: string;
  tocTitle: string;
  sections: Section[];
};

export const EN: Guide = {
  lang: "en",
  dir: "ltr",
  title: "Apex CRM — User guide",
  subtitle: "How to sign in, find your way around, and run your clients, sales, projects and invoices.",
  tocTitle: "Contents",
  sections: [
    {
      id: "start",
      title: "1. What Apex CRM is",
      blocks: [
        {
          p: "Apex CRM is a website you open in any browser — on a computer, a tablet or a phone. There is nothing to install. It keeps everything about your business in one place: your clients, the deals you are chasing (leads), the projects you deliver, your tasks, quotations, invoices and the payments you receive.",
        },
        {
          p: "It works in English, French and Arabic. Arabic screens read from right to left. You can switch language at any time from the top bar.",
        },
        {
          bullets: [
            "Clients — the companies and people you work with.",
            "Leads — possible deals, from first contact until you win or lose them.",
            "Projects and Tasks — the work you deliver and who does what by when.",
            "Quotations and Invoices — documents you send; payments you record against them.",
            "Follow-ups — calls, emails and meetings you must not forget.",
            "Reports — how much you invoiced and collected, who pays late, why deals are lost.",
          ],
        },
      ],
    },
    {
      id: "account",
      title: "2. Your account",
      blocks: [
        { p: "Open the address of your Apex CRM (for example http://localhost:3000 on your own computer). If you are not signed in, you see the sign-in page." },
        { shot: "login", caption: "The sign-in page." },
        { h: "Create an account" },
        {
          steps: [
            "On the sign-in page, click “Create an account”.",
            "Type your name, your email and a password of at least 8 characters. The company name is optional.",
            "Click “Create account”. You are signed in straight away, in a new, empty workspace that belongs to you.",
            "We send you an email “Confirm your email”. Open it and click the button. Until you do, a yellow bar at the top of the app reminds you (it has a “Resend link” button).",
          ],
        },
        { shot: "signup", caption: "Creating an account." },
        { tip: "Confirming your email matters: it is how you get back in if you forget your password." },
        { h: "Sign in with Google" },
        {
          p: "When Google sign-in is switched on (see chapter 13), the sign-in and sign-up pages show “Continue with Google”. Click it, choose your Google account, and you are in. If you already have an Apex CRM account with the same email, Google signs you into that same account.",
        },
        { h: "Forgot your password?" },
        {
          steps: [
            "On the sign-in page, click “Forgot password?”.",
            "Type the email you sign in with and click “Send reset link”.",
            "Open the email “Reset your Apex CRM password” and click “Choose a new password”. The link works once and only for 60 minutes.",
            "Type your new password twice and click “Save password and sign in”. You are signed in, and every other computer or phone that was signed in to your account is signed out.",
          ],
        },
        { shot: "forgot", caption: "Asking for a reset link." },
        {
          tip: "For your safety the page always says “If an account exists for this email, we sent a link” — it never tells strangers who has an account. No email? Check the spam folder, wait a few minutes, then use “Send the link again”. You can ask for up to 3 links every 15 minutes; only the newest link works.",
        },
        { p: "Sign out: click your initials in the top-right corner, then “Log out”." },
        {
          warn: "After 5 wrong passwords in a row, signing in to that email is paused for 15 minutes. Use “Forgot password?” instead of guessing.",
        },
      ],
    },
    {
      id: "screen",
      title: "3. Finding your way around",
      blocks: [
        { shot: "dashboard", caption: "The dashboard, with the sidebar on the side and the top bar." },
        {
          bullets: [
            "Sidebar: every module, grouped into Sales, Delivery and Finance. Small numbers show what needs you (tasks due, overdue invoices). Press [ to fold it into a thin rail and get more room.",
            "Search (top bar, or Ctrl+K): type any client, project or invoice number and press Enter to open it.",
            "“+ New”: create a client, lead, project, invoice or task from anywhere.",
            "Bell: notifications. Moon/Sun: dark or light theme. EN / FR / ع: language.",
            "Your initials: settings and Log out.",
            "On a phone, the sidebar hides behind the ☰ button at the top-left (top-right in Arabic).",
          ],
        },
        { shot: "palette", caption: "Search with Ctrl+K." },
      ],
    },
    {
      id: "dashboard",
      title: "4. Dashboard — your day at a glance",
      blocks: [
        {
          bullets: [
            "The four numbers at the top: revenue this month, money outstanding, overdue invoices, and the value of open deals. Click one to see the list behind it. Switch the period with This month / This quarter / This year.",
            "Today: your tasks due today — tick the box to mark one done (Undo appears for a few seconds).",
            "Follow-ups: who you promised to call or email.",
            "Overdue invoices: with a “Send reminder” button for each.",
            "Charts: invoiced vs collected, and your pipeline by stage. “View as table” shows the same numbers as a table.",
          ],
        },
      ],
    },
    {
      id: "clients",
      title: "5. Clients",
      blocks: [
        { shot: "clients", caption: "The client list." },
        {
          steps: [
            "Click “New client” (or press C anywhere). Fill in the name and the details you have, then save.",
            "Use the search box and the filter chips (Status, Tag, Owner, Has overdue) to narrow the list. Click a column title to sort.",
            "Tick clients to export them to a CSV file or archive them (Undo is offered).",
            "Click a client to open its profile.",
          ],
        },
        { shot: "client", caption: "A client profile." },
        {
          p: "The profile shows contacts and details on the side, key numbers on top (billed, paid, outstanding), and tabs for projects, invoices, quotations and the activity timeline. In Activity you can log a call, an email, a meeting or a note — it stays in the client's history. Plan the next follow-up from the same place.",
        },
      ],
    },
    {
      id: "leads",
      title: "6. Leads — your sales pipeline",
      blocks: [
        { shot: "leads", caption: "The lead board: one column per stage." },
        {
          steps: [
            "Click “New lead” (or press L). Give it a title, the client or prospect, an estimated value and a priority.",
            "Move a lead to the next stage by dragging its card to another column. With the keyboard: focus the card and use the “Move to” menu.",
            "When you win a deal, mark it as won: type the final value, then choose “Convert to project” or create a quotation straight away.",
            "When you lose one, mark it as lost and pick the reason. Reports later show why deals are lost.",
            "Prefer a list? Switch the view from Board to Table.",
          ],
        },
      ],
    },
    {
      id: "projects",
      title: "7. Projects and tasks",
      blocks: [
        { shot: "projects", caption: "The project list with progress and budget." },
        {
          p: "Each project has a code (PRJ-001…), a client, a deadline, a budget and milestones. The list shows progress, the next milestone and how much is billed. Open a project to change its status, add milestones and tasks, and bill milestones with “Create invoice”.",
        },
        { shot: "tasks", caption: "Tasks grouped by due date." },
        {
          steps: [
            "Tasks are grouped by due date: Overdue, Today, This week, Later, No date. Change “Group by” to see them by project or status.",
            "Tick the circle to complete a task. Type in the “Add a task…” line of any group and press Enter to add one quickly.",
            "Select several tasks to move their due date or mark them done together.",
            "Click a task to edit it or delete it (Undo is offered).",
          ],
        },
      ],
    },
    {
      id: "documents",
      title: "8. Quotations and invoices",
      blocks: [
        { shot: "editor", caption: "The invoice editor: lines on the left, live preview on the right." },
        {
          steps: [
            "Click “New invoice” (or press I), or “New quotation” in Quotations.",
            "Choose the client. Add lines: description, quantity, unit price, discount and tax. Press Enter to add the next line. Totals update as you type.",
            "The preview shows the real document, in the client's document language (French, English or Arabic).",
            "Save the draft, then click “Send”. Your email program opens with the message ready; the invoice is marked as sent.",
            "“Download PDF” prints the document; choose “Save as PDF” in the print window.",
          ],
        },
        { shot: "invoice", caption: "An invoice after it was sent, with its payment summary." },
        {
          bullets: [
            "Numbers are automatic: INV-2026-0001 for invoices, Q-2026-001 for quotations.",
            "A quotation can be marked Accepted or Declined, and converted to an invoice in one click.",
            "An invoice becomes Overdue by itself after its due date. “Send reminder” logs a reminder.",
            "Void an invoice instead of deleting it; the number stays used, so your numbering has no gaps.",
          ],
        },
      ],
    },
    {
      id: "payments",
      title: "9. Payments and reminders",
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
          p: "Every unpaid invoice shows its reminder schedule: on the due date, then 3, 7 and 14 days later. You can switch reminders off for a client who prefers a phone call.",
        },
      ],
    },
    {
      id: "followups",
      title: "10. Follow-ups",
      blocks: [
        { shot: "followups", caption: "Follow-ups grouped by due date." },
        {
          p: "A follow-up is a promise: “call Karim on Thursday”. Create one with “New follow-up” or from a client or lead. When it is done, record the outcome and plan the next one in the same step. Late follow-ups stay at the top until you deal with them.",
        },
      ],
    },
    {
      id: "reports",
      title: "11. Reports",
      blocks: [
        { shot: "reports", caption: "Reports." },
        {
          bullets: [
            "Collected, invoiced, win rate and average days to get paid, for the period you choose.",
            "Month by month chart of invoiced vs collected.",
            "Receivables aging: how much is 1–30, 31–60, 61–90 or 90+ days late. Click a bar to open those invoices.",
            "Top clients, open pipeline by stage, and the reasons deals were lost.",
          ],
        },
      ],
    },
    {
      id: "settings",
      title: "12. Settings",
      blocks: [
        { shot: "settings", caption: "Settings › Workspace: details printed on your documents." },
        {
          bullets: [
            "General: language, theme (light, dark, or follow the computer) and sidebar.",
            "Workspace (owner only): company name, address, NIF, RC, NIS, AI, IBAN, default currency and document language. These appear on every quotation and invoice.",
            "Profile: your name. Your email is shown but cannot be changed here.",
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
    {
      id: "admin",
      title: "13. For the owner: switching on email and Google",
      blocks: [
        {
          p: "These settings live in the file .env.local in the project folder (on the server, in its environment variables). After changing them, restart the app.",
        },
        { h: "Email (needed for password reset and email confirmation)" },
        {
          steps: [
            "Simplest: a Gmail account. In your Google Account, turn on 2-Step Verification, then open “App passwords” and create one named “Apex CRM”. Google shows 16 letters.",
            "In .env.local set: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=your Gmail address, SMTP_PASS=the 16 letters (no spaces), MAIL_FROM=\"Apex CRM <your Gmail address>\".",
            "When the site is online, also set APP_URL to its public address (for example https://crm.yourcompany.com) so the links in emails point to it.",
            "Restart, then test: sign out, use “Forgot password?” with your own email.",
          ],
        },
        {
          tip: "Gmail allows about 500 emails a day — plenty for password resets. For more, or to send from your own domain, use a service such as Brevo or Resend: they give you SMTP settings to paste in the same four lines.",
        },
        {
          warn: "While SMTP_HOST is empty (on your own computer), no real email leaves: every email the app would send appears at http://localhost:3000/api/dev/mail. On a live server without email settings, “Forgot password?” shows an error instead of pretending.",
        },
        { h: "Google sign-in (optional)" },
        {
          steps: [
            "Open console.cloud.google.com, create a project, then APIs & Services › OAuth consent screen: choose External, fill in the app name and your email.",
            "APIs & Services › Credentials › Create credentials › OAuth client ID › Web application.",
            "Under “Authorised redirect URIs” add http://localhost:3000/api/auth/callback/google — and later the same with your public address.",
            "Copy the Client ID and Client secret into .env.local as AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, then restart. The “Continue with Google” button appears.",
          ],
        },
        {
          tip: "Keep .env.local private: it holds your database password, AUTH_SECRET and email password. It is never sent to GitHub.",
        },
      ],
    },
  ],
};

export const AR: Guide = {
  lang: "ar",
  dir: "rtl",
  title: "Apex CRM — دليل الاستخدام",
  subtitle: "كيف تسجّل الدخول، وتتنقّل في التطبيق، وتدير عملاءك ومبيعاتك ومشاريعك وفواتيرك.",
  tocTitle: "المحتويات",
  sections: [
    {
      id: "start",
      title: "1. ما هو Apex CRM",
      blocks: [
        {
          p: "Apex CRM موقع ويب تفتحه من أي متصفح — على الحاسوب أو الجهاز اللوحي أو الهاتف. لا يحتاج إلى أي تثبيت. يجمع كل ما يخص نشاطك في مكان واحد: عملاءك، والصفقات التي تتابعها (العملاء المحتملون)، والمشاريع التي تنفّذها، ومهامك، وعروض الأسعار، والفواتير، والمدفوعات التي تستلمها.",
        },
        {
          p: "يعمل بالعربية والفرنسية والإنجليزية. الشاشات العربية تُقرأ من اليمين إلى اليسار، ويمكنك تغيير اللغة في أي وقت من الشريط العلوي.",
        },
        {
          bullets: [
            "العملاء — الشركات والأشخاص الذين تعمل معهم.",
            "العملاء المحتملون — الصفقات الممكنة، من أول تواصل حتى كسبها أو خسارتها.",
            "المشاريع والمهام — العمل الذي تنجزه، ومن يقوم بماذا ومتى.",
            "عروض الأسعار والفواتير — المستندات التي ترسلها، والمدفوعات التي تسجّلها عليها.",
            "المتابعات — المكالمات والرسائل والاجتماعات التي يجب ألّا تنساها.",
            "التقارير — كم فوترت وكم حصّلت، ومن يتأخّر في الدفع، ولماذا تُخسر الصفقات.",
          ],
        },
      ],
    },
    {
      id: "account",
      title: "2. حسابك",
      blocks: [
        { p: "افتح عنوان Apex CRM الخاص بك (مثلًا http://localhost:3000 على حاسوبك). إذا لم تكن مسجّل الدخول، تظهر لك صفحة تسجيل الدخول." },
        { shot: "login", caption: "صفحة تسجيل الدخول." },
        { h: "إنشاء حساب" },
        {
          steps: [
            "في صفحة تسجيل الدخول، اضغط «أنشئ حسابًا».",
            "اكتب اسمك وبريدك الإلكتروني وكلمة مرور من 8 أحرف على الأقل. اسم الشركة اختياري.",
            "اضغط «إنشاء الحساب». يتم تسجيل دخولك فورًا في مساحة عمل جديدة وفارغة خاصة بك.",
            "نرسل إليك رسالة «تأكيد بريدك الإلكتروني». افتحها واضغط الزر. إلى أن تفعل، يذكّرك شريط أصفر أعلى التطبيق (وفيه زر «إعادة إرسال الرابط»).",
          ],
        },
        { shot: "signup", caption: "إنشاء حساب." },
        { tip: "تأكيد البريد مهم: هو الطريقة التي تستعيد بها حسابك إذا نسيت كلمة المرور." },
        { h: "تسجيل الدخول عبر Google" },
        {
          p: "عند تفعيل الدخول عبر Google (انظر الفصل 13)، تُظهر صفحتا الدخول والتسجيل زر «المتابعة باستخدام Google». اضغطه واختر حسابك في Google وستدخل مباشرة. إذا كان لديك حساب Apex CRM بنفس البريد، فإن Google يُدخلك إلى الحساب نفسه.",
        },
        { h: "نسيت كلمة المرور؟" },
        {
          steps: [
            "في صفحة تسجيل الدخول، اضغط «نسيت كلمة المرور؟».",
            "اكتب البريد الذي تسجّل الدخول به واضغط «إرسال رابط إعادة التعيين».",
            "افتح رسالة «إعادة تعيين كلمة مرور Apex CRM» واضغط «اختيار كلمة مرور جديدة». يعمل الرابط مرة واحدة فقط ولمدة 60 دقيقة.",
            "اكتب كلمة المرور الجديدة مرتين واضغط «حفظ كلمة المرور وتسجيل الدخول». يتم تسجيل دخولك، ويُسجَّل الخروج من كل حاسوب أو هاتف آخر كان متصلًا بحسابك.",
          ],
        },
        { shot: "forgot", caption: "طلب رابط إعادة التعيين." },
        {
          tip: "حفاظًا على أمانك، تقول الصفحة دائمًا «إذا كان هناك حساب مرتبط بهذا البريد فقد أرسلنا رابطًا» — فلا تكشف للغرباء من لديه حساب. لم تصلك الرسالة؟ تحقّق من مجلد الرسائل غير المرغوب فيها، وانتظر بضع دقائق، ثم استخدم «إعادة إرسال الرابط». يمكنك طلب 3 روابط كل 15 دقيقة، وأحدث رابط فقط هو الذي يعمل.",
        },
        { p: "تسجيل الخروج: اضغط على الأحرف الأولى من اسمك في أعلى الشاشة، ثم «تسجيل الخروج»." },
        {
          warn: "بعد 5 كلمات مرور خاطئة متتالية، يتوقّف الدخول لذلك البريد مدة 15 دقيقة. استخدم «نسيت كلمة المرور؟» بدل التخمين.",
        },
      ],
    },
    {
      id: "screen",
      title: "3. التنقّل في التطبيق",
      blocks: [
        { shot: "dashboard", caption: "لوحة التحكم، مع الشريط الجانبي والشريط العلوي." },
        {
          bullets: [
            "الشريط الجانبي: كل الوحدات مجمّعة في المبيعات والتنفيذ والمالية. الأرقام الصغيرة تُظهر ما يحتاج انتباهك (مهام مستحقة، فواتير متأخرة). اضغط [ لطيّه وكسب مساحة أكبر.",
            "البحث (الشريط العلوي أو Ctrl+K): اكتب اسم عميل أو مشروع أو رقم فاتورة واضغط Enter لفتحه.",
            "«+ جديد»: أنشئ عميلًا أو عميلًا محتملًا أو مشروعًا أو فاتورة أو مهمة من أي مكان.",
            "الجرس: الإشعارات. القمر/الشمس: الوضع الداكن أو الفاتح. EN / FR / ع: اللغة.",
            "الأحرف الأولى من اسمك: الإعدادات وتسجيل الخروج.",
            "على الهاتف، يختفي الشريط الجانبي خلف زر ☰ في الأعلى.",
          ],
        },
        { shot: "palette", caption: "البحث باستخدام Ctrl+K." },
      ],
    },
    {
      id: "dashboard",
      title: "4. لوحة التحكم — يومك في لمحة",
      blocks: [
        {
          bullets: [
            "الأرقام الأربعة في الأعلى: إيرادات هذا الشهر، والمبالغ المستحقة، والفواتير المتأخرة، وقيمة الصفقات المفتوحة. اضغط أيًّا منها لرؤية القائمة خلفه. غيّر الفترة: هذا الشهر / هذا الربع / هذه السنة.",
            "اليوم: مهامك المستحقة اليوم — ضع علامة لإنجاز مهمة (يظهر زر تراجع لبضع ثوانٍ).",
            "المتابعات: من وعدت بالاتصال به أو مراسلته.",
            "الفواتير المتأخرة: مع زر «إرسال تذكير» لكل فاتورة.",
            "الرسوم البيانية: المفوتر مقابل المحصّل، والصفقات حسب المرحلة. «عرض كجدول» يعرض الأرقام نفسها في جدول.",
          ],
        },
      ],
    },
    {
      id: "clients",
      title: "5. العملاء",
      blocks: [
        { shot: "clients", caption: "قائمة العملاء." },
        {
          steps: [
            "اضغط «عميل جديد» (أو اضغط C من أي مكان). املأ الاسم والمعلومات المتوفرة ثم احفظ.",
            "استخدم مربع البحث وأزرار التصفية (الحالة، الوسم، المسؤول، لديه متأخرات) لتضييق القائمة. اضغط عنوان عمود للترتيب.",
            "حدّد عملاء لتصديرهم إلى ملف CSV أو أرشفتهم (مع إمكانية التراجع).",
            "اضغط على عميل لفتح ملفه.",
          ],
        },
        { shot: "client", caption: "ملف عميل." },
        {
          p: "يعرض الملف جهات الاتصال والتفاصيل على الجانب، والأرقام الأساسية في الأعلى (المفوتر، المدفوع، المستحق)، وتبويبات للمشاريع والفواتير وعروض الأسعار وسجل النشاط. في النشاط يمكنك تسجيل مكالمة أو بريد أو اجتماع أو ملاحظة — يبقى ذلك في تاريخ العميل. وخطّط للمتابعة التالية من المكان نفسه.",
        },
      ],
    },
    {
      id: "leads",
      title: "6. العملاء المحتملون — مسار المبيعات",
      blocks: [
        { shot: "leads", caption: "لوحة العملاء المحتملين: عمود لكل مرحلة." },
        {
          steps: [
            "اضغط «عميل محتمل جديد» (أو اضغط L). أعطه عنوانًا والعميل أو الجهة المستهدفة وقيمة تقديرية وأولوية.",
            "انقل العميل المحتمل إلى المرحلة التالية بسحب بطاقته إلى عمود آخر. بلوحة المفاتيح: حدّد البطاقة واستخدم قائمة «نقل إلى».",
            "عندما تكسب صفقة، اضغط «تسجيل كمكسوب»: اكتب القيمة النهائية ثم اختر «تحويل إلى مشروع» أو أنشئ عرض سعر مباشرة.",
            "عندما تخسر صفقة، اضغط «تسجيل كخاسر» واختر السبب. ستُظهر التقارير لاحقًا لماذا تُخسر الصفقات.",
            "تفضّل القائمة؟ غيّر العرض من «لوحة» إلى «جدول».",
          ],
        },
      ],
    },
    {
      id: "projects",
      title: "7. المشاريع والمهام",
      blocks: [
        { shot: "projects", caption: "قائمة المشاريع مع التقدّم والميزانية." },
        {
          p: "لكل مشروع رمز (PRJ-001…)، وعميل، وموعد نهائي، وميزانية، ومراحل. تُظهر القائمة نسبة التقدّم والمرحلة التالية والمبلغ المفوتر. افتح مشروعًا لتغيير حالته، وإضافة مراحل ومهام، وفوترة المراحل عبر «إنشاء فاتورة».",
        },
        { shot: "tasks", caption: "المهام مجمّعة حسب تاريخ الاستحقاق." },
        {
          steps: [
            "تُجمّع المهام حسب الاستحقاق: متأخرة، اليوم، هذا الأسبوع، لاحقًا، بدون تاريخ. غيّر «التجميع حسب» لعرضها حسب المشروع أو الحالة.",
            "اضغط الدائرة لإنجاز مهمة. اكتب في سطر «إضافة مهمة…» في أي مجموعة واضغط Enter لإضافتها بسرعة.",
            "حدّد عدة مهام لتغيير تاريخ استحقاقها أو إنجازها معًا.",
            "اضغط على مهمة لتعديلها أو حذفها (مع إمكانية التراجع).",
          ],
        },
      ],
    },
    {
      id: "documents",
      title: "8. عروض الأسعار والفواتير",
      blocks: [
        { shot: "editor", caption: "محرّر الفاتورة: الأسطر من جهة، والمعاينة المباشرة من الجهة الأخرى." },
        {
          steps: [
            "اضغط «فاتورة جديدة» (أو اضغط I)، أو «عرض سعر جديد» في عروض الأسعار.",
            "اختر العميل. أضف الأسطر: الوصف، الكمية، سعر الوحدة، الخصم والضريبة. اضغط Enter لإضافة السطر التالي. تتحدّث المجاميع أثناء الكتابة.",
            "تُظهر المعاينة المستند الحقيقي بلغة مستندات العميل (الفرنسية أو الإنجليزية أو العربية).",
            "احفظ المسودة ثم اضغط «إرسال». يفتح برنامج البريد ومعه الرسالة جاهزة، وتُسجَّل الفاتورة كمرسلة.",
            "«تنزيل PDF» يطبع المستند؛ اختر «حفظ بصيغة PDF» في نافذة الطباعة.",
          ],
        },
        { shot: "invoice", caption: "فاتورة بعد إرسالها، مع ملخص المدفوعات." },
        {
          bullets: [
            "الترقيم تلقائي: INV-2026-0001 للفواتير و Q-2026-001 لعروض الأسعار.",
            "يمكن تسجيل عرض السعر كمقبول أو مرفوض، وتحويله إلى فاتورة بضغطة واحدة.",
            "تصبح الفاتورة متأخرة تلقائيًا بعد تاريخ الاستحقاق. «إرسال تذكير» يسجّل تذكيرًا.",
            "ألغِ الفاتورة بدل حذفها؛ يبقى رقمها مستخدمًا فلا تكون في ترقيمك فجوات.",
          ],
        },
      ],
    },
    {
      id: "payments",
      title: "9. المدفوعات والتذكيرات",
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
          p: "تُظهر كل فاتورة غير مدفوعة جدول تذكيراتها: في تاريخ الاستحقاق، ثم بعد 3 و7 و14 يومًا. يمكنك إيقاف التذكيرات لعميل يفضّل المكالمة الهاتفية.",
        },
      ],
    },
    {
      id: "followups",
      title: "10. المتابعات",
      blocks: [
        { shot: "followups", caption: "المتابعات مجمّعة حسب تاريخ الاستحقاق." },
        {
          p: "المتابعة وعدٌ: «الاتصال بكريم يوم الخميس». أنشئها من «متابعة جديدة» أو من ملف عميل أو عميل محتمل. عند إنجازها، سجّل النتيجة وخطّط للمتابعة التالية في الخطوة نفسها. تبقى المتابعات المتأخرة في الأعلى حتى تعالجها.",
        },
      ],
    },
    {
      id: "reports",
      title: "11. التقارير",
      blocks: [
        { shot: "reports", caption: "التقارير." },
        {
          bullets: [
            "المحصّل، والمفوتر، ونسبة الفوز، ومتوسط أيام التحصيل، للفترة التي تختارها.",
            "رسم شهري للمفوتر مقابل المحصّل.",
            "أعمار الذمم: كم يتأخّر 1–30 أو 31–60 أو 61–90 أو أكثر من 90 يومًا. اضغط على شريط لفتح تلك الفواتير.",
            "أهم العملاء، والصفقات المفتوحة حسب المرحلة، وأسباب خسارة الصفقات.",
          ],
        },
      ],
    },
    {
      id: "settings",
      title: "12. الإعدادات",
      blocks: [
        { shot: "settings", caption: "الإعدادات › مساحة العمل: البيانات المطبوعة على مستنداتك." },
        {
          bullets: [
            "عام: اللغة، والمظهر (فاتح، داكن، أو حسب الحاسوب)، والشريط الجانبي.",
            "مساحة العمل (للمالك فقط): اسم الشركة، العنوان، NIF، RC، NIS، AI، IBAN، العملة الافتراضية ولغة المستندات. تظهر على كل عرض سعر وفاتورة.",
            "الملف الشخصي: اسمك. يظهر بريدك الإلكتروني لكن لا يمكن تغييره هنا.",
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
    {
      id: "admin",
      title: "13. للمالك: تفعيل البريد الإلكتروني و Google",
      blocks: [
        {
          p: "توجد هذه الإعدادات في الملف ‎.env.local‎ داخل مجلد المشروع (وعلى الخادم في متغيرات البيئة). بعد تغييرها أعد تشغيل التطبيق.",
        },
        { h: "البريد الإلكتروني (ضروري لإعادة تعيين كلمة المرور وتأكيد البريد)" },
        {
          steps: [
            "الأسهل: حساب Gmail. في حسابك على Google فعّل التحقّق بخطوتين، ثم افتح «كلمات مرور التطبيقات» وأنشئ واحدة باسم Apex CRM. سيعرض Google ستة عشر حرفًا.",
            "في ‎.env.local‎ اكتب: SMTP_HOST=smtp.gmail.com و SMTP_PORT=465 و SMTP_USER=عنوان Gmail و SMTP_PASS=الأحرف الستة عشر (بدون مسافات) و MAIL_FROM=\"Apex CRM <عنوان Gmail>\".",
            "عندما يصبح الموقع على الإنترنت، اضبط أيضًا APP_URL على عنوانه العام (مثل https://crm.yourcompany.com) لكي تشير الروابط في الرسائل إليه.",
            "أعد التشغيل ثم جرّب: سجّل الخروج واستخدم «نسيت كلمة المرور؟» ببريدك.",
          ],
        },
        {
          tip: "يسمح Gmail بنحو 500 رسالة يوميًا — وهذا يكفي لإعادة تعيين كلمات المرور. لعدد أكبر أو للإرسال من نطاقك الخاص، استخدم خدمة مثل Brevo أو Resend: تعطيك إعدادات SMTP تلصقها في الأسطر الأربعة نفسها.",
        },
        {
          warn: "ما دام SMTP_HOST فارغًا (على حاسوبك)، لا تخرج أي رسالة حقيقية: كل رسالة كان التطبيق سيرسلها تظهر في http://localhost:3000/api/dev/mail. وعلى خادم حقيقي بدون إعدادات بريد، تُظهر صفحة «نسيت كلمة المرور؟» رسالة خطأ بدل التظاهر بالإرسال.",
        },
        { h: "تسجيل الدخول عبر Google (اختياري)" },
        {
          steps: [
            "افتح console.cloud.google.com وأنشئ مشروعًا، ثم APIs & Services › OAuth consent screen: اختر External واملأ اسم التطبيق وبريدك.",
            "APIs & Services › Credentials › Create credentials › OAuth client ID › Web application.",
            "في «Authorised redirect URIs» أضف http://localhost:3000/api/auth/callback/google — ولاحقًا العنوان نفسه بعنوان موقعك العام.",
            "انسخ Client ID و Client secret إلى ‎.env.local‎ باسم AUTH_GOOGLE_ID و AUTH_GOOGLE_SECRET، ثم أعد التشغيل. سيظهر زر «المتابعة باستخدام Google».",
          ],
        },
        {
          tip: "احتفظ بالملف ‎.env.local‎ سرّيًا: فيه كلمة مرور قاعدة البيانات و AUTH_SECRET وكلمة مرور البريد. لا يُرفع أبدًا إلى GitHub.",
        },
      ],
    },
  ],
};
