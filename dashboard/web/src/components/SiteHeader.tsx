/** Shared header for both pages: brand, the Dashboard / Control Room switch, and a link
 * back to the landing page (the site root, one level above this app's base path). Every URL is relative to Vite's base path, so it resolves
 * under GitHub Pages' project subpath and in local dev alike. */
type Page = "dashboard" | "control-room";

const BASE = import.meta.env.BASE_URL;
// The landing page is the site root; the dashboard is built under <site>/dashboard/.
const SITE = `${BASE}../`;

export function SiteHeader({ current }: { current: Page }) {
  return (
    <>
      <a className="skip" href="#main">
        本文へスキップ
      </a>
      <header className="site-header">
        <div className="wrap bar">
          <a className="brand" href={BASE}>
            <img src={`${BASE}icons/favicon-64.png`} alt="" width={28} height={28} />
            AI Video Production OS
          </a>
          <nav className="pages" aria-label="ページ">
            <a href={BASE} aria-current={current === "dashboard" ? "page" : undefined}>
              ダッシュボード
            </a>
            <a href={`${BASE}control-room.html`} aria-current={current === "control-room" ? "page" : undefined}>
              コントロールルーム
            </a>
          </nav>
          <a className="btn btn-line" href={SITE}>
            紹介ページ
          </a>
        </div>
      </header>
    </>
  );
}
