"use client";

import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) {
        setPercent(0);
        return;
      }
      const current = window.scrollY;
      const pct = Math.min(100, Math.max(0, Math.round((current / scrollHeight) * 100)));
      setPercent(pct);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (percent === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent"
    >
      <div
        className="h-full bg-cyan shadow-[0_0_10px_rgba(15,190,255,0.7)] transition-all duration-75 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
