import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  dismissible = true,
}: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onOpenChange);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onOpenChange;
    dismissibleRef.current = dismissible;
  }, [onOpenChange, dismissible]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissibleRef.current) onCloseRef.current(false);
      if (event.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ) ?? []);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[70] flex px-3 transition-opacity duration-200",
        isDesktop ? "items-center justify-center bg-black/38 py-6 backdrop-blur-[4px]" : "items-end justify-center bg-black/22 pt-12 backdrop-blur-[2px]",
      )}
      onClick={() => { if (dismissible) onOpenChange(false); }}
    >
      <div
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative flex w-full flex-col overflow-hidden border border-border bg-canvas-alt shadow-float outline-none",
          isDesktop
            ? "max-w-xl max-h-[88vh] rounded-[28px]"
            : "max-h-[86vh] rounded-t-[28px] border-b-0",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {!isDesktop ? (
          <div className="flex shrink-0 justify-center pt-3">
            <span className="h-1.5 w-14 rounded-full bg-ink/15" />
          </div>
        ) : null}
        <div className={cn("min-h-0 overflow-y-auto", isDesktop ? "p-7" : "px-5 pb-5 pt-4")}>
          <div className="pr-10">
            <div id={titleId} className="font-display text-3xl leading-tight text-ink">
              {title}
            </div>
            {description ? (
              <div id={descriptionId} className="mt-2 text-sm leading-6 text-ink-muted">
                {description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={!dismissible}
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-canvas/76 text-xl font-semibold leading-none text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
          >
            ×
          </button>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
