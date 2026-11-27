"use client";

import { useEffect, useRef } from "react";
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
const copySelector = [
  ".intro > div",
  ".section-heading > div",
  ".impact-preview > div",
  ".coverage-copy",
  ".custom-section-copy",
  ".editorial-sections article > div",
  ".closing > div",
].join(", ");
const headingSelector = "h2, h3, h4, .eyebrow";
const targetSelector = `#main :is(${headingSelector}, p, .button, .text-link,
  ${cardSelector}, ${visualSelector}, ${panelSelector}, ${copySelector}),
  .footer-main > *, .footer-bottom`;
const groupSelector = `${cardSelector}, ${visualSelector}, ${panelSelector}, ${copySelector}`;
const heroCopySelector = ".photo-hero, .editorial-hero-copy, .initiative-detail > div:first-child, .page-hero:not(.initiative-detail, .photo-hero)";

function entranceOffset(
  target: Element,
  bounds: DOMRect,
  width: number,
  fromAbove: boolean,
) {
  if (!target.matches(cardSelector)) {
    const center = (bounds.left + bounds.right) / 2;
    const startOnLeft = Math.abs(center - width / 2) > width * 0.05
      ? center < width / 2
      : target.matches(headingSelector) || !!target.querySelector("h2");
    const room = startOnLeft ? bounds.left : width - bounds.right;
    const distance = Math.min(width < 640 ? 14 : 30, room - 2);
    if (distance >= 6) return `${startOnLeft ? -distance : distance}px 0px`;
  }
  const lift = width < 640 ? 12 : 18;
  return `0px ${fromAbove ? -lift : lift}px`;
}

export function useScrollReveal(pageKey: string, content: Content[]) {
  const register = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!window.IntersectionObserver || !Element.prototype.animate) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const registered = new WeakSet<Element>();
    const animations = new Map<Element, Animation>();
    let layoutWidth = document.documentElement.clientWidth;
    const observer = new IntersectionObserver((entries) => {
      const rowSteps = new Map<Element, number>();
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);
        const animation = animations.get(target);
        if (!animation) continue;
        if (reducedMotion.matches || target.matches(":focus-within")) {
          animation.cancel();
          continue;
        }
        const parent = target.parentElement;
        if (parent && target.matches(cardSelector)) {
          const step = rowSteps.get(parent) ?? 0;
          animation.effect?.updateTiming({ delay: Math.min(step, 3) * 42 });
          rowSteps.set(parent, step + 1);
        }
        animation.play();
      }
    });

    register.current = () => {
      if (reducedMotion.matches) return;
      for (const [target, animation] of animations) {
        if (target.isConnected) continue;
        observer.unobserve(target);
        animation.cancel();
      }
      const height = window.innerHeight;
      const offscreen: { target: Element; offset: string }[] = [];
      for (const target of document.querySelectorAll(targetSelector)) {
        if (registered.has(target)) continue;
        registered.add(target);
        if (target.closest(heroCopySelector) || target.parentElement?.closest(groupSelector)) continue;
        const bounds = target.getBoundingClientRect();
        const fromAbove = bounds.bottom < -24;
        if (!bounds.height || (!fromAbove && bounds.top < height + 24)) continue;
        offscreen.push({ target, offset: entranceOffset(target, bounds, layoutWidth, fromAbove) });
      }
      // Position elements before they are visible, and keep their opacity constant.
      for (const { target, offset } of offscreen) {
        const animation = target.animate(
          [{ translate: offset }, { translate: "0px 0px" }],
          { duration: 680, easing: "cubic-bezier(0.25, 0.7, 0.3, 1)", fill: "backwards" },
        );
        animation.pause();
        animation.currentTime = 0;
        animations.set(target, animation);
        const forget = () => animations.delete(target);
        void animation.finished.then(forget, forget);
        observer.observe(target);
      }
    };

    const settle = () => {
      observer.disconnect();
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
    };
    const revealOnFocus = () => {
      for (const [target, animation] of animations) {
        if (!target.matches(":focus-within")) continue;
        observer.unobserve(target);
        animation.cancel();
      }
    };
    const settleOnWidthChange = () => {
      const width = document.documentElement.clientWidth;
      if (width === layoutWidth) return;
      layoutWidth = width;
      settle();
    };
    reducedMotion.addEventListener("change", settle);
    document.addEventListener("focusin", revealOnFocus);
    window.addEventListener("resize", settleOnWidthChange);
    return () => {
      register.current = null;
      settle();
      reducedMotion.removeEventListener("change", settle);
      document.removeEventListener("focusin", revealOnFocus);
      window.removeEventListener("resize", settleOnWidthChange);
    };
  }, [pageKey]);

  useEffect(() => {
    register.current?.();
  }, [pageKey, content]);
}
