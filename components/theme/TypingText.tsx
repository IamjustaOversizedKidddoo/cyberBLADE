"use client";

import { useEffect, useState } from "react";
import { useDisplayPrefs } from "@/lib/theme/use-display-prefs";
import { BlinkCursor } from "./BlinkCursor";

type Props = { text: string; speedMs?: number; className?: string };

export function TypingText({ text, speedMs = 18, className }: Props) {
  const { motion } = useDisplayPrefs();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (motion === "reduce") return;
    const timer = setInterval(() => {
      setCount((c) => {
        if (c + 1 >= text.length) clearInterval(timer);
        return Math.min(c + 1, text.length);
      });
    }, speedMs);
    return () => clearInterval(timer);
  }, [motion, text, speedMs]);

  const visible = motion === "reduce" ? text : text.slice(0, count);

  return (
    <span className={`font-ui ${className ?? ""}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" data-typed="">
        {visible}
      </span>
      <BlinkCursor />
    </span>
  );
}
