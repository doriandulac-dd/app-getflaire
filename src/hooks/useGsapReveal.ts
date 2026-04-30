import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

type RevealOptions = {
  selector?: string;
  x?: number;
  y?: number;
  duration?: number;
  stagger?: number;
  delay?: number;
  ease?: string;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useGsapReveal = <T extends HTMLElement>(
  dependencies: unknown[] = [],
  options: RevealOptions = {}
) => {
  const scope = useRef<T>(null);

  useGSAP(
    () => {
      if (!scope.current) return;

      const selector = options.selector || '[data-gsap-reveal]';
      const targets = gsap.utils.toArray<HTMLElement>(selector, scope.current);

      if (!targets.length) return;

      if (prefersReducedMotion()) {
        gsap.set(targets, { autoAlpha: 1, clearProps: 'transform' });
        return;
      }

      gsap.fromTo(
        targets,
        {
          autoAlpha: 0,
          x: options.x ?? 0,
          y: options.y ?? 14,
        },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          delay: options.delay ?? 0,
          duration: options.duration ?? 0.55,
          stagger: options.stagger ?? 0.06,
          ease: options.ease ?? 'power3.out',
          clearProps: 'transform,opacity,visibility',
        }
      );
    },
    { scope, dependencies, revertOnUpdate: true }
  );

  return scope;
};
