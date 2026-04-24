import mongoose, { Document, Schema } from "mongoose";

// ─── School ───────────────────────────────────────────────────────────────────

export interface ISchool extends Document {
  name: string;
  city: string;
  board: "CBSE" | "ICSE" | "State" | "IB" | "Other";
  logo?: string;
  gradesOffered: string[];
  createdBy: string; // firebaseUid of school_admin
  onboardingComplete: boolean;
  createdAt: Date;
}

const SchoolSchema = new Schema<ISchool>({
  name: { type: String, required: true },
  city: { type: String, required: true },
  board: { type: String, enum: ["CBSE", "ICSE", "State", "IB", "Other"], required: true },
  logo: { type: String },
  gradesOffered: [{ type: String }],
  createdBy: { type: String, required: true },
  onboardingComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const School = mongoose.models.School || mongoose.model<ISchool>("School", SchoolSchema);

// ─── Invite ───────────────────────────────────────────────────────────────────

export interface IInvite extends Document {
  email: string;
  name: string;
  role: "teacher" | "student";
  schoolId: mongoose.Types.ObjectId;
  classId?: mongoose.Types.ObjectId;
  grades: string[];
  token: string;
  status: "pending" | "accepted" | "expired";
  invitedBy: string; // firebaseUid
  expiresAt: Date;
  createdAt: Date;
}

const InviteSchema = new Schema<IInvite>({
  email: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ["teacher", "student"], required: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "SchoolClass" },
  grades: [{ type: String }],
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ["pending", "accepted", "expired"], default: "pending" },
  invitedBy: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

InviteSchema.index({ token: 1 });
InviteSchema.index({ schoolId: 1, role: 1, status: 1 });

export const Invite = mongoose.models.Invite || mongoose.model<IInvite>("Invite", InviteSchema);

// ─── SchoolClass ──────────────────────────────────────────────────────────────

export interface ISchoolClass extends Document {
  name: string;
  grade: string;
  teacherFirebaseUid: string;
  schoolId: mongoose.Types.ObjectId;
  students: string[]; // firebaseUids
  createdAt: Date;
}

const SchoolClassSchema = new Schema<ISchoolClass>({
  name: { type: String, required: true },
  grade: { type: String, required: true },
  teacherFirebaseUid: { type: String, required: true },
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  students: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export const SchoolClass =
  mongoose.models.SchoolClass || mongoose.model<ISchoolClass>("SchoolClass", SchoolClassSchema);
