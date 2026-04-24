import { Conversation, Message, User, UserRole, ConversationCategory } from "@/types/chat";

// ─── Users ───
export const users: Record<string, User> = {
  "teacher-math": {
    id: "teacher-math",
    name: "Ms. Priya Nair",
    role: "teacher",
    isOnline: true,
    subject: "Mathematics",
  },
  "teacher-sci": {
    id: "teacher-sci",
    name: "Mr. Arjun Patel",
    role: "teacher",
    isOnline: false,
    lastSeen: new Date(Date.now() - 20 * 60000),
    subject: "Science",
  },
  "teacher-eng": {
    id: "teacher-eng",
    name: "Ms. Kavya Rao",
    role: "teacher",
    isOnline: true,
    subject: "English",
  },
  "student-1": { id: "student-1", name: "Riya Gupta", role: "student", isOnline: true },
  "student-2": {
    id: "student-2",
    name: "Karan Singh",
    role: "student",
    isOnline: false,
    lastSeen: new Date(Date.now() - 45 * 60000),
  },
  "student-3": { id: "student-3", name: "Ananya Joshi", role: "student", isOnline: true },
  "parent-1": {
    id: "parent-1",
    name: "Mr. Vijay Gupta",
    role: "parent",
    isOnline: false,
    lastSeen: new Date(Date.now() - 2 * 3600000),
  },
  "parent-2": { id: "parent-2", name: "Mrs. Meera Singh", role: "parent", isOnline: true },
};

const now = Date.now();
const min = 60000;
const hr = 3600000;

