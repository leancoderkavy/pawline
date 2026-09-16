"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const openDialogs = new Set();

export default function Dialog({ title, children, onClose, centered = false }) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = `dialog-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    openDialogs.add(dialog);
    const isTopDialog = () => [...document.querySelectorAll("[data-pawline-dialog]")].at(-1) === dialog;
    const focusable = () => [...dialog.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter(element => !element.disabled && element.getClientRects().length);
    if (isTopDialog()) focusable()[0]?.focus();

    const handleKeyDown = event => {
      if (!isTopDialog() || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.classList.add("dialog-open");
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      openDialogs.delete(dialog);
      if (!openDialogs.size) document.body.classList.remove("dialog-open");
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(<div className={`overlay${centered ? " overlay-centered" : ""}`} onMouseDown={onClose}>
    <div ref={dialogRef} data-pawline-dialog className="dialog" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="dialog-head"><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog"><X /></button></div>
      {children}
    </div>
  </div>, document.body);
}
