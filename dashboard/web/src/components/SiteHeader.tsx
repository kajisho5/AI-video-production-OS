import { useI18n, withLang, type Lang } from "../lib/i18n.js";

/** Shared header for both pages: brand, the Dashboard / Control Room switch, the EN/JA
 * switch (same control as the landing page's), and a link back to the landing page (the
 * site root, one level above this app's base path). Every URL is relative to Vite's base
 * path, so it resolves under GitHub Pages' project subpath and in local dev alike, and
 * carries `?lang=ja` while Japanese is active so a shared link opens in Japanese. */
type Page = "dashboard" | "control-room";

const BASE = import.meta.env.BASE_URL;
// The landing page is the site root; the dashboard is built under <site>/dashboard/.
const SITE = `${BASE}../`;

const LANGS: Array<{ code: Lang; label: string }> = [
  { code: "en", label: "EN" },
  { code: "ja", label: "JA" },
];

export function SiteHeader({ current }: { current: Page }) {
  const { lang, setLang, t } = useI18n();

  return (
    <>
      <a className="skip" href="#main">
        {t("header.skip")}
      </a>
      <header className="site-header">
        <div className="wrap bar">
          <a className="brand" href={withLang(BASE, lang)}>
            <img src={`${BASE}icons/velisa-horizontal-on-dark.svg`} alt="Velisa" width={129} height={28} />
          </a>
          <nav className="pages" aria-label={t("header.pages")}>
            <a href={withLang(BASE, lang)} aria-current={current === "dashboard" ? "page" : undefined}>
              {t("header.dashboard")}
            </a>
            <a href={withLang(`${BASE}control-room.html`, lang)} aria-current={current === "control-room" ? "page" : undefined}>
              {t("header.controlRoom")}
            </a>
          </nav>
          <div className="lang" role="group" aria-label={t("header.language")}>
            {LANGS.map((l) => (
              <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
          <a className="btn btn-line" href={withLang(SITE, lang)}>
            {t("header.home")}
          </a>
        </div>
      </header>
    </>
  );
}
