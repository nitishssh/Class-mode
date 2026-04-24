import { useRole } from "@/contexts/chat-role-context";
import { UserRole } from "@/types/chat";
import { GraduationCap, BookOpen, Users } from "lucide-react";

const roleConfig: Record<
  UserRole,
  { label: string; icon: typeof GraduationCap; colorClass: string }
> = {
  student: { label: "Student", icon: GraduationCap, colorClass: "bg-role-student" },
  teacher: { label: "Teacher", icon: BookOpen, colorClass: "bg-role-teacher" },
  parent: { label: "Parent", icon: Users, colorClass: "bg-role-parent" },
};

const RoleSwitcher = () => {
  const { currentRole, setRole } = useRole();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {(Object.keys(roleConfig) as UserRole[]).map((role) => {
        const cfg = roleConfig[role];
        const Icon = cfg.icon;
        const isActive = currentRole === role;

        return (
          <button
            key={role}
            onClick={() => setRole(role)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? `${cfg.colorClass} text-primary-foreground shadow-sm`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
};

export default RoleSwitcher;
