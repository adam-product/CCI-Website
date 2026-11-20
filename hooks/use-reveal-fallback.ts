"use client";

import { useEffect } from "react";
import type { Content } from "../lib/content";

export function useRevealFallback(pageKey: string, content: Content[]) {
  useEffect(() => {
    if (
      (CSS.supports("animation-timeline", "view()") &&
        CSS.supports("animation-range", "cover 0% cover 17%")) ||
      !window.IntersectionObserver ||
      !Element.prototype.animate
    )
      return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map<Element, Animation>();
    const outside = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, boundingClientRect, isIntersecting } of entries) {
          if (!isIntersecting) {
            outside.add(target);
            animations.get(target)?.cancel();
            continue;
          }
          if (
            !outside.delete(target) ||
            preference.matches ||
            target.matches(":focus-within")
          )
            continue;

          // Replay at either edge, and skip elements jumped to in mid-viewport.
          const fromAbove = boundingClientRect.bottom < 90;
          if (!fromAbove && boundingClientRect.top < window.innerHeight - 90)
            continue;

          const distance = target.matches("h1, h2, h3, h4") ? 22 : 14;
          animations.get(target)?.cancel();
          const animation = target.animate(
            [
              {
                opacity: fromAbove ? 0.7 : 0.58,
                translate: `0 ${fromAbove ? -distance * 0.6 : distance}px`,
              },
              { opacity: 1, translate: "none" },
            ],
            { duration: 560, easing: "cubic-bezier(.22,.65,.32,1)" },
          );
          animations.set(target, animation);
          const forget = () => {
            if (animations.get(target) === animation) animations.delete(target);
          };
          animation.finished.then(forget, forget);
        }
      },
      { rootMargin: "40px 0px" },
    );

    document
      .querySelectorAll(
        `#main section :is(.eyebrow, h1, h2, h3, h4, p, .breadcrumb, .button, .text-link,
          .initiative-card, .section-image, .editorial-photo,
          .editorial-hero-art:not(.editorial-hero-impact *, .contact-hero-photo), .detail-mascot,
          .lotus-detail-art, .feature-grid > article, .journey article, .partner-grid > li,
          .testimonial-grid > blockquote, .values-panel > div, .metrics-grid > article):not(:where(
          .photo-hero *, .contact-form *, .initiative-card *, .feature-grid article *, .journey article *,
          .testimonial-grid blockquote *, .values-panel > div *, .metrics-grid article *)),
          #main .contact-form > h2, #main > .page-cover, .footer-main > *`,
      )
      .forEach((element) => observer.observe(element));

    const cancel = () => {
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
    };
    const revealOnFocus = () => {
      for (const [target, animation] of animations)
        if (target.matches(":focus-within")) animation.cancel();
    };
    preference.addEventListener("change", cancel);
    document.addEventListener("focusin", revealOnFocus);
    return () => {
      observer.disconnect();
      cancel();
      preference.removeEventListener("change", cancel);
      document.removeEventListener("focusin", revealOnFocus);
    };
  }, [pageKey, content]);
}
