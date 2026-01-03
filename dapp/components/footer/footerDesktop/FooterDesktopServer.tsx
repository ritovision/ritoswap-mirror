import FooterDesktopClient from "./FooterDesktopClient";
import ImageQuoteServer from "../utilities/imageQuote/ImageQuoteServer";

export default function FooterDesktopServer() {
  return <FooterDesktopClient rightMenuContent={<ImageQuoteServer />} />;
}
