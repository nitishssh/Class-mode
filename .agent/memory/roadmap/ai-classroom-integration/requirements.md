# 📋 Requirements: AI Classroom Internalization

Integrate the core features of the interactive classroom system directly into PersonalLearningPro, replacing the current "bridge/iframe" approach with a native, internal implementation.

## 🎯 Objectives

1. **Remove External Dependency**: Transition from calling an external Study Arena service to having all logic run within the `PersonalLearningPro` server.
2. **Native UI**: Replace the iframe-based classroom with native React components that match the existing app's design system (Shadcn UI).
3. **Multi-Agent Orchestration**: Implement the teacher/student interaction logic using existing AI service patterns in the backend.
4. **Interactive Learning**: Support Slides, Quizzes, Simulations (HTML/JS), and Project-Based Learning (PBL) scenes.

## 🚀 Key Features to Port

- **AI Classroom**: Real-time interaction between a Teacher agent and one or more Student agents.
- **Scene Generator**: Automated generation of structured lesson content (JSON format).
- **Interactive Player**: A native React player for stepping through generated lessons.
- **Content Types**:
  - **Slides**: Markdown/Image-based presentations.
  - **Quiz**: Interactive questions with AI-driven feedback.
  - **Simulations**: Sandboxed HTML/JS experiments.
  - **PBL**: Collaborative task-based learning.
- **Agent Avatars & TTS**: Integrating with existing TTS services and providing visual feedback for active agents.

## 🛠️ User Use Case

A student wants to learn a complex topic (e.g., "Photosynthesis"). They enter the topic, and the system generates a 3D-feeling interactive classroom where an AI Teacher explains the concept using slides, and an AI Peer asks clarifying questions. The student can interact, take a quiz, or run a simulation—all without leaving the application or relying on an external server.

## ✅ Success Criteria

- [ ] Backend endpoints `/api/ai-classroom/generate` work without needing an external StudyArena URL.
- [ ] User can view and interact with the classroom via a native React page `/ai-classroom`.
- [ ] Agent interactions are displayed in a native chat/dialogue interface.
- [ ] Lesson states are persisted in the existing MongoDB `classrooms` collection.