// ─── Messages ───
export const mockMessages: Record<string, Message[]> = {
  // School Announcements
  "ann-school": [
    {
      id: "a1",
      conversationId: "ann-school",
      senderId: "teacher-math",
      senderRole: "teacher",
      type: "announcement",
      content:
        "📢 Annual Sports Day will be held on March 15th. All students must report to the ground by 8:00 AM. Wear house colors.",
      status: "read",
      timestamp: new Date(now - 4 * hr),
      deliveredTo: [],
      readBy: [],
      isPinned: true,
    },
    {
      id: "a2",
      conversationId: "ann-school",
      senderId: "teacher-eng",
      senderRole: "teacher",
      type: "announcement",
      content:
        "📚 Library books must be returned by Friday. Late returns will incur a fine of ₹5 per day.",
      status: "read",
      timestamp: new Date(now - 2 * hr),
      deliveredTo: [],
      readBy: [],
    },
  ],

  // Math Class Group
  "class-math": [
    {
      id: "cm1",
      conversationId: "class-math",
      senderId: "teacher-math",
      senderRole: "teacher",
      type: "text",
      content:
        "Good morning class! Today we'll cover quadratic equations. Please have your textbooks ready, Chapter 4.",
      status: "read",
      timestamp: new Date(now - 3 * hr),
      deliveredTo: [],
      readBy: [],
    },
    {
      id: "cm2",
      conversationId: "class-math",
      senderId: "student-1",
      senderRole: "student",
      type: "doubt",
      content:
        "Ma'am, I'm confused about the discriminant formula. When b²-4ac < 0, there are no real roots right?",
      status: "read",
      timestamp: new Date(now - 2.5 * hr),
      deliveredTo: [],
      readBy: [],
      mentions: ["teacher-math"],
    },
    {
      id: "cm3",
      conversationId: "class-math",
      senderId: "teacher-math",
      senderRole: "teacher",
      type: "text",
      content:
        "Exactly right, Riya! When the discriminant is negative, the quadratic has no real roots — only complex/imaginary roots. Great question! ✅",
      status: "read",
      timestamp: new Date(now - 2.4 * hr),
      deliveredTo: [],
      readBy: [],
      isPinned: true,
      replyTo: "cm2",
    },
    {
      id: "cm4",
      conversationId: "class-math",
      senderId: "teacher-math",
      senderRole: "teacher",
      type: "assignment",
      content: "Complete exercises 4.1 to 4.5 from the textbook.",
      status: "read",
      timestamp: new Date(now - 2 * hr),
      deliveredTo: [],
      readBy: [],
      assignmentData: {
        title: "Quadratic Equations — Practice Set",
        dueDate: new Date(now + 2 * 24 * hr),
        subject: "Mathematics",
      },
    },
    {
      id: "cm5",
      conversationId: "class-math",
      senderId: "student-2",
      senderRole: "student",
      type: "doubt",
      content: "Sir, for question 4.3, do we use the completing the square method or the formula?",
      status: "delivered",
      timestamp: new Date(now - 30 * min),
      deliveredTo: ["teacher-math"],
      readBy: [],
      mentions: ["teacher-math"],
      isDoubtAnswered: false,
    },
    {
      id: "cm6",
      conversationId: "class-math",
      senderId: "student-3",
      senderRole: "student",
      type: "text",
      content: "Either works! But formula is faster for that one 😊",
      status: "read",
      timestamp: new Date(now - 25 * min),
      deliveredTo: [],
      readBy: [],
    },
  ],

  // Science Class Group
  "class-sci": [
    {
      id: "cs1",
      conversationId: "class-sci",
      senderId: "teacher-sci",
      senderRole: "teacher",
      type: "text",
      content: "Reminder: Lab practical tomorrow. Bring your lab coat and safety goggles.",
      status: "read",
      timestamp: new Date(now - 5 * hr),
      deliveredTo: [],
      readBy: [],
    },
    {
      id: "cs2",
      conversationId: "class-sci",
      senderId: "student-1",
      senderRole: "student",
      type: "text",
      content: "Sir, what experiment are we doing?",
      status: "read",
      timestamp: new Date(now - 4.5 * hr),
      deliveredTo: [],
      readBy: [],
    },
    {
      id: "cs3",
      conversationId: "class-sci",
      senderId: "teacher-sci",
      senderRole: "teacher",
      type: "text",
      content: "Acid-base titration. Review the procedure from Chapter 7.",
      status: "read",
      timestamp: new Date(now - 4 * hr),
      deliveredTo: [],
      readBy: [],
    },
  ],

  // Student → Teacher DM
  "dm-teacher-math": [
    {
      id: "dt1",
      conversationId: "dm-teacher-math",
      senderId: "student-me",
      senderRole: "student",
      type: "text",
      content: "Ma'am, can I get extra time for the assignment? I have a tournament this weekend.",
      status: "read",
      timestamp: new Date(now - 6 * hr),
      deliveredTo: ["teacher-math"],
      readBy: ["teacher-math"],
    },
    {
      id: "dt2",
      conversationId: "dm-teacher-math",
      senderId: "teacher-math",
      senderRole: "teacher",
      type: "text",
      content: "Of course, Aarav. You can submit by Monday. Good luck at the tournament! 🏆",
      status: "read",
      timestamp: new Date(now - 5.5 * hr),
      deliveredTo: ["student-me"],
      readBy: ["student-me"],
    },
    {
      id: "dt3",
      conversationId: "dm-teacher-math",
      senderId: "student-me",
      senderRole: "student",
      type: "text",
      content: "Thank you so much, Ma'am! 🙏",
      status: "read",
      timestamp: new Date(now - 5 * hr),
      deliveredTo: ["teacher-math"],
      readBy: ["teacher-math"],
    },
  ],

  // Friend chat
  "dm-friend-riya": [
    {
      id: "fr1",
      conversationId: "dm-friend-riya",
      senderId: "student-1",
      senderRole: "student",
      type: "text",
      content: "Hey, did you finish the math homework?",
      status: "read",
      timestamp: new Date(now - 1 * hr),
      deliveredTo: ["student-me"],
      readBy: ["student-me"],
    },
    {
      id: "fr2",
      conversationId: "dm-friend-riya",
      senderId: "student-me",
      senderRole: "student",
      type: "text",
      content: "Almost! Stuck on 4.3 though. The completing-the-square one.",
      status: "read",
      timestamp: new Date(now - 55 * min),
      deliveredTo: ["student-1"],
      readBy: ["student-1"],
    },
    {
      id: "fr3",
      conversationId: "dm-friend-riya",
      senderId: "student-1",
      senderRole: "student",
      type: "text",
      content: "Same 😅 Let's ask in the class group",
      status: "read",
      timestamp: new Date(now - 50 * min),
      deliveredTo: ["student-me"],
      readBy: ["student-me"],
    },
    {
      id: "fr4",
      conversationId: "dm-friend-riya",
      senderId: "student-me",
      senderRole: "student",
      type: "text",
      content: "Yeah Karan already asked, Ananya said use the formula method",
      status: "delivered",
      timestamp: new Date(now - 10 * min),
      deliveredTo: ["student-1"],
      readBy: [],
    },
  ],

  // Parent → Teacher
  "dm-parent-teacher": [
    {
      id: "pt1",
      conversationId: "dm-parent-teacher",
      senderId: "parent-me",
      senderRole: "parent",
      type: "text",
      content:
        "Good afternoon Ms. Nair. I wanted to check on Aarav's progress in Mathematics this term.",
      status: "read",
      timestamp: new Date(now - 8 * hr),
      deliveredTo: ["teacher-math"],
      readBy: ["teacher-math"],
    },
    {
      id: "pt2",
      conversationId: "dm-parent-teacher",
      senderId: "teacher-math",
      senderRole: "teacher",
      type: "text",
      content:
        "Good afternoon Mr. Sharma! Aarav is doing very well. He scored 92% in the last unit test and actively participates in class. He's especially strong in algebra.",
      status: "read",
      timestamp: new Date(now - 7.5 * hr),
      deliveredTo: ["parent-me"],
      readBy: ["parent-me"],
    },
    {
      id: "pt3",
      conversationId: "dm-parent-teacher",
      senderId: "parent-me",
      senderRole: "parent",
      type: "text",
      content: "That's wonderful to hear! Is there anything we should focus on at home?",
      status: "read",
      timestamp: new Date(now - 7 * hr),
      deliveredTo: ["teacher-math"],
      readBy: ["teacher-math"],
    },
    {
      id: "pt4",
      conversationId: "dm-parent-teacher",
      senderId: "teacher-math",
      senderRole: "teacher",
      type: "text",
      content:
        "He could practice more geometry word problems. I'll send some extra worksheets through the assignments section.",
      status: "read",
      timestamp: new Date(now - 6.5 * hr),
      deliveredTo: ["parent-me"],
      readBy: ["parent-me"],
    },
  ],

  // Teacher → Parent (from teacher POV)
  "dm-parent-vijay": [
    {
      id: "pv1",
      conversationId: "dm-parent-vijay",
      senderId: "parent-1",
      senderRole: "parent",
      type: "text",
      content: "Hello Ma'am, Riya will be absent tomorrow due to a doctor's appointment.",
      status: "read",
      timestamp: new Date(now - 3 * hr),
      deliveredTo: ["teacher-me"],
      readBy: ["teacher-me"],
    },
    {
      id: "pv2",
      conversationId: "dm-parent-vijay",
      senderId: "teacher-me",
      senderRole: "teacher",
      type: "text",
      content: "Noted, Mr. Gupta. I'll share the class notes with her. Hope she gets well soon!",
      status: "read",
      timestamp: new Date(now - 2.8 * hr),
      deliveredTo: ["parent-1"],
      readBy: ["parent-1"],
    },
  ],
};

