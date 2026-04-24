export type TestStatus = 'draft' | 'published' | 'completed';
export type QuestionType = 'mcq' | 'short' | 'long' | 'numerical';

export interface Test {
  id: number;
  title: string;
  description?: string | null;
  subject: string;
  class: string;
  teacherId: number;
  totalMarks: number;
  duration: number;
  testDate: string | Date;
  questionTypes: string[];
  status: TestStatus;
  createdAt: Date;
}

export interface Question {
  id: number;
  testId: number;
  type: QuestionType;
  text: string;
  options?: any;
  correctAnswer?: string | null;
  marks: number;
  order: number;
  aiRubric?: string | null;
}

export interface TestAttempt {
  id: number;
  testId: number;
  studentId: number;
  startTime?: string | Date;
  endTime?: string | Date | null;
  score?: number | null;
  status: 'in_progress' | 'submitted' | 'graded';
}

export interface Answer {
  id: number;
  attemptId: number;
  questionId: number;
  answer: string;
  isCorrect?: boolean | null;
  marksAwarded?: number | null;
}
