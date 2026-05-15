import React, { useEffect, useRef, useState } from "react";

interface SpotlightState {
  type: "spotlight" | "laser";
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SpotlightOverlayProps {
  containerRef: React.RefObject<HTMLElement>;
  action: { name: string; params: Record<string, any> } | null;
}

export function SpotlightOverlay({ containerRef, action }: SpotlightOverlayProps) {
  const [state, setState] = useState<SpotlightState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!action) return;
    if (action.name !== "spotlight" && action.name !== "laser") return;

    const container = containerRef.current;
    if (!container) return;

    const elementId = action.params?.elementId;
    let rect: DOMRect | null = null;

    if (elementId) {
      const target = container.querySelector(`[data-element-id="${elementId}"]`) ||
                     container.querySelector(`#${CSS.escape(elementId)}`);
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        rect = new DOMRect(
          targetRect.left - containerRect.left,
          targetRect.top - containerRect.top,
          targetRect.width,
          targetRect.height
        );
      }
    }

    if (!rect) {
      const containerRect = container.getBoundingClientRect();
      rect = new DOMRect(
        containerRect.width / 2 - 40,
        containerRect.height / 2 - 40,
        80,
        80
      );
    }

    const newState = {
      type: action.name as "spotlight" | "laser",
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    };
    queueMicrotask(() => setState(newState));

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState(null), action.name === "laser" ? 1500 : 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [action, containerRef]);

  if (!state) return null;

  const padding = 8;
  const x = state.x - padding;
  const y = state.y - padding;
  const w = state.w + padding * 2;
  const h = state.h + padding * 2;

  if (state.type === "laser") {
    return (
      <div
        className="pointer-events-none absolute z-30"
        style={{
          left: state.x + state.w / 2 - 6,
          top: state.y + state.h / 2 - 6,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "rgba(220,38,38,0.85)",
          boxShadow: "0 0 8px 4px rgba(220,38,38,0.4)",
          animation: "laserPulse 0.4s ease-out",
        }}
      />
    );
  }

  return (
    <div
      className="pointer-events-none absolute z-30 rounded-md"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        border: "2.5px solid rgba(99,102,241,0.9)",
        boxShadow: "0 0 0 4000px rgba(0,0,0,0.35), 0 0 12px rgba(99,102,241,0.5)",
        animation: "spotlightIn 0.25s ease-out",
      }}
    />
  );
}