// ─── Conversations by Role ───
type ConvConfig = {
  id: string;
  name?: string;
  category: ConversationCategory;
  isGroup: boolean;
  isReadOnly?: boolean;
  participants: string[];
  unreadCount: number;
  typing?: string[];
  subject?: string;
};

const convConfigs: Record<string, ConvConfig[]> = {
  student: [
    {
      id: "ann-school",
      name: "School Announcements",
      category: "announcement",
      isGroup: true,
      isReadOnly: true,
      participants: ["teacher-math", "teacher-eng"],
      unreadCount: 0,
    },
    {
      id: "class-math",
      name: "Class 10-A Mathematics",
      category: "class",
      isGroup: true,
      participants: ["teacher-math", "student-1", "student-2", "student-3"],
      unreadCount: 2,
      typing: ["teacher-math"],
      subject: "Mathematics",
    },
    {
      id: "class-sci",
      name: "Class 10-A Science",
      category: "class",
      isGroup: true,
      participants: ["teacher-sci", "student-1", "student-2"],
      unreadCount: 0,
      subject: "Science",
    },
    {
      id: "dm-teacher-math",
      category: "teacher",
      isGroup: false,
      participants: ["teacher-math"],
      unreadCount: 0,
    },
    {
      id: "dm-friend-riya",
      category: "friend",
      isGroup: false,
      participants: ["student-1"],
      unreadCount: 0,
    },
  ],
  teacher: [
    {
      id: "ann-school",
      name: "School Announcements",
      category: "announcement",
      isGroup: true,
      participants: ["teacher-eng"],
      unreadCount: 0,
    },
    {
      id: "class-math",
      name: "Class 10-A Mathematics",
      category: "class",
      isGroup: true,
      participants: ["student-1", "student-2", "student-3"],
      unreadCount: 1,
      subject: "Mathematics",
    },
    {
      id: "dm-parent-vijay",
      category: "parent",
      isGroup: false,
      participants: ["parent-1"],
      unreadCount: 0,
    },
    {
      id: "dm-parent-teacher",
      category: "parent",
      isGroup: false,
      participants: ["parent-me"],
      unreadCount: 0,
    },
  ],
  parent: [
    {
      id: "ann-school",
      name: "School Announcements",
      category: "announcement",
      isGroup: true,
      isReadOnly: true,
      participants: ["teacher-math", "teacher-eng"],
      unreadCount: 1,
    },
    {
      id: "dm-parent-teacher",
      category: "teacher",
      isGroup: false,
      participants: ["teacher-math"],
      unreadCount: 0,
    },
  ],
};

export function getConversationsForRole(role: UserRole): Conversation[] {
  const configs = convConfigs[role] || [];
  return configs.map((cfg) => {
    const participants = cfg.participants.map((pid) => users[pid]).filter(Boolean);
    const msgs = mockMessages[cfg.id] || [];
    const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;

    return {
      id: cfg.id,
      name: cfg.name,
      category: cfg.category,
      isGroup: cfg.isGroup,
      isReadOnly: cfg.isReadOnly,
      participants,
      lastMessage,
      unreadCount: cfg.unreadCount,
      typing: cfg.typing,
      subject: cfg.subject,
    };
  });
}

export function getCurrentUserId(role: UserRole): string {
  switch (role) {
    case "student":
      return "student-me";
    case "teacher":
      return "teacher-me";
    case "parent":
      return "parent-me";
  }
}
