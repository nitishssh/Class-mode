import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface WidgetRendererProps {
  scene: {
    type: string;
    content: any;
  };
  action?: { name: string; params: Record<string, any> } | null;
  className?: string;
}

export function WidgetRenderer({ scene, action, className }: WidgetRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const content = scene.content;

  // Send widget_* action messages into the iframe
  useEffect(() => {
    if (!action || !iframeRef.current) return;
    if (!action.name.startsWith("widget_")) return;

    iframeRef.current.contentWindow?.postMessage(
      { type: "widget_action", name: action.name, params: action.params },
      window.location.origin
    );
  }, [action]);

  // Determine HTML content to render
  const html = content?.html ?? content?.config?.html ?? null;

  if (html) {
    return (
      <iframe
        ref={iframeRef}
        title={scene.type}
        srcDoc={html}
        sandbox="allow-scripts allow-forms"
        className={cn("w-full rounded-lg border border-slate-700", className)}
        style={{ minHeight: 420 }}
      />
    );
  }

  // Fallback for JSON config widgets (display summary)
  const config = content?.config;
  if (config) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-300",
          className
        )}
      >
        <p className="mb-2 text-sm font-medium">{scene.type} widget</p>
        <pre className="max-h-64 overflow-auto text-xs text-slate-400">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-500",
        className
      )}
    >
      Widget content unavailable
    </div>
  );
}
