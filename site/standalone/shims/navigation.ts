/** Stands in for `next/navigation` in the single-file build. */
import { navigate, useRoute } from '../router';

export function useRouter() {
  return {
    push: navigate,
    replace: navigate,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => {},
    prefetch: () => {},
  };
}

export function usePathname(): string {
  return useRoute().path;
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(useRoute().search);
}
