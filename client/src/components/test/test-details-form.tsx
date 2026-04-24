import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { useLocation } from "wouter";
import { useEffect } from "react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const testSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long"),
  description: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  class: z.string().min(1, "Class is required"),
  testDate: z.string().min(1, "Test date is required"),
  duration: z.number().min(5, "Duration must be at least 5 minutes"),
  totalMarks: z.number().min(1, "Total marks must be at least 1"),
  questionTypes: z.array(z.string()).min(1, "Select at least one question type"),
  status: z.string().default("draft"),
});

type TestFormValues = z.infer<typeof testSchema>;

export function TestDetailsForm() {
  const { toast } = useToast();
  const { currentUser } = useFirebaseAuth();
  const [_, setLocation] = useLocation();

  const { data: teacherSubjects = [] } = useQuery<string[]>({
    queryKey: ["/api/teacher/subjects"],
  });

  const form = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      title: "",
      description: "",
      subject: "",
      class: "",
      testDate: new Date().toISOString().split("T")[0],
      duration: 60,
      totalMarks: 100,
      questionTypes: ["mcq"],
      status: "draft",
    },
  });

  // Set default subject once subjects are loaded
  useEffect(() => {
    if (teacherSubjects.length > 0 && !form.getValues("subject")) {
      form.setValue("subject", teacherSubjects[0]);
    }
  }, [teacherSubjects, form]);

  const createTestMutation = useMutation({
    mutationFn: async (data: TestFormValues) => {
      if (!currentUser?.user?.uid) throw new Error("User ID not found");

      // Convert date string to ISO format
      const testDate = new Date(data.testDate).toISOString();

      return apiRequest("POST", "/api/tests", {
        ...data,
        teacherId: currentUser.user.uid,
        testDate,
      });
    },
    onSuccess: async (response) => {
      const test = await response.json();
      toast({
        title: "Test Created",
        description: "Your test has been created successfully.",
      });

      // Invalidate the tests cache
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });

      // Redirect to the add questions page
      setLocation(`/tests/${test.id}/questions`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create test",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const questionTypeOptions = [
    { id: "mcq", label: "Multiple Choice Questions" },
    { id: "short", label: "Short Answer Questions" },
    { id: "long", label: "Long Answer Questions" },
    { id: "numerical", label: "Numerical Problems" },
  ];

  const onSubmit = (data: TestFormValues) => {
    createTestMutation.mutate(data);
  };

  const handleSaveDraft = () => {
    const values = form.getValues();
    createTestMutation.mutate({
      ...values,
      status: "draft",
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Test Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Physics Midterm Examination" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {teacherSubjects.length > 0 ? (
                      teacherSubjects.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No subjects found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="class"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Grade 10-A">Grade 10-A</SelectItem>
                    <SelectItem value="Grade 10-B">Grade 10-B</SelectItem>
                    <SelectItem value="Grade 11-A">Grade 11-A</SelectItem>
                    <SelectItem value="Grade 11-B">Grade 11-B</SelectItem>
                    <SelectItem value="Grade 12-A">Grade 12-A</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="testDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Test Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalMarks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Marks</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Test Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any instructions or details about the test..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel className="mb-2 block">Question Types to Include</FormLabel>
          <div className="space-y-2">
            {questionTypeOptions.map((option) => (
              <FormField
                key={option.id}
                control={form.control}
                name="questionTypes"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(option.id)}
                        onCheckedChange={(checked) => {
                          const currentValues = field.value || [];
                          if (checked) {
                            field.onChange([...currentValues, option.id]);
                          } else {
                            field.onChange(currentValues.filter((value) => value !== option.id));
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">{option.label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
          {form.formState.errors.questionTypes && (
            <p className="mt-2 text-sm font-medium text-destructive">
              {form.formState.errors.questionTypes.message}
            </p>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            className="mr-2"
            onClick={handleSaveDraft}
            disabled={createTestMutation.isPending}
          >
            Save Draft
          </Button>
          <Button type="submit" disabled={createTestMutation.isPending}>
            {createTestMutation.isPending ? "Creating..." : "Continue to Questions"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
