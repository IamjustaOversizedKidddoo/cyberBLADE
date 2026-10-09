"use client";

import { useEffect, useState } from "react";

type Scene = { id: string; seq: string; name: string };

/**
 * "04/07 TRACE": which scene of the landing story sits on the middle line of the screen.
 * Decorative (aria-hidden): the headings already carry the story for screen readers.
 */
export function SceneReadout({ scenes }: { scenes: readonly Scene[] }) {
  const [current, setCurrent] = useState(scenes[0]);

  useEffect(() => {
    const byId = new Map(scenes.map((s) => [s.id, s]));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(byId.get((e.target as HTMLElement).dataset.sceneId ?? "") ?? scenes[0]);
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    document.querySelectorAll<HTMLElement>("section[data-scene-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scenes]);

  return (
    <span data-scene-readout aria-hidden="true" className="font-ui text-sm tracking-wider tabular-nums">
      {current.seq}/{String(scenes.length).padStart(2, "0")} {current.name}
    </span>
  );
}
