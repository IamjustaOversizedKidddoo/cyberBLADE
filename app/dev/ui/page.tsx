import { notFound } from "next/navigation";
import { DevUiShowcase } from "./DevUiShowcase";

export const dynamic = "force-dynamic";

export default function DevUiPage() {
  if (process.env.NODE_ENV === "production" && process.env.CYBERBLADE_SHOW_DEV_UI !== "true") {
    notFound();
  }

  return <DevUiShowcase />;
}
