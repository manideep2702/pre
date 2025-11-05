"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from "react";

type FlipBookProps = {
  src: string; // PDF url
};

// Use npm package instead of CDN script to avoid webpack runtime conflicts
async function ensurePdfJs() {
  if (typeof window === "undefined") return null;
  const mod = await import("pdfjs-dist/legacy/build/pdf");
  // Set worker source to the packaged worker via CDN as a fallback; or consumers
  // can serve it locally by copying from node_modules/pdfjs-dist/build/pdf.worker.min.js
  try {
    (mod as any).GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  } catch {}
  return mod as any;
}

export default function FlipBook({ src }: FlipBookProps) {
  const [numPages, setNumPages] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1); // 1-based current page in book mode
  const [flip, setFlip] = useState<"none" | "forward" | "backward">("none");
  const [frontImg, setFrontImg] = useState<string | null>(null);
  const [backImg, setBackImg] = useState<string | null>(null);
  const pdfRef = useRef<any>(null);
  const cacheRef = useRef<Map<number, string>>(new Map()); // key: 1-based page number

  // Load pdf.js and the document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await ensurePdfJs();
        if (!pdfjs) return;
        const task = (pdfjs as any).getDocument(src);
        const pdf = await task.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        // Prefetch: show page 1 as soon as it's ready, then warm page 2
        await renderIntoCache(1);
        if (!cancelled) setReady(true);
        renderIntoCache(2);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const renderIntoCache = async (pageNumber: number) => {
    if (pageNumber < 1) return null;
    const pdf = pdfRef.current;
    if (!pdf || pageNumber > pdf.numPages) return null;
    if (cacheRef.current.has(pageNumber)) return cacheRef.current.get(pageNumber)!;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx!, viewport }).promise;
    const url = canvas.toDataURL("image/jpeg", 0.92);
    cacheRef.current.set(pageNumber, url);
    return url;
  };

  const getSpreadPages = (p: number) => {
    if (p <= 1) return { left: null, right: 1 } as const;
    if (p % 2 === 0) return { left: p, right: p + 1 <= numPages ? p + 1 : null } as const;
    // odd (>1)
    return { left: p - 1, right: p } as const;
  };

  const spreadPages = getSpreadPages(page);

  useEffect(() => {
    // Preload around current index
    renderIntoCache((spreadPages.left ?? 0) + 2);
    renderIntoCache((spreadPages.right ?? 0) + 2);
    renderIntoCache((spreadPages.left ?? 0) - 1);
  }, [page, numPages]);

  const canPrev = page > 1;
  const canNext = page === 1 ? numPages >= 2 : page + 2 <= numPages;

  const onNext = async () => {
    if (!canNext) return;
    // Animate flipping the right page to reveal next spread's left page
    const currentRight = spreadPages.right ?? page; // page 1 or current right
    const nextLeft = page === 1 ? 2 : page + 2;
    const front = cacheRef.current.get(currentRight) || (await renderIntoCache(currentRight));
    const back = (await renderIntoCache(nextLeft)) || null;
    setFrontImg(front || null);
    setBackImg(back || null);
    setFlip("forward");
    setTimeout(() => {
      setPage((p) => (p === 1 ? 2 : Math.min(p + 2, numPages)));
      setFlip("none");
    }, 700);
  };

  const onPrev = async () => {
    if (!canPrev) return;
    // Animate flipping the left page to reveal previous spread's right page
    const prevPage = page === 2 ? 1 : Math.max(1, page - 2);
    const front = (await renderIntoCache(prevPage)) || null;
    const back = (await renderIntoCache(page)) || null;
    setFrontImg(front || null);
    setBackImg(back || null);
    setFlip("backward");
    setTimeout(() => {
      setPage((p) => (p === 2 ? 1 : Math.max(1, p - 2)));
      setFlip("none");
    }, 700);
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNext, canPrev]);

  // Always read latest rendered images from cache so first page appears as soon as it loads
  const leftImg = spreadPages.left ? cacheRef.current.get(spreadPages.left) || null : null;
  const rightImg = spreadPages.right ? cacheRef.current.get(spreadPages.right) || null : null;
  const spread = { left: leftImg, right: rightImg };

  const hasLeft = !!spread.left;

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <button
          onClick={onPrev}
          disabled={!canPrev || flip !== "none"}
          className="rounded-md px-3 py-1.5 ring-1 ring-border hover:bg-white/5 disabled:opacity-50"
        >
          ← Prev
        </button>
        <div>
          Page {page} of {numPages || "…"}
        </div>
        <button
          onClick={onNext}
          disabled={!canNext || flip !== "none"}
          className="rounded-md px-3 py-1.5 ring-1 ring-border hover:bg-white/5 disabled:opacity-50"
        >
          Next →
        </button>
      </div>

      {/* Viewer */}
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card/70 shadow-sm aspect-[3/2]">
        {/* Consistent spread size (3:2). If cover (no left page), center the page. */}
        {hasLeft ? (
          <div className="absolute inset-0 grid grid-cols-2">
            <div className="relative h-full w-full bg-white">
              {spread.left ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={spread.left} alt="Page left" className="h-full w-full object-contain" />
              ) : (
                <Skeleton />
              )}
            </div>
            <div className="relative h-full w-full bg-white">
              {spread.right ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={spread.right} alt="Page right" className="h-full w-full object-contain" />
              ) : (
                <Skeleton />
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-full w-1/2 bg-white">
              {spread.right ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={spread.right} alt="Cover page" className="h-full w-full object-contain" />
              ) : (
                <Skeleton />
              )}
            </div>
          </div>
        )}

        {/* Flip overlay animation */}
        {flip !== "none" && frontImg && (
          <FlipOverlay front={frontImg} back={backImg} direction={flip} />
        )}
      </div>

      {!ready && !error && (
        <div className="mt-3 text-xs text-muted-foreground">Loading PDF…</div>
      )}
      {error && (
        <div className="mt-3 text-xs text-red-400">{String(error)}</div>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="h-full w-full animate-pulse bg-white/5" />;
}

function FlipOverlay({
  front,
  back,
  direction,
}: {
  front: string;
  back: string | null;
  direction: "forward" | "backward";
}) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex">
      <style
        dangerouslySetInnerHTML={{
          __html: `
      .flip3d { transform-style: preserve-3d; transition: transform .7s ease; }
      .flip-face { position: absolute; inset: 0; backface-visibility: hidden; }
      .flip-back { transform: rotateY(180deg); }
      `,
        }}
      />
      {direction === "backward" ? (
        // Flipping from left side (going backward)
        <div className="relative block w-1/2 perspective-[1200px]">
          <div
            className="flip3d absolute inset-0 origin-right"
            style={{ transform: animate ? "rotateY(180deg)" : "rotateY(0deg)" }}
          >
            {/* front shows previous page image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={front} alt="flip front" className="flip-face h-full w-full object-contain bg-white" />
            {/* back shows current page */}
            {back && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={back} alt="flip back" className="flip-face flip-back h-full w-full object-contain bg-white" />
            )}
          </div>
        </div>
      ) : (
        // Flipping from right side (going forward)
        <div className="relative block w-1/2 ml-auto perspective-[1200px]">
          <div
            className="flip3d absolute inset-0 origin-left"
            style={{ transform: animate ? "rotateY(-180deg)" : "rotateY(0deg)" }}
          >
            {/* front shows current page */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={front} alt="flip front" className="flip-face h-full w-full object-contain bg-white" />
            {/* back shows next page */}
            {back && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={back} alt="flip back" className="flip-face flip-back h-full w-full object-contain bg-white" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
