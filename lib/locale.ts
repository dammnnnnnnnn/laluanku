// Server-side locale: read from the language cookie set by the EN/BM switch.
// Call only inside request-time (Suspense-wrapped) components.
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, t, type Locale, type Strings } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export async function getStrings(): Promise<{ locale: Locale; s: Strings }> {
  const locale = await getLocale();
  return { locale, s: t(locale) };
}
