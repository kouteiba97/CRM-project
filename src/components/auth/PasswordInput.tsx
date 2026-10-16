"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean };

/** Password field with a Show/Hide toggle; always LTR so typed characters keep their order. */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { invalid, className, ...rest },
  ref,
) {
  const t = useTranslations("auth");
  const [shown, setShown] = useState(false);
  return (
    <div className="ax-field-box password-box" aria-invalid={invalid ? true : undefined}>
      <input
        ref={ref}
        {...rest}
        type={shown ? "text" : "password"}
        dir="ltr"
        className={className}
        aria-invalid={invalid ? true : undefined}
      />
      <button
        type="button"
        className="ax-btn ax-btn-tertiary ax-btn-icon ax-btn-sm"
        aria-label={t("showPassword")}
        aria-pressed={shown}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff className="ax-icon" aria-hidden /> : <Eye className="ax-icon" aria-hidden />}
      </button>
    </div>
  );
});
