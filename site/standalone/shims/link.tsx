/** Stands in for `next/link` in the single-file build. */
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { navigate } from '../router';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  /** Accepted and ignored: there is nothing to prefetch in one file. */
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  // prefetch/replace/scroll are pulled out of `rest` on purpose: they mean
  // nothing here, and letting them through would put unknown attributes on the
  // <a> element and draw a React warning.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { href, prefetch, replace, scroll, onClick, children, ...rest },
  ref,
) {
  return (
    <a
      {...rest}
      ref={ref}
      // Real href keeps middle-click, copy-link and the status bar working.
      href={`#${href}`}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
});

export default Link;
