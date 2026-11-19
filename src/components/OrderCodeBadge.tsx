"use client";

import React from "react";
import { formatDisplayOrderParts } from "@/lib/visualTitleParser";

interface OrderCodeBadgeProps {
  orderCode: string;
  scale?: number;
  variant?: "table" | "compact" | "pill";
}

/**
 * Muestra la numeración visible simplificada (sin 'f' ni cero inicial en decena)
 * destacando el número anterior al punto con mayor tamaño y peso.
 */
export function OrderCodeBadge({ orderCode, scale = 1, variant = "table" }: OrderCodeBadgeProps) {
  const parts = formatDisplayOrderParts(orderCode);
  if (!parts) return null;

  if (variant === "pill") {
    return (
      <span
        className="shrink-0 px-1 py-0.2 rounded font-mono bg-[#3B2D6B]/60 border border-[#A78BFA]/70 text-[#C4B5FD] inline-flex items-baseline"
        title={`Fase / Orden: ${parts.full} (${orderCode})`}
      >
        <span className="text-[11px] leading-none font-black text-[#EDE9FE]">{parts.major}</span>
        {parts.minor && <span className="text-[8.5px] leading-none font-semibold text-[#C4B5FD]/90">{parts.minor}</span>}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span
        className="shrink-0 font-extrabold font-mono tracking-tight text-[#C4B5FD] inline-flex items-baseline"
        title={`Fase / orden: ${parts.full} (${orderCode})`}
      >
        <span style={{ fontSize: `${Math.max(12, 12.5 * scale).toFixed(1)}px`, lineHeight: 1 }} className="font-black text-[#EDE9FE]">
          {parts.major}
        </span>
        {parts.minor && (
          <span style={{ fontSize: `${Math.max(9.5, 9.5 * scale).toFixed(1)}px`, lineHeight: 1 }} className="font-semibold text-[#A78BFA]">
            {parts.minor}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className="shrink-0 font-mono tracking-tight text-[#C4B5FD] inline-flex items-baseline"
      title={`Fase / orden: ${parts.full} (${orderCode})`}
    >
      <span style={{ fontSize: `${Math.max(12.5, 13.5 * scale).toFixed(1)}px`, lineHeight: 1 }} className="font-black text-[#EDE9FE]">
        {parts.major}
      </span>
      {parts.minor && (
        <span style={{ fontSize: `${Math.max(9.5, 10.5 * scale).toFixed(1)}px`, lineHeight: 1 }} className="font-semibold text-[#A78BFA]/90">
          {parts.minor}
        </span>
      )}
    </span>
  );
}
