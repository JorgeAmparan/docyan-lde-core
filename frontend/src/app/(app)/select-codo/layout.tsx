import { OrgShell } from "@/components/org-shell";

/** La selección de CoDo previa a consultar también vive dentro del shell. */
export default function SelectCodoLayout({ children }: { children: React.ReactNode }) {
  return <OrgShell>{children}</OrgShell>;
}
