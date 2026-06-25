"use client";

import { useEffect, useRef, useState } from "react";

export interface TocSection {
  id: string;
  label: string;
}

/** Pass a stable `sections` array reference (module-scope const) — the observer is re-created when its identity changes. */
export function ReportToc({ sections }: { sections: TocSection[] }) {
  const [active, setActive] = useState<string | null>(null);
  const visible = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const map = visible.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) map.set(entry.target.id, entry.isIntersecting);
        const topmost = sections.find((s) => map.get(s.id));
        if (topmost) setActive(topmost.id);
      },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => {
      observer.disconnect();
      map.clear();
    };
  }, [sections]);

  return (
    <nav className="toc" aria-label="Report sections">
      <div className="toc-title">Index</div>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={active === s.id ? "toc-link toc-active" : "toc-link"}
          aria-current={active === s.id ? "location" : undefined}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
