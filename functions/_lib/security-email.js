import { emailLayout, escapeHtml, sendEmail } from "./email.js";

const supported = new Set(["fr", "ar", "en", "es", "pt"]);
const localeOf = value => supported.has(value) ? value : "fr";

const copy = {
  fr: {
    verification: ["Votre code de confirmation TAMUSNI", "Confirmez votre adresse e-mail", "Ce code expire dans 10 minutes."],
    reset: ["Réinitialisez votre mot de passe TAMUSNI", "Réinitialisation du mot de passe", "Ce lien unique expire dans 30 minutes."],
    changed: ["Votre mot de passe TAMUSNI a été modifié", "Mot de passe modifié", "Votre mot de passe vient d’être modifié. Toutes vos autres sessions ont été fermées."],
    unusual: ["Nouvelle connexion à votre compte TAMUSNI", "Nouvelle connexion détectée", "Si vous n’êtes pas à l’origine de cette connexion, réinitialisez immédiatement votre mot de passe."],
    deletionCode: ["Code de suppression de votre compte TAMUSNI", "Confirmez la suppression du compte", "Ce code expire dans 10 minutes. La suppression sera définitive."],
    deleted: ["Votre compte TAMUSNI a été supprimé", "Compte supprimé", "Votre compte et vos données personnelles associées ont été supprimés. Vos éventuelles contributions publiées restent conservées sans profil personnel."],
    hello: "Bonjour"
  },
  en: {
    verification: ["Your TAMUSNI confirmation code", "Confirm your email address", "This code expires in 10 minutes."],
    reset: ["Reset your TAMUSNI password", "Password reset", "This single-use link expires in 30 minutes."],
    changed: ["Your TAMUSNI password was changed", "Password changed", "Your password has just been changed. All your other sessions have been closed."],
    unusual: ["New sign-in to your TAMUSNI account", "New sign-in detected", "If this was not you, reset your password immediately."],
    deletionCode: ["TAMUSNI account deletion code", "Confirm account deletion", "This code expires in 10 minutes. Deletion is permanent."],
    deleted: ["Your TAMUSNI account was deleted", "Account deleted", "Your account and associated personal data have been deleted. Any published contributions remain without a personal profile."],
    hello: "Hello"
  },
  ar: {
    verification: ["رمز تأكيد تاموسني", "تأكيد البريد الإلكتروني", "تنتهي صلاحية هذا الرمز خلال 10 دقائق."],
    reset: ["إعادة تعيين كلمة مرور تاموسني", "إعادة تعيين كلمة المرور", "تنتهي صلاحية هذا الرابط أحادي الاستخدام خلال 30 دقيقة."],
    changed: ["تم تغيير كلمة مرور تاموسني", "تم تغيير كلمة المرور", "تم تغيير كلمة المرور وإغلاق جميع الجلسات الأخرى."],
    unusual: ["تسجيل دخول جديد إلى حساب تاموسني", "تم اكتشاف تسجيل دخول جديد", "إذا لم تكن أنت، فأعد تعيين كلمة المرور فورًا."],
    deletionCode: ["رمز حذف حساب تاموسني", "تأكيد حذف الحساب", "تنتهي صلاحية الرمز خلال 10 دقائق. الحذف نهائي."],
    deleted: ["تم حذف حساب تاموسني", "تم حذف الحساب", "تم حذف حسابك والبيانات الشخصية المرتبطة به. تبقى المساهمات المنشورة دون ملف شخصي."],
    hello: "مرحبًا"
  },
  es: {
    verification: ["Tu código de confirmación TAMUSNI", "Confirma tu correo", "Este código caduca en 10 minutos."],
    reset: ["Restablece tu contraseña TAMUSNI", "Restablecimiento de contraseña", "Este enlace de un solo uso caduca en 30 minutos."],
    changed: ["Tu contraseña TAMUSNI ha cambiado", "Contraseña modificada", "La contraseña se ha modificado y las demás sesiones se han cerrado."],
    unusual: ["Nuevo acceso a tu cuenta TAMUSNI", "Nuevo acceso detectado", "Si no has sido tú, restablece tu contraseña inmediatamente."],
    deletionCode: ["Código de eliminación de cuenta TAMUSNI", "Confirma la eliminación", "El código caduca en 10 minutos. La eliminación es definitiva."],
    deleted: ["Tu cuenta TAMUSNI ha sido eliminada", "Cuenta eliminada", "Tu cuenta y los datos personales asociados han sido eliminados. Las contribuciones publicadas permanecen sin perfil personal."],
    hello: "Hola"
  },
  pt: {
    verification: ["O seu código de confirmação TAMUSNI", "Confirme o seu e-mail", "Este código expira em 10 minutos."],
    reset: ["Reponha a sua palavra-passe TAMUSNI", "Reposição da palavra-passe", "Esta ligação de utilização única expira em 30 minutos."],
    changed: ["A sua palavra-passe TAMUSNI foi alterada", "Palavra-passe alterada", "A palavra-passe foi alterada e todas as outras sessões foram terminadas."],
    unusual: ["Novo início de sessão na sua conta TAMUSNI", "Novo início de sessão detetado", "Se não foi você, reponha imediatamente a palavra-passe."],
    deletionCode: ["Código de eliminação da conta TAMUSNI", "Confirme a eliminação", "O código expira em 10 minutos. A eliminação é definitiva."],
    deleted: ["A sua conta TAMUSNI foi eliminada", "Conta eliminada", "A sua conta e os dados pessoais associados foram eliminados. As contribuições publicadas permanecem sem perfil pessoal."],
    hello: "Olá"
  }
};

function render(locale, title, body) {
  const rtl = locale === "ar";
  return emailLayout(title, `<div dir="${rtl ? "rtl" : "ltr"}" style="text-align:${rtl ? "right" : "left"}">${body}</div>`, { locale, direction: rtl ? "rtl" : "ltr" });
}

export async function sendSecurityEmail(env, { type, to, name = "", locale, code, url, country, browser }) {
  const language = localeOf(locale);
  const text = copy[language];
  const definition = text[type];
  if (!definition) throw new Error("SECURITY_EMAIL_TYPE_INVALID");
  const greeting = `${text.hello}${name ? ` ${escapeHtml(name)}` : ""},`;
  let content = `<p>${greeting}</p>`;
  let plain = `${text.hello}${name ? ` ${name}` : ""},\n\n`;
  if (code) {
    content += `<p style="font-size:32px;font-weight:700;letter-spacing:.18em;text-align:center;padding:18px;background:#f1f5f9;border-radius:12px">${escapeHtml(code)}</p>`;
    plain += `${code}\n\n`;
  }
  if (url) {
    content += `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px">${escapeHtml(definition[1])}</a></p>`;
    plain += `${url}\n\n`;
  }
  if (country || browser) {
    content += `<p><strong>${escapeHtml(browser || "")}</strong>${country ? ` · ${escapeHtml(country)}` : ""}</p>`;
    plain += `${browser || ""}${country ? ` · ${country}` : ""}\n\n`;
  }
  content += `<p>${escapeHtml(definition[2])}</p>`;
  plain += definition[2];
  return sendEmail(env, { to, subject: definition[0], html: render(language, definition[1], content), text: plain });
}

