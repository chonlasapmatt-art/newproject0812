'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { DURATION, EASE, paced, useMotionOK } from '../lib/motion';
import { dismissToast, useToasts, type Toast } from '../lib/toast';

const ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  error: TriangleAlert,
};

type ToastTone = Toast['tone'];

export function ToastStack() {
  const toasts = useToasts();
  const motionOK = useMotionOK();

  if (!toasts.length) return null;

  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICON[toast.tone];
          return (
            <motion.div
              key={toast.id}
              className={`toast toast-${toast.tone}`}
              role="status"
              // Errors interrupt a task in progress and should be announced
              // immediately; a success confirmation can wait its turn behind
              // whatever the screen reader is already saying.
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: paced(DURATION.quick, motionOK) } }}
              transition={{ duration: paced(DURATION.quick, motionOK), ease: EASE.enter }}
            >
              <Icon size={17} aria-hidden />
              <span>{toast.text}</span>
              <button type="button" onClick={() => dismissToast(toast.id)} aria-label="ปิดข้อความแจ้งเตือน">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
