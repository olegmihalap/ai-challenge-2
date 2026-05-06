import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export const QrScanner = ({ onScan, paused }: { onScan: (text: string) => void; paused?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const id = "qr-reader-" + Math.random().toString(36).slice(2, 8);
    ref.current.id = id;
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    try {
      scanner = new Html5Qrcode(id, { verbose: false } as any);
    } catch {
      return;
    }
    scannerRef.current = scanner;

    startPromiseRef.current = scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          const now = Date.now();
          if (text === lastRef.current.code && now - lastRef.current.at < 2000) return;
          lastRef.current = { code: text, at: now };
          onScan(text);
        },
        () => {},
      )
      .then(() => {
        if (cancelled) {
          // Component unmounted before start resolved; stop immediately.
          try { scanner?.stop().then(() => { try { scanner?.clear(); } catch { /* ignore */ } }).catch(() => {}); } catch { /* ignore */ }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      const p = startPromiseRef.current;
      startPromiseRef.current = null;
      if (!s) return;
      const stopAndClear = () => {
        s.stop().then(() => { try { s.clear(); } catch { /* ignore */ } }).catch(() => {
          try { s.clear(); } catch { /* ignore */ }
        });
      };
      if (p) {
        p.then(stopAndClear).catch(() => { try { s.clear(); } catch { /* ignore */ } });
      } else {
        stopAndClear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (paused) s.pause(true);
      else s.resume();
    } catch { /* ignore */ }
  }, [paused]);

  return <div ref={ref} className="w-full overflow-hidden rounded-xl bg-black" />;
};
