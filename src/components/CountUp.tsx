"use client";

import { useEffect, useRef, useState } from "react";

/** Number that counts up when it first appears and whenever its value changes. Renders the final value on the server. */
export function CountUp({ value, duration = 700, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(origin + (value - origin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{shown}</span>;
}
