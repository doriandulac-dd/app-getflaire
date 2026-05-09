import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);
gsap.defaults({
  duration: 0.55,
  ease: 'power2.out',
});

type RevealOptions = {
  duration?: number;
  y?: number;
};

export const revealUp = (target: gsap.TweenTarget, options: RevealOptions = {}) =>
  gsap.fromTo(
    target,
    { autoAlpha: 0, y: options.y ?? 18 },
    {
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? 0.55,
      ease: 'power2.out',
      clearProps: 'transform',
    }
  );

export { gsap };
