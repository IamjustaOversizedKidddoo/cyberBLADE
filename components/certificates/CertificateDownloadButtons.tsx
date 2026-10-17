"use client";

import { useState } from "react";

interface CertificateDownloadButtonsProps {
  credentialId: string;
  certificateDomId?: string;
}

export function CertificateDownloadButtons({
  credentialId,
  certificateDomId = "cyberblade-certificate-chassis",
}: CertificateDownloadButtonsProps) {
  const [copyStatus, setCopyStatus] = useState<string>("Copy Verify Link");
  const [downloading, setDownloading] = useState<boolean>(false);

  const getVerifyUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://cyberblade.dev";
    return `${origin}/verify/${credentialId}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getVerifyUrl());
      setCopyStatus("Link Copied!");
      setTimeout(() => setCopyStatus("Copy Verify Link"), 2500);
    } catch {
      setCopyStatus("Failed to copy");
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadSvg = () => {
    const element = document.getElementById(certificateDomId);
    if (!element) return;
    const svgElement = element.querySelector("svg.certificate-svg-art");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cyberblade-certificate-${credentialId}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = async () => {
    const element = document.getElementById(certificateDomId);
    if (!element) return;
    const svgElement = element.querySelector("svg.certificate-svg-art") as SVGSVGElement | null;
    if (!svgElement) return;

    setDownloading(true);
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const URLObj = window.URL || window.webkitURL || window;
      const blobURL = URLObj.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        // High-definition 2x rendering
        const width = 1200;
        const height = 800;
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(2, 2);
          ctx.drawImage(image, 0, 0, width, height);
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = `cyberblade-certificate-${credentialId}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
        URLObj.revokeObjectURL(blobURL);
        setDownloading(false);
      };
      image.onerror = () => {
        URLObj.revokeObjectURL(blobURL);
        setDownloading(false);
      };
      image.src = blobURL;
    } catch {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 print:hidden">
      <button
        type="button"
        onClick={handlePrintPdf}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-cyan/60 bg-cyan/15 text-cyan hover:bg-cyan/25 hover:border-cyan font-ui text-sm font-semibold tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        <span>Print / Save PDF</span>
      </button>

      <button
        type="button"
        onClick={handleDownloadPng}
        disabled={downloading}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-line bg-surface hover:bg-surface-hover text-ink font-ui text-sm tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-50"
      >
        <svg className="w-4 h-4 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>{downloading ? "Rendering PNG…" : "Download PNG"}</span>
      </button>

      <button
        type="button"
        onClick={handleDownloadSvg}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-line bg-surface hover:bg-surface-hover text-secondary hover:text-ink font-ui text-sm tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <span>Download SVG</span>
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xs border border-line bg-surface hover:bg-surface-hover text-cyan hover:text-ink font-mono text-xs tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <svg className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>{copyStatus}</span>
      </button>
    </div>
  );
}
