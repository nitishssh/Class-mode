import React, { useEffect, useState, useCallback } from "react";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";

// ── Types ───────────────────────────────────────────────────────────────────

type WbElementType =
  | "text"
  | "shape"
  | "latex"
  | "table"
  | "line"
  | "code"
  | "chart_placeholder";

interface WbElement {
  id: string;
  type: WbElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  // text
  content?: string;
  fontSize?: number;
  color?: string;
  // shape
  shape?: "rectangle" | "circle" | "ellipse" | "triangle";
  fill?: string;
  stroke?: string;
  // latex
  latex?: string;
  // table
  data?: string[][];
  // line
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  arrow?: boolean;
  // code
  code?: string;
  language?: string;
  // chart
  chartType?: "bar" | "line" | "pie";
  chartData?: { labels: string[]; values: number[]; seriesName?: string };
}

// ── Coordinate system: 0-1000 × 0-562 (16:9) ──────────────────────────────

const WB_W = 1000;
const WB_H = 562;

// ── Sub-renderers ──────────────────────────────────────────────────────────

function TextElement({ el }: { el: WbElement }) {
  return (
    <foreignObject x={el.x} y={el.y} width={el.width ?? 400} height={el.height ?? 60}>
      <div
        style={{
          fontSize: el.fontSize ?? 20,
          color: el.color ?? "#e5e7eb",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {el.content}
      </div>
    </foreignObject>
  );
}

function ShapeElement({ el }: { el: WbElement }) {
  const fill = el.fill ?? "rgba(99,102,241,0.25)";
  const stroke = el.stroke ?? "#818cf8";
  const w = el.width ?? 120;
  const h = el.height ?? 80;

  if (el.shape === "circle" || el.shape === "ellipse") {
    return (
      <ellipse
        cx={el.x + w / 2}
        cy={el.y + h / 2}
        rx={w / 2}
        ry={h / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
    );
  }
  if (el.shape === "triangle") {
    const pts = `${el.x + w / 2},${el.y} ${el.x},${el.y + h} ${el.x + w},${el.y + h}`;
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={2} />;
  }
  return (
    <rect x={el.x} y={el.y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={2} rx={4} />
  );
}

function LatexElement({ el }: { el: WbElement }) {
  return (
    <foreignObject x={el.x} y={el.y} width={el.width ?? 500} height={el.height ?? 80}>
      <div
        style={{ color: "#e5e7eb", fontSize: 20, padding: "4px 8px" }}
      >
        <BlockMath math={el.latex ?? ""} />
      </div>
    </foreignObject>
  );
}

function TableElement({ el }: { el: WbElement }) {
  const rows = el.data ?? [["A", "B"], ["1", "2"]];
  const w = el.width ?? Math.max(300, rows[0]?.length * 100);
  const h = el.height ?? Math.max(80, rows.length * 32);

  return (
    <foreignObject x={el.x} y={el.y} width={w} height={h}>
      <table
        style={{
          borderCollapse: "collapse",
          color: "#e5e7eb",
          fontSize: 14,
          width: "100%",
        }}
      >
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    border: "1px solid #4b5563",
                    padding: "4px 8px",
                    background: ri === 0 ? "#1e293b" : "transparent",
                    fontWeight: ri === 0 ? 600 : 400,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </foreignObject>
  );
}

function LineElement({ el }: { el: WbElement }) {
  const x1 = el.startX ?? el.x;
  const y1 = el.startY ?? el.y;
  const x2 = el.endX ?? el.x + 100;
  const y2 = el.endY ?? el.y;
  const color = el.color ?? "#818cf8";

  const markerId = `arrow-${el.id}`;
  return (
    <g>
      {el.arrow && (
        <defs>
          <marker
            id={markerId}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={color} />
          </marker>
        </defs>
      )}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        markerEnd={el.arrow ? `url(#${markerId})` : undefined}
      />
    </g>
  );
}

function CodeElement({ el }: { el: WbElement }) {
  const lines = (el.code ?? "").split("\n");
  const w = el.width ?? 480;
  const h = Math.max(80, lines.length * 20 + 28);

  return (
    <foreignObject x={el.x} y={el.y} width={w} height={h}>
      <div
        style={{
          background: "#0f172a",
          borderRadius: 6,
          border: "1px solid #334155",
          overflow: "hidden",
          height: "100%",
        }}
      >
        <div
          style={{
            background: "#1e293b",
            padding: "3px 10px",
            fontSize: 11,
            color: "#94a3b8",
            borderBottom: "1px solid #334155",
          }}
        >
          {el.language ?? "code"}
        </div>
        <pre
          style={{
            margin: 0,
            padding: "6px 10px",
            fontSize: 13,
            fontFamily: "monospace",
            color: "#e2e8f0",
            whiteSpace: "pre",
            overflowX: "auto",
          }}
        >
          {el.code}
        </pre>
      </div>
    </foreignObject>
  );
}

function ChartPlaceholder({ el }: { el: WbElement }) {
  const d = el.chartData;
  const w = el.width ?? 300;
  const h = el.height ?? 180;
  if (!d || !d.labels.length) {
    return (
      <foreignObject x={el.x} y={el.y} width={w} height={h}>
        <div
            style={{ color: "#94a3b8", fontSize: 13, padding: 8 }}
        >
          [{el.chartType ?? "chart"}]
        </div>
      </foreignObject>
    );
  }

  if (el.chartType === "pie") {
    const total = d.values.reduce((a, b) => a + b, 0) || 1;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 20;
    const colors = ["#818cf8", "#34d399", "#fb923c", "#f472b6", "#60a5fa"];
    const cumAngles = d.values.reduce<number[]>((acc, v) => {
      acc.push((acc[acc.length - 1] ?? -Math.PI / 2) + (v / total) * 2 * Math.PI);
      return acc;
    }, []);
    const slices = d.values.map((v, i) => {
      const start = i === 0 ? -Math.PI / 2 : cumAngles[i - 1];
      const end = cumAngles[i];
      const sweep = end - start;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const large = sweep > Math.PI ? 1 : 0;
      return { path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, color: colors[i % colors.length], label: d.labels[i] };
    });

    return (
      <g>
        <rect x={el.x} y={el.y} width={w} height={h} fill="#1e293b" rx={4} />
        <g transform={`translate(${el.x},${el.y})`}>
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} stroke="#1e293b" strokeWidth={1} />
          ))}
        </g>
      </g>
    );
  }

  // Bar chart fallback
  const barW = (w - 20) / d.labels.length - 4;
  const maxVal = Math.max(...d.values, 1);
  return (
    <g>
      <rect x={el.x} y={el.y} width={w} height={h} fill="#1e293b" rx={4} />
      {d.values.map((v, i) => {
        const bh = ((v / maxVal) * (h - 40));
        const bx = el.x + 10 + i * (barW + 4);
        const by = el.y + h - 25 - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={bh} fill="#818cf8" rx={2} />
            <text x={bx + barW / 2} y={el.y + h - 8} textAnchor="middle" fill="#94a3b8" fontSize={10}>
              {d.labels[i]?.slice(0, 6)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface WhiteboardCanvasProps {
  isOpen: boolean;
  action?: { name: string; params: Record<string, any> } | null;
  onClose: () => void;
  className?: string;
}

export function WhiteboardCanvas({ isOpen, action, onClose, className }: WhiteboardCanvasProps) {
  const [elements, setElements] = useState<WbElement[]>([]);

  const dispatch = useCallback((name: string, params: Record<string, any>) => {
    setElements((prev) => {
      switch (name) {
        case "wb_clear":
          return [];
        case "wb_delete": {
          const id = params.elementId;
          return id ? prev.filter((e) => e.id !== id) : prev;
        }
        case "wb_draw_text":
          return [
            ...prev,
            {
              id: nanoid(6),
              type: "text",
              x: params.x ?? 50,
              y: params.y ?? 50,
              width: params.width ?? 400,
              content: params.content ?? "",
              fontSize: params.fontSize ?? 20,
              color: params.color ?? "#e5e7eb",
            },
          ];
        case "wb_draw_shape":
          return [
            ...prev,
            {
              id: nanoid(6),
              type: "shape",
              x: params.x ?? 100,
              y: params.y ?? 100,
              width: params.width ?? 120,
              height: params.height ?? 80,
              shape: params.shape ?? "rectangle",
              fill: params.fill,
              stroke: params.stroke,
            },
          ];
        case "wb_draw_latex":
          return [
            ...prev,
            {
              id: nanoid(6),
              type: "latex",
              x: params.x ?? 50,
              y: params.y ?? 50,
              width: params.width ?? 500,
              height: params.height ?? 80,
              latex: params.latex ?? "",
            },
          ];
        case "wb_draw_table":
          return [
            ...prev,
            {
              id: nanoid(6),
              type: "table",
              x: params.x ?? 50,
              y: params.y ?? 50,
              width: params.width,
              height: params.height,
              data: params.data ?? [["A", "B"]],
            },
          ];
        case "wb_draw_line":
          return [
            ...prev,
            {
              id: nanoid(6),
              type: "line",
              x: params.startX ?? 50,
              y: params.startY ?? 50,
              startX: params.startX ?? 50,
              startY: params.startY ?? 50,
              endX: params.endX ?? 200,
              endY: params.endY ?? 200,
              arrow: params.arrow ?? true,
              color: params.color ?? "#818cf8",
            },
          ];
        case "wb_draw_code":
          return [
            ...prev,
            {
              id: nanoid(6),
              type: "code",
              x: params.x ?? 50,
              y: params.y ?? 50,
              width: params.width ?? 480,
              code: params.code ?? "",
              language: params.language ?? "code",
            },
          ];
        case "wb_edit_code": {
          const { elementId, op, lineIndex, lines: newLines = [] } = params;
          return prev.map((el) => {
            if (el.id !== elementId || el.type !== "code") return el;
            const codeLines = (el.code ?? "").split("\n");
            if (op === "insert_after") {
              codeLines.splice(lineIndex + 1, 0, ...newLines);
            } else if (op === "insert_before") {
              codeLines.splice(lineIndex, 0, ...newLines);
            } else if (op === "replace_lines") {
              codeLines.splice(lineIndex, newLines.length, ...newLines);
            } else if (op === "delete_lines") {
              codeLines.splice(lineIndex, newLines.length || 1);
            }
            return { ...el, code: codeLines.join("\n") };
          });
        }
        case "wb_draw_chart":
          return [
            ...prev,
            {
              id: nanoid(6),
              type: "chart_placeholder",
              x: params.x ?? 50,
              y: params.y ?? 50,
              width: params.width ?? 300,
              height: params.height ?? 180,
              chartType: params.chartType ?? "bar",
              chartData: params.data
                ? { labels: params.data.labels ?? [], values: params.data.values ?? [], seriesName: params.data.seriesName }
                : undefined,
            },
          ];
        default:
          return prev;
      }
    });
  }, []);

  useEffect(() => {
    if (!action) return;
    if (action.name.startsWith("wb_") && action.name !== "wb_open" && action.name !== "wb_close") {
      queueMicrotask(() => dispatch(action.name, action.params ?? {}));
    }
  }, [action, dispatch]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "relative bg-slate-900 rounded-lg border border-slate-700 overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-medium text-slate-300">Whiteboard</span>
        <div className="flex gap-1">
          <button
            onClick={() => setElements([])}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
            title="Clear"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WB_W} ${WB_H}`}
        className="w-full"
        style={{ aspectRatio: `${WB_W}/${WB_H}`, background: "#0f172a" }}
      >
        {elements.map((el) => {
          switch (el.type) {
            case "text":
              return <TextElement key={el.id} el={el} />;
            case "shape":
              return <ShapeElement key={el.id} el={el} />;
            case "latex":
              return <LatexElement key={el.id} el={el} />;
            case "table":
              return <TableElement key={el.id} el={el} />;
            case "line":
              return <LineElement key={el.id} el={el} />;
            case "code":
              return <CodeElement key={el.id} el={el} />;
            case "chart_placeholder":
              return <ChartPlaceholder key={el.id} el={el} />;
            default:
              return null;
          }
        })}
      </svg>
    </div>
  );
}
