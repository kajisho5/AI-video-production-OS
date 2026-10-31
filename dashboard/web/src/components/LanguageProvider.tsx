import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectLang, I18nContext, LOCALES, persistLang, translator, type I18n, type Lang, type MessageKey } from "../lib/i18n.js";

type Page = "dashboard" | "control-room";

const META: Record<Page, { title: MessageKey; description: MessageKey }> = {
  dashboard: { title: "meta.dashboard.title", description: "meta.dashboard.description" },
  "control-room": { title: "meta.controlRoom.title", description: "meta.controlRoom.description" },
};

/** Picks the language once on load (URL, then the landing page's stored choice, then
 * English) and keeps `<html lang>`, the document title and the meta description in step
 * with it. The initial HTML is English; this switches it at runtime. */
export function LanguageProvider({ page, children }: { page: Page; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persistLang(next);
  }, []);

  const value = useMemo<I18n>(() => ({ lang, locale: LOCALES[lang], t: translator(lang), setLang }), [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = value.t(META[page].title);
    document.querySelector('meta[name="description"]')?.setAttribute("content", value.t(META[page].description));
  }, [lang, page, value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
