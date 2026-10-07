import type { Lesson } from "@/lib/content/schema";

export function DraftBanner({ status }: { status: Lesson["status"] }) {
  if (status === "published") return null;
  return (
    <div role="note" className="border-b border-pink bg-pink/10 px-4 py-2 text-center font-ui text-pink">
      DRAFT — not yet expert-reviewed
    </div>
  );
}
