// components/footer/FooterWrapper.tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import ImageQuoteClient from "./utilities/imageQuote/ImageQuoteClient";
import imageTextPairs from "./utilities/imageQuote/imageTextPairs.json";

const FooterDesktopClient = dynamic(
  () => import("./footerDesktop/FooterDesktopClient"),
  { ssr: false }
);
const FooterMobileClient = dynamic(
  () => import("./footerMobile/FooterMobileClient"),
  { ssr: false }
);

export default function FooterWrapper() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 730);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile ? (
    <FooterMobileClient>
      <ImageQuoteClient imageTextPairs={imageTextPairs} />
    </FooterMobileClient>
  ) : (
    <FooterDesktopClient
      rightMenuContent={<ImageQuoteClient imageTextPairs={imageTextPairs} />}
    />
  );
}
