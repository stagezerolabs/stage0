import { useEffect, useId, type ReactNode } from "react";
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
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex px-3 transition-opacity duration-200",
        isDesktop ? "items-center justify-center bg-black/38 py-6 backdrop-blur-[4px]" : "items-end justify-center bg-black/22 pt-12 backdrop-blur-[2px]",
      )}
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative w-full overflow-hidden border border-border bg-canvas-alt shadow-float",
          isDesktop
            ? "max-w-xl max-h-[88vh] rounded-[28px]"
            : "max-h-[86vh] rounded-t-[28px] border-b-0",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {!isDesktop ? (
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-14 rounded-full bg-ink/15" />
          </div>
        ) : null}
        <div className={cn("overflow-y-auto", isDesktop ? "max-h-[88vh] p-7" : "max-h-[86vh] px-5 pb-5 pt-4")}>
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
