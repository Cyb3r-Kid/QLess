import QRCode from "qrcode";
import { QrDisplay } from "@/components/qr-display";
import { publicConfig, qrConfig } from "@/lib/env";
export default async function DisplayPage() {
  const qr = qrConfig();
  const image = qr.url
    ? await QRCode.toDataURL(qr.url, {
        width: 800,
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#102e25", light: "#ffffff" },
      })
    : null;
  return (
    <QrDisplay
      config={publicConfig()}
      image={image}
      url={qr.url}
      warning={qr.warning}
    />
  );
}
