"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

interface SmartBackButtonProps {
  fallbackHref: string;
  fallbackLabel?: string;
  className?: string;
  onBeforeBack?: () => boolean; // return false to prevent back navigation (e.g. if user cancels confirm)
}

export function SmartBackButton({
  fallbackHref,
  fallbackLabel = "Zurück",
  className = "text-text-muted hover:text-primary transition-colors flex items-center gap-1.5 text-sm font-medium cursor-pointer",
  onBeforeBack,
}: SmartBackButtonProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (onBeforeBack && !onBeforeBack()) {
      return;
    }

    if (typeof window !== "undefined") {
      const hasHistory = window.history.length > 1;
      const hasInternalReferrer =
        Boolean(document.referrer) &&
        document.referrer.includes(window.location.origin);

      if (hasHistory && hasInternalReferrer) {
        router.back();
        return;
      }
    }

    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      title={fallbackLabel}
    >
      <ArrowLeftIcon className="w-4 h-4 shrink-0" />
      <span>{fallbackLabel}</span>
    </button>
  );
}
