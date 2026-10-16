import { getTranslations } from "next-intl/server";
import { googleSignIn } from "./actions";

/** "Continue with Google" plus the "or" divider; rendered only when Google keys are set. */
export async function GoogleButton({ callbackUrl }: { callbackUrl?: string }) {
  const t = await getTranslations("auth");
  return (
    <>
      <form action={googleSignIn}>
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <button type="submit" className="ax-btn ax-btn-secondary login-submit">
          <svg className="ax-icon" viewBox="0 0 24 24" aria-hidden>
            {/* Google's "G" keeps its brand colours by Google's guidelines. */}
            <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
          </svg>
          {t("google")}
        </button>
      </form>
      <div className="login-divider" role="separator" aria-label={t("or")}>
        <span aria-hidden>{t("or")}</span>
      </div>
    </>
  );
}
