import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PerformanceData {
  subject: string;
  classAverage: number;
  schoolAverage: number;
}

export function PerformanceChart() {
  const { data, isLoading } = useQuery<PerformanceData[]>({
    queryKey: ["/api/class-performance"],
    enabled: false, // Disabled for now until API endpoint is implemented
  });

  if (isLoading) {
    return <PerformanceChartSkeleton />;
  }

  const chartData = data ?? [];

  // Honest empty state — no fabricated benchmark data until the API exists.
  if (chartData.length === 0) {
    return (
      <div className="flex h-[320px] w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
        <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No performance data yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Benchmarks appear once tests are graded.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} barGap={8}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E6E0D4" vertical={false} />
          <XAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: "#6B6A68", fontWeight: 600 }}
            tickLine={false}
            axisLine={{ stroke: "#E6E0D4" }}
            dy={10}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6B6A68", fontWeight: 600 }}
            tickLine={false}
            axisLine={{ stroke: "#E6E0D4" }}
            domain={[0, 100]}
          />
          <Tooltip
            cursor={{ fill: "#FFF9F0", opacity: 0.4 }}
            contentStyle={{
              backgroundColor: "#FFF9F0",
              border: "1px solid #E6E0D4",
              borderRadius: "1rem",
              boxShadow: "0 4px 20px -4px rgba(0,0,0,0.1)",
              fontSize: "12px",
              padding: "12px",
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{
              paddingBottom: 20,
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          />
          <Bar
            dataKey="classAverage"
            name="Your Class"
            fill="#CC7B5C"
            radius={[6, 6, 0, 0]}
            barSize={32}
          />
          <Bar
            dataKey="schoolAverage"
            name="School Avg"
            fill="#C4C2BB"
            radius={[6, 6, 0, 0]}
            barSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PerformanceChartSkeleton() {
  return (
    <div className="h-[300px] w-full">
      <Skeleton className="h-full w-full" />
    </div>
  );
}
