'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { DURATION, EASE, useMotionOK } from '../lib/motion';

/**
 * The opening sequence — the kitchen coming to life before the first plate.
 *
 * A ring draws itself the way a wok is wiped clean, steam rises through it on
 * a canvas, and the whole panel lifts away like a lid. It runs once per
 * session and can be dismissed at any point: an opening a visitor cannot skip
 * is a door that sticks.
 */

const SESSION_KEY = 'imjai-intro-seen';

/** How long the panel stays before lifting, in ms. */
const HOLD_MS = 1900;

/**
 * Whether the opening plays lives outside React.
 *
 * It is decided once, from sessionStorage, and never changes back — which is
 * exactly the shape useSyncExternalStore wants. Holding it in component state
 * would mean setting that state from an effect on first paint, and the panel
 * would flash in after the page had already drawn.
 */
let decided = false;
let visible = false;
const listeners = new Set<() => void>();

function bootSnapshot(): boolean {
  if (!decided) {
    decided = true;
    try {
      visible = sessionStorage.getItem(SESSION_KEY) !== '1';
    } catch {
      // Private browsing can refuse storage; playing the opening once more is
      // a smaller cost than failing to render the shell.
      visible = true;
    }
  }
  return visible;
}

/**
 * The server cannot read the session, so it always renders the opening —
 * that way it is painted with the first HTML instead of appearing a beat
 * later. A returning visitor never sees it: the inline guard in the document
 * head hides it with CSS before paint, and React drops it at hydration.
 */
const serverSnapshot = () => true;

function subscribeBoot(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function dismissBoot() {
  if (!visible) return;
  visible = false;
  for (const listener of listeners) listener();
}

type Steam = { x: number; y: number; radius: number; life: number; drift: number; speed: number };

/**
 * Soft plumes rising through the ring.
 *
 * Drawn rather than animated in CSS because steam should never loop visibly —
 * each plume is seeded independently and dies at a different height, which is
 * what keeps it reading as vapour instead of a spinner.
 */
function useSteamCanvas(active: boolean, motionOK: boolean) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !active || !motionOK) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);

    const seed = (): Steam => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.42,
      y: height + Math.random() * 40,
      radius: 16 + Math.random() * 30,
      life: 0,
      drift: (Math.random() - 0.5) * 0.35,
      speed: 0.5 + Math.random() * 0.75,
    });

    const plumes: Steam[] = Array.from({ length: 34 }, () => {
      const plume = seed();
      // Stagger the start so the field is already full on the first frame.
      plume.life = Math.random();
      plume.y = height - plume.life * height;
      return plume;
    });

    let frame = 0;
    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (const plume of plumes) {
        plume.y -= plume.speed;
        plume.x += plume.drift;
        plume.life += 0.0055;
        plume.radius += 0.22;

        if (plume.life >= 1 || plume.y + plume.radius < 0) Object.assign(plume, seed());

        // Fades in over the first fifth of its life, then thins out.
        const fade = plume.life < 0.2 ? plume.life / 0.2 : 1 - (plume.life - 0.2) / 0.8;
        const gradient = context.createRadialGradient(plume.x, plume.y, 0, plume.x, plume.y, plume.radius);
        gradient.addColorStop(0, `rgba(255, 253, 248, ${0.52 * fade})`);
        gradient.addColorStop(0.55, `rgba(255, 246, 234, ${0.18 * fade})`);
        gradient.addColorStop(1, 'rgba(255, 253, 248, 0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(plume.x, plume.y, plume.radius, 0, Math.PI * 2);
        context.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, motionOK]);

  return ref;
}

export function BootScreen() {
  const motionOK = useMotionOK();
  const showing = useSyncExternalStore(subscribeBoot, bootSnapshot, serverSnapshot);
  const canvasRef = useSteamCanvas(showing, motionOK);

  // Mark the session as having seen it, and lift the panel on its own.
  useEffect(() => {
    if (!showing) return;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // Nothing to do: the opening simply plays again next time.
    }
    const timer = window.setTimeout(dismissBoot, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [showing]);

  // Any keypress leaves, so the sequence never traps keyboard users.
  useEffect(() => {
    if (!showing) return;
    window.addEventListener('keydown', dismissBoot);
    return () => window.removeEventListener('keydown', dismissBoot);
  }, [showing]);

  const seconds = motionOK ? DURATION.cinematic : 0.01;

  return (
    <AnimatePresence>
      {showing && (
        <motion.div
          className="boot"
          role="presentation"
          onClick={dismissBoot}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: '-6%', transition: { duration: motionOK ? 0.62 : 0.01, ease: EASE.exit } }}
        >
          <canvas ref={canvasRef} className="boot-steam" aria-hidden />

          <div className="boot-stage">
            <svg className="boot-ring" viewBox="0 0 120 120" aria-hidden>
              <motion.circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                pathLength={1}
                initial={{ pathLength: 0, opacity: 0.2 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: seconds * 0.8, ease: EASE.move }}
              />
            </svg>

            <motion.b
              className="boot-word"
              initial={{ opacity: 0, y: 14, letterSpacing: '0.3em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0.02em' }}
              transition={{ duration: seconds * 0.6, delay: seconds * 0.16, ease: EASE.enter }}
            >
              อิ่มใจ
            </motion.b>
          </div>

          <motion.small
            className="boot-tagline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: seconds * 0.4, delay: seconds * 0.42 }}
          >
            มื้อธรรมดา ที่ทำให้ใจอิ่ม
          </motion.small>

          <motion.span
            className="boot-progress"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: HOLD_MS / 1000, ease: 'linear' }}
            aria-hidden
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
