/**
 * HTTP client for the Study Arena internal service.
 * Used by integration tests to exercise the /api/ai-classroom routes.
 */

import axios from "axios";

interface StudyArenaClientConfig {
  baseUrl: string;
  bridgeSecret?: string;
}

export interface JobStatus {
  jobId: string;
  status: string;
  done: boolean;
  progress?: number;
  message?: string;
  result?: { classroomId: number };
  error?: string;
}

export class StudyArenaClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor({ baseUrl, bridgeSecret }: StudyArenaClientConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers = bridgeSecret ? { Authorization: `Bearer ${bridgeSecret}` } : {};
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/ai-classroom/health`, {
        headers: this.headers,
        timeout: 5000,
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async createClassroom(data: { requirement: string }): Promise<{ jobId: string; status: string }> {
    const res = await axios.post(
      `${this.baseUrl}/api/ai-classroom/create`,
      { requirement: data.requirement },
      { headers: this.headers },
    );
    return res.data;
  }

  async pollJob(jobId: string): Promise<JobStatus> {
    const res = await axios.get(`${this.baseUrl}/api/ai-classroom/status/${jobId}`, {
      headers: this.headers,
    });
    return { ...res.data, jobId };
  }
}
