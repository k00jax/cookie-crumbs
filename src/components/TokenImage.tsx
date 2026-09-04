"use client";

// Token logo with multi-gateway fallback. Many registry logos point at ipfs.io, which is flaky and
// sometimes serves Cross-Origin-Resource-Policy that blocks embedding — try alternates, then show
// the cookie placeholder instead of a broken-image icon.

import { useEffect, useState } from "react";

function altCandidates(src: string): string[] {
  const out = [src];
  // ipfs.io → public gateway alternates (keep the CID path).
  const m = src.match(/^https:\/\/ipfs\.io\/ipfs\/(.+)$/);
  if (m) {
    const cid = m[1];
    out.push(`https://cloudflare-ipfs.com/ipfs/${cid}`, `https://dweb.link/ipfs/${cid}`);
  }
  return out;
}

export function TokenImage({
  src,
  alt = "",
  className = "",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const candidates = src ? altCandidates(src) : [];
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => setIdx(0), [src]);

  if (!candidates.length || failed || idx >= candidates.length) {
    return (
      <span
        className={`flex items-center justify-center overflow-hidden bg-zinc-700/80 ${className}`}
        aria-label={alt}
        title={alt}
      >
        <span className="text-[0.7em] leading-none">🍪</span>
      </span>
    );
  }

  const url = candidates[idx];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        if (idx + 1 >= candidates.length) setFailed(true);
        else setIdx(idx + 1);
      }}
    />
  );
}
