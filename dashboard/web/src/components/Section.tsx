import { useState, type ReactNode } from "react";

/** Collapsible on all sizes, but defaults open on wide viewports and closed on narrow
 * ones -- desktop can afford everything visible at once (task: "allow richer... detailed
 * status"); mobile needs the most important information reachable without endless
 * scrolling (task: "collapsible sections... avoid requiring hover"). */
export function Section({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const initial = defaultOpen ?? (typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [open, setOpen] = useState(initial);

  return (
    <div className="panel">
      <button className="section-header" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <h2>{title}</h2>
        <span className={`section-chevron ${open ? "open" : ""}`} aria-hidden="true">
          &#9656;
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
