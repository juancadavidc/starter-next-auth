import Script from "next/script";
import { isValidGaId } from "@/lib/ga";

// Google Analytics 4. Sin NEXT_PUBLIC_GA_ID (o con uno inválido) no se carga nada.
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!isValidGaId(id)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
