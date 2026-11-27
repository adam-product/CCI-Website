import { useEffect, useRef } from "react";

const countPattern = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,6}))?(\s*[KMBT]?\+?|\s*%)$/i;
const duration = 950;
const visibilityThreshold = 0.35;

export function ImpactNumber({ value }: { value: string }) {
  const count = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = count.current;
    const parts = countPattern.exec(value);
    if (!element || !parts || !window.IntersectionObserver) return;

    const [, whole, decimals = "", suffix] = parts;
    const target = Number(`${whole.replaceAll(",", "")}.${decimals}`);
    if (target <= 0 || !Number.isSafeInteger(Math.round(target * 10 ** decimals.length))) return;

    const format = new Intl.NumberFormat("en-US", {
      useGrouping: whole.includes(","),
      minimumFractionDigits: decimals.length,
      maximumFractionDigits: decimals.length,
    });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let ready = true;

    const finish = () => {
      window.cancelAnimationFrame(frame);
      element.textContent = value;
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        ready = true;
        finish();
        return;
      }
      if (!ready || motion.matches || entry.intersectionRatio < visibilityThreshold) return;

      ready = false;
      const startedAt = performance.now();
      const update = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        if (progress === 1) {
          finish();
          return;
        }
        const eased = 1 - (1 - progress) ** 3;
        const current = target * eased;
        element.textContent = format.format(decimals ? current : Math.floor(current)) + suffix;
        frame = window.requestAnimationFrame(update);
      };
      frame = window.requestAnimationFrame(update);
    }, { threshold: [0, visibilityThreshold] });

    observer.observe(element);
    motion.addEventListener("change", finish);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", finish);
      finish();
    };
  }, [value]);

  return (
    <span className="metric">
      <span className="sr-only">{value}</span>
      <span ref={count} aria-hidden="true">{value}</span>
    </span>
  );
}
