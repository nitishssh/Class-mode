import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface StudyPlan {
  plan: string;
  resources: Array<{
    title: string;
    type: string;
    url?: string;
  }>;
}

export default function StudyPlanPage() {
  const [testId, setTestId] = useState("");
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateStudyPlan = async () => {
    if (!testId) {
      toast({
        title: "Test ID is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setStudyPlan(null);

    try {
      const response = await fetch("/api/study-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ testId: parseInt(testId) }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate study plan");
      }

      const data = await response.json();
      setStudyPlan(data);
    } catch (error) {
      toast({
        title: "Error generating study plan",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Personalized Study Plan</h1>
      <p className="text-muted-foreground">
        Enter a test ID to generate a personalized study plan based on your performance.
      </p>
      <div className="flex w-full max-w-sm items-center space-x-2">
        <Input
          type="number"
          placeholder="Enter Test ID"
          value={testId}
          onChange={(e) => setTestId(e.target.value)}
        />
        <Button onClick={handleGenerateStudyPlan} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Generate Plan
        </Button>
      </div>

      {studyPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Your Personalized Study Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Study Plan</h3>
                <div dangerouslySetInnerHTML={{ __html: studyPlan.plan }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Recommended Resources</h3>
                <ul className="list-disc space-y-2 pl-5">
                  {studyPlan.resources.map((resource, index) => (
                    <li key={index}>
                      <strong>{resource.title}</strong> ({resource.type})
                      {resource.url && (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-500 hover:underline"
                        >
                          Link
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
