import { AppShell } from "@/components/shell/AppShell";
import { requireOperator } from "@/lib/identity/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const operator = await requireOperator();
  return <AppShell operator={operator}>{children}</AppShell>;
}
