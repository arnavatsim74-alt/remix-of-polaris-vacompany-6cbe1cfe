import { VACOMPANY_URL } from "@/lib/branding";

export function PolarisFooter() {
  return (
    <footer className="border-t py-3 text-center text-xs text-muted-foreground">
      <span>POLARIS™ Crew Center | A </span>
      <a href={VACOMPANY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        VACompany
      </a>
      <span> Product</span>
    </footer>
  );
}
