"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface InviteQrCodeProps {
  url: string;
  label: string;
}

/** QR code for the join link, rendered client-side as a data URL. */
export default function InviteQrCode({ url, label }: InviteQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((generated) => {
        if (!cancelled) setDataUrl(generated);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) return null;

  return (
    <figure className="mx-auto mt-6 w-fit rounded-2xl bg-white p-3 shadow-lg shadow-black/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={label} className="h-40 w-40 sm:h-44 sm:w-44" />
      <figcaption className="mt-2 max-w-44 break-all text-center font-mono text-[10px] leading-4 text-slate-500">
        {url.replace(/^https?:\/\//, "")}
      </figcaption>
    </figure>
  );
}
