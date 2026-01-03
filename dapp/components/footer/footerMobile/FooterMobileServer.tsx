import FooterMobileClient from "./FooterMobileClient";
import ImageQuoteServer from "../utilities/imageQuote/ImageQuoteServer";

export default function FooterMobileServer() {
  return (
    <FooterMobileClient>
      <ImageQuoteServer />
    </FooterMobileClient>
  );
}