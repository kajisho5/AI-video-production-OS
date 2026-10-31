import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { I18nContext, LOCALES, translator, type Lang } from "../lib/i18n.js";

/** Render a single component in a given UI language (a component on its own, without a
 * page's LanguageProvider, is English). */
export function renderInLang(lang: Lang, ui: ReactElement) {
  return render(<I18nContext.Provider value={{ lang, locale: LOCALES[lang], t: translator(lang), setLang: () => {} }}>{ui}</I18nContext.Provider>);
}
