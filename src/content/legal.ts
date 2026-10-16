/**
 * Privacy policy and terms of use, in the three languages. A sound starting point written for
 * this app as built — the operator should have it checked by a lawyer for their country
 * (e.g. Algeria's law 18-07 on personal data, or the GDPR for EU clients) before going live.
 * `{operator}` and `{contact}` come from OPERATOR_NAME / CONTACT_EMAIL.
 */
export type LegalDoc = { title: string; updated: string; sections: { h: string; p: string[] }[] };
type Lang = "en" | "fr" | "ar";

export const PRIVACY: Record<Lang, LegalDoc> = {
  en: {
    title: "Privacy policy",
    updated: "Last updated: {date}",
    sections: [
      { h: "Who we are", p: ["Apex CRM is operated by {operator}. Questions about your data: {contact}."] },
      {
        h: "What we store",
        p: [
          "Your account: name, email address, a password hash (never the password itself), language and display preferences, and — if you turn it on — an encrypted two-step login secret.",
          "Your workspace: the clients, contacts, leads, projects, tasks, quotations, invoices, payments, expenses, files and notes that you and your colleagues enter.",
          "Security records: sign-ins, failed sign-in attempts and important changes, with the IP address and browser type, kept so that you and your workspace owner can spot misuse.",
        ],
      },
      {
        h: "Why we use it",
        p: [
          "Only to provide the service you use: to sign you in, show and keep your workspace data, send the emails you ask for (invoices, reminders, invitations) and account emails (password reset, email confirmation, security notices), and keep the service secure.",
          "We do not sell your data, show advertising or use your data for profiling.",
        ],
      },
      {
        h: "Cookies",
        p: [
          "Only cookies needed for the app to work: your session (keeps you signed in), language, theme, sidebar and list preferences, and the workspace you have open. No advertising or tracking cookies, so there is no cookie banner.",
        ],
      },
      {
        h: "Who processes it for us",
        p: [
          "Hosting: Vercel (application and file storage). Database: Neon (PostgreSQL). Email delivery: the email provider configured by the operator. Sign in with Google: Google, only if you choose it. These providers act on our instructions and protect the data under their own security commitments.",
        ],
      },
      {
        h: "How long we keep it",
        p: [
          "Account and workspace data: as long as your account or workspace exists. Deleting your account deletes the workspaces you are the only member of, with all their data. One-time links and old security counters are cleaned up automatically; read notifications after 90 days.",
        ],
      },
      {
        h: "Your rights",
        p: [
          "You can see and correct your data in the app, download everything stored about you (Settings › Data › Download my data), download a whole workspace (owners and admins), and delete your account (Settings › Account). For anything else, write to {contact}.",
        ],
      },
      {
        h: "Security",
        p: [
          "Encrypted connections (HTTPS), hashed passwords, optional two-step login, limits on sign-in attempts, roles inside each workspace, private file storage, and a security activity log. No system is perfect: tell us at {contact} if you notice anything wrong.",
        ],
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : {date}",
    sections: [
      { h: "Qui sommes-nous", p: ["Apex CRM est exploité par {operator}. Questions sur vos données : {contact}."] },
      {
        h: "Ce que nous conservons",
        p: [
          "Votre compte : nom, adresse e-mail, empreinte du mot de passe (jamais le mot de passe lui-même), langue et préférences d'affichage et — si vous l'activez — un secret de connexion en deux étapes chiffré.",
          "Votre espace : les clients, contacts, prospects, projets, tâches, devis, factures, paiements, dépenses, fichiers et notes saisis par vous et vos collègues.",
          "Journal de sécurité : connexions, tentatives échouées et modifications importantes, avec l'adresse IP et le type de navigateur, pour que vous et le propriétaire de l'espace puissiez repérer un abus.",
        ],
      },
      {
        h: "Pourquoi nous l'utilisons",
        p: [
          "Uniquement pour fournir le service : vous connecter, afficher et conserver les données de votre espace, envoyer les e-mails que vous demandez (factures, relances, invitations) et les e-mails de compte (réinitialisation du mot de passe, confirmation d'e-mail, alertes de sécurité), et sécuriser le service.",
          "Nous ne vendons pas vos données, n'affichons pas de publicité et ne faisons pas de profilage.",
        ],
      },
      {
        h: "Cookies",
        p: [
          "Uniquement les cookies nécessaires au fonctionnement : votre session (pour rester connecté), la langue, le thème, la barre latérale et les préférences de listes, et l'espace ouvert. Aucun cookie publicitaire ni de suivi : il n'y a donc pas de bandeau cookies.",
        ],
      },
      {
        h: "Qui les traite pour nous",
        p: [
          "Hébergement : Vercel (application et stockage des fichiers). Base de données : Neon (PostgreSQL). Envoi des e-mails : le fournisseur configuré par l'exploitant. Connexion avec Google : Google, seulement si vous le choisissez. Ces prestataires agissent sur nos instructions et protègent les données selon leurs propres engagements de sécurité.",
        ],
      },
      {
        h: "Durée de conservation",
        p: [
          "Données du compte et de l'espace : tant que le compte ou l'espace existe. Supprimer votre compte supprime les espaces dont vous êtes le seul membre, avec toutes leurs données. Les liens à usage unique et anciens compteurs de sécurité sont nettoyés automatiquement ; les notifications lues après 90 jours.",
        ],
      },
      {
        h: "Vos droits",
        p: [
          "Vous pouvez consulter et corriger vos données dans l'application, télécharger tout ce qui vous concerne (Paramètres › Données › Télécharger mes données), télécharger un espace entier (propriétaires et administrateurs) et supprimer votre compte (Paramètres › Compte). Pour toute autre demande : {contact}.",
        ],
      },
      {
        h: "Sécurité",
        p: [
          "Connexions chiffrées (HTTPS), mots de passe hachés, connexion en deux étapes facultative, limitation des tentatives de connexion, rôles dans chaque espace, stockage privé des fichiers et journal de sécurité. Aucun système n'est parfait : prévenez-nous à {contact} si vous remarquez une anomalie.",
        ],
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: {date}",
    sections: [
      { h: "من نحن", p: ["يُشغّل Apex CRM من طرف {operator}. للأسئلة حول بياناتك: {contact}."] },
      {
        h: "ما الذي نحفظه",
        p: [
          "حسابك: الاسم، والبريد الإلكتروني، وبصمة كلمة المرور (وليس كلمة المرور نفسها أبدًا)، واللغة وتفضيلات العرض، و— إن فعّلته — سرّ الدخول بخطوتين مشفّرًا.",
          "مساحة عملك: العملاء وجهات الاتصال والعملاء المحتملون والمشاريع والمهام وعروض الأسعار والفواتير والمدفوعات والمصروفات والملفات والملاحظات التي تُدخلها أنت وزملاؤك.",
          "سجل الأمان: عمليات الدخول والمحاولات الفاشلة والتغييرات المهمة، مع عنوان IP ونوع المتصفح، ليتمكّن أنت ومالك مساحة العمل من اكتشاف أي إساءة استخدام.",
        ],
      },
      {
        h: "لماذا نستخدمها",
        p: [
          "فقط لتقديم الخدمة: تسجيل دخولك، وعرض بيانات مساحة عملك وحفظها، وإرسال الرسائل التي تطلبها (الفواتير والتذكيرات والدعوات) ورسائل الحساب (إعادة تعيين كلمة المرور، وتأكيد البريد، وتنبيهات الأمان)، وتأمين الخدمة.",
          "لا نبيع بياناتك، ولا نعرض إعلانات، ولا نقوم بأي تنميط.",
        ],
      },
      {
        h: "ملفات تعريف الارتباط (الكوكيز)",
        p: [
          "نستخدم فقط ما يلزم لعمل التطبيق: جلستك (لتبقى متصلًا)، واللغة، والمظهر، والشريط الجانبي، وتفضيلات القوائم، ومساحة العمل المفتوحة. لا توجد كوكيز إعلانية أو للتتبع، لذلك لا يوجد شريط موافقة على الكوكيز.",
        ],
      },
      {
        h: "من يعالجها لصالحنا",
        p: [
          "الاستضافة: Vercel (التطبيق وتخزين الملفات). قاعدة البيانات: Neon (PostgreSQL). إرسال البريد: مزوّد البريد الذي يضبطه المشغّل. الدخول عبر Google: شركة Google، فقط إن اخترته. يعمل هؤلاء المزوّدون وفق تعليماتنا ويحمون البيانات وفق التزاماتهم الأمنية.",
        ],
      },
      {
        h: "مدة الاحتفاظ",
        p: [
          "بيانات الحساب ومساحة العمل: ما دام الحساب أو المساحة موجودين. حذف حسابك يحذف مساحات العمل التي أنت العضو الوحيد فيها مع كل بياناتها. تُنظَّف الروابط ذات الاستخدام الواحد وعدّادات الأمان القديمة تلقائيًا، والإشعارات المقروءة بعد 90 يومًا.",
        ],
      },
      {
        h: "حقوقك",
        p: [
          "يمكنك الاطلاع على بياناتك وتصحيحها داخل التطبيق، وتنزيل كل ما نحفظه عنك (الإعدادات › البيانات › تنزيل بياناتي)، وتنزيل مساحة عمل كاملة (للمالكين والمسؤولين)، وحذف حسابك (الإعدادات › الحساب). لأي طلب آخر: {contact}.",
        ],
      },
      {
        h: "الأمان",
        p: [
          "اتصالات مشفّرة (HTTPS)، وكلمات مرور مجزّأة، ودخول بخطوتين اختياري، وحدود لمحاولات الدخول، وأدوار داخل كل مساحة عمل، وتخزين خاص للملفات، وسجل لنشاط الأمان. لا يوجد نظام مثالي: أبلغنا على {contact} إن لاحظت أي خلل.",
        ],
      },
    ],
  },
};

export const TERMS: Record<Lang, LegalDoc> = {
  en: {
    title: "Terms of use",
    updated: "Last updated: {date}",
    sections: [
      { h: "The service", p: ["Apex CRM, operated by {operator}, lets businesses manage clients, sales, projects, documents and payments. By creating an account you accept these terms."] },
      { h: "Your account", p: ["Keep your password private and turn on two-step login if you can. You are responsible for what happens under your account; tell us at {contact} if you think someone else used it."] },
      { h: "Your data", p: ["The data you and your workspace enter belongs to you. We only use it to run the service (see the Privacy policy). You can export it at any time from Settings › Data."] },
      { h: "Fair use", p: ["Do not use the service to break the law, send spam, store content you have no right to, or try to access other workspaces or attack the service."] },
      { h: "Documents and taxes", p: ["Quotations and invoices are generated from what you enter. You remain responsible for their content and for meeting the invoicing and tax rules of your country."] },
      { h: "Availability", p: ["We work to keep the service available and your data safe, and keep backups through our database provider, but the service is provided “as is”, without guarantee of uninterrupted operation. Keep your own exports of important data."] },
      { h: "Ending", p: ["You can delete your account at any time. We may suspend an account that breaks these terms. These terms may change; important changes will be announced in the app."] },
      { h: "Contact", p: ["{contact}"] },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    updated: "Dernière mise à jour : {date}",
    sections: [
      { h: "Le service", p: ["Apex CRM, exploité par {operator}, permet aux entreprises de gérer clients, ventes, projets, documents et paiements. En créant un compte, vous acceptez ces conditions."] },
      { h: "Votre compte", p: ["Gardez votre mot de passe secret et activez la connexion en deux étapes si possible. Vous êtes responsable de ce qui se passe sous votre compte ; prévenez-nous à {contact} si vous pensez qu'un tiers l'a utilisé."] },
      { h: "Vos données", p: ["Les données saisies par vous et votre espace vous appartiennent. Nous ne les utilisons que pour faire fonctionner le service (voir la Politique de confidentialité). Vous pouvez les exporter à tout moment depuis Paramètres › Données."] },
      { h: "Usage loyal", p: ["N'utilisez pas le service pour enfreindre la loi, envoyer du spam, stocker des contenus sans en avoir le droit, ni pour accéder à d'autres espaces ou attaquer le service."] },
      { h: "Documents et fiscalité", p: ["Les devis et factures sont générés à partir de vos saisies. Vous restez responsable de leur contenu et du respect des règles de facturation et fiscales de votre pays."] },
      { h: "Disponibilité", p: ["Nous faisons le nécessaire pour que le service reste disponible et vos données protégées, avec des sauvegardes chez notre hébergeur de base de données, mais le service est fourni « en l'état », sans garantie de fonctionnement ininterrompu. Conservez vos propres exports des données importantes."] },
      { h: "Fin", p: ["Vous pouvez supprimer votre compte à tout moment. Nous pouvons suspendre un compte qui ne respecte pas ces conditions. Ces conditions peuvent évoluer ; les changements importants seront annoncés dans l'application."] },
      { h: "Contact", p: ["{contact}"] },
    ],
  },
  ar: {
    title: "شروط الاستخدام",
    updated: "آخر تحديث: {date}",
    sections: [
      { h: "الخدمة", p: ["يتيح Apex CRM، الذي يشغّله {operator}، للمؤسسات إدارة العملاء والمبيعات والمشاريع والمستندات والمدفوعات. بإنشائك حسابًا فإنك توافق على هذه الشروط."] },
      { h: "حسابك", p: ["احفظ كلمة مرورك سرّية وفعّل الدخول بخطوتين إن أمكن. أنت مسؤول عمّا يحدث في حسابك؛ أبلغنا على {contact} إن ظننت أن غيرك استخدمه."] },
      { h: "بياناتك", p: ["البيانات التي تُدخلها أنت ومساحة عملك ملك لك. لا نستخدمها إلا لتشغيل الخدمة (انظر سياسة الخصوصية). يمكنك تصديرها في أي وقت من الإعدادات › البيانات."] },
      { h: "الاستخدام المقبول", p: ["لا تستخدم الخدمة لمخالفة القانون أو إرسال رسائل مزعجة أو تخزين محتوى لا تملك حقّه، ولا تحاول الوصول إلى مساحات عمل أخرى أو مهاجمة الخدمة."] },
      { h: "المستندات والضرائب", p: ["تُنشأ عروض الأسعار والفواتير ممّا تُدخله. تبقى مسؤولًا عن محتواها وعن احترام قواعد الفوترة والضرائب في بلدك."] },
      { h: "التوفّر", p: ["نعمل على إبقاء الخدمة متاحة وبياناتك آمنة، مع نسخ احتياطية لدى مزوّد قاعدة البيانات، لكن الخدمة مقدّمة «كما هي» دون ضمان عمل متواصل. احتفظ بنسخ خاصة بك من البيانات المهمة."] },
      { h: "الإنهاء", p: ["يمكنك حذف حسابك في أي وقت. قد نعلّق حسابًا يخالف هذه الشروط. قد تتغيّر هذه الشروط، وسيُعلن عن التغييرات المهمة داخل التطبيق."] },
      { h: "التواصل", p: ["{contact}"] },
    ],
  },
};
