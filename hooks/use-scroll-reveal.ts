"use client";

import { useEffect } from "react";
import type { Content } from "../lib/content";

const cardSelector = [
  ".initiative-slot",
  ".focus-areas > li",
  ".metrics-grid > article",
  ".feature-grid > article",
  ".journey article",
  ".partner-grid > li",
  ".testimonial-grid > blockquote",
  ".values-panel > div",
  ".contact-opportunity",
  ".story-values-list > li",
  ".story-people > li",
  ".story-timeline > li",
].join(", ");

const visualSelector = [
  ".page-cover",
  ".section-image",
  ".editorial-photo",
  ".editorial-hero-art:not(.editorial-hero-impact *)",
  ".detail-mascot",
  ".lotus-detail-art",
  ".coverage-globe",
  ".story-photo",
  ".story-illustration",
].join(", ");

const panelSelector = ".contact-form, .about-story-nav, .contact-info";
const targetSelector = `#main :is(h1, h2, h3, h4, p, .eyebrow, .breadcrumb,
  .button, .text-link, ${cardSelector}, ${visualSelector}, ${panelSelector}),
  .footer-main > *, .footer-bottom`;
const compoundSelector = `.photo-hero, ${cardSelector}, ${visualSelector}, ${panelSelector}`;
const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

function revealTiming(target: Element, rowSteps: Map<Element, number>) {
  if (target.matches(cardSelector)) {
    const parent = target.parentElement!;
    const step = rowSteps.get(parent) ?? 0;
    rowSteps.set(parent, step + 1);
    return {
      distance: 28,
      opacity: 0.2,
      scale: 0.985,
      duration: 720,
      delay: Math.min(step, 4) * 55,
    };
  }
  if (target.matches(visualSelector)) {
    return { distance: 36, opacity: 0.24, scale: 0.97, duration: 820, delay: 70 };
  }
  if (target.matches("h1, h2, h3, h4")) {
    return { distance: 30, opacity: 0.22, duration: 730, delay: 45 };
  }
  if (target.matches(".eyebrow, .breadcrumb")) {
    return { distance: 12, opacity: 0.38, duration: 550, delay: 0 };
  }
  if (target.matches(".button, .text-link")) {
    return { distance: 14, opacity: 0.48, duration: 600, delay: 95 };
  }
  return { distance: 18, opacity: 0.38, duration: 660, delay: 70 };
}

export function useScrollReveal(pageKey: string, content: Content[]) {
  useEffect(() => {
    if (!window.IntersectionObserver || !Element.prototype.animate) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const outside = new WeakMap<Element, "above" | "below">();
    const running = new Map<Element, Animation>();
    const observer = new IntersectionObserver((entries) => {
      const rowSteps = new Map<Element, number>();
      for (const { target, boundingClientRect, isIntersecting, rootBounds } of entries) {
        if (!isIntersecting) {
          outside.set(target, boundingClientRect.bottom <= (rootBounds?.top ?? 0) ? "above" : "below");
          continue;
        }

        const direction = outside.get(target);
        observer.unobserve(target);
        if (
          !direction ||
          reducedMotion.matches ||
          target.matches(":focus-within")
        ) continue;

        const fromAbove = direction === "above";
        // An anchor jump or history restoration should show the destination immediately.
        const nearEdge = fromAbove
          ? boundingClientRect.bottom < window.innerHeight * 0.36
          : boundingClientRect.top > window.innerHeight * 0.64;
        if (!nearEdge) continue;

        const motion = revealTiming(target, rowSteps);
        const directionScale = fromAbove ? -0.6 : 1;
        const viewportScale = window.innerWidth < 600 ? 0.8 : 1;
        const distance = motion.distance * directionScale * viewportScale;
        const animation = target.animate(
          [
            {
              opacity: fromAbove ? Math.max(motion.opacity, 0.45) : motion.opacity,
              translate: `0 ${distance}px`,
              scale: motion.scale ?? 1,
            },
            { opacity: 1, translate: "none", scale: 1 },
          ],
          { duration: motion.duration, delay: motion.delay, easing, fill: "backwards" },
        );
        running.set(target, animation);
        const forget = () => {
          if (running.get(target) === animation) running.delete(target);
        };
        void animation.finished.then(forget, forget);
      }
    }, { rootMargin: "-48px 0px -64px" });

    // Keep compound cards and forms on one timeline, with their children in sync.
    for (const target of document.querySelectorAll(targetSelector)) {
      if (!target.parentElement?.closest(compoundSelector)) observer.observe(target);
    }

    const cancel = () => {
      for (const animation of running.values()) animation.cancel();
      running.clear();
    };
    const revealOnFocus = () => {
      for (const [target, animation] of running) {
        if (target.matches(":focus-within")) animation.cancel();
      }
    };
    reducedMotion.addEventListener("change", cancel);
    document.addEventListener("focusin", revealOnFocus);
    return () => {
      observer.disconnect();
      cancel();
      reducedMotion.removeEventListener("change", cancel);
      document.removeEventListener("focusin", revealOnFocus);
    };
  }, [pageKey, content]);
}
