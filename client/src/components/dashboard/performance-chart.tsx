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
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/contexts/theme-context";

interface PerformanceData {
  subject: string;
  classAverage: number;
  schoolAverage: number;
}

export function PerformanceChart() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<PerformanceData[]>({
    queryKey: ["/api/class-performance"],
    enabled: false, // Disabled for now until API endpoint is implemented
  });

  // Mock data for UI demonstration
  const mockData: PerformanceData[] = [
    { subject: "Physics", classAverage: 78, schoolAverage: 72 },
    { subject: "Chemistry", classAverage: 82, schoolAverage: 76 },
    { subject: "Biology", classAverage: 85, schoolAverage: 79 },
    { subject: "Math", classAverage: 74, schoolAverage: 71 },
    { subject: "English", classAverage: 88, schoolAverage: 82 },
  ];

  if (isLoading) {
    return <PerformanceChartSkeleton />;
  }

  const chartData = data || mockData;

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
