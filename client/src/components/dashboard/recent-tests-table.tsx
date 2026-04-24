import { Link } from "wouter";
import { Check, Clock, FileText, X } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Test {
  id: number;
  title: string;
  subject: string;
  class: string;
  testDate: string | Date;
  status: string;
  completionRate?: number;
  averageScore?: number;
}

interface RecentTestsTableProps {
  data?: Test[];
}

export function RecentTestsTable({ data }: RecentTestsTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center shadow">
        <p className="mb-4 text-muted-foreground">No tests available</p>
        <Link href="/create-test">
          <Button>Create your first test</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Test</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Completion</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((test) => (
            <TableRow key={test.id}>
              <TableCell>
                <div className="font-medium">{test.title}</div>
                <div className="text-xs text-muted-foreground">{test.subject}</div>
              </TableCell>
              <TableCell>{test.class}</TableCell>
              <TableCell>
                {new Date(test.testDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <TestStatusBadge status={test.status} />
              </TableCell>
              <TableCell>
                {test.status !== "scheduled" && test.status !== "draft" ? (
                  <div className="w-full max-w-[100px]">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs">{test.completionRate || 0}%</span>
                      {test.status === "completed" && (
                        <span className="text-xs">Avg: {test.averageScore || 0}%</span>
                      )}
                    </div>
                    <Progress value={test.completionRate || 0} className="h-2" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Not started</span>
                )}
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/tests/${test.id}`} className="flex items-center">
                    <FileText className="mr-1 h-4 w-4" />
                    View
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TestStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
        >
          <Check className="mr-1 h-3 w-3" />
          Completed
        </Badge>
      );
    case "published":
    case "in-progress":
      return (
        <Badge
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Clock className="mr-1 h-3 w-3" />
          In Progress
        </Badge>
      );
    case "scheduled":
      return (
        <Badge
          variant="outline"
          className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
        >
          <Clock className="mr-1 h-3 w-3" />
          Scheduled
        </Badge>
      );
    case "canceled":
      return (
        <Badge
          variant="outline"
          className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <X className="mr-1 h-3 w-3" />
          Canceled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
