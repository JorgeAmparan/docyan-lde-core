import { SiteNav } from "@/components/commercial/site-nav";
import { SiteFooter } from "@/components/commercial/site-footer";

/** Capa B public shell: shared nav + footer around every commercial page. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
