import { motion } from "framer-motion";
import {
  Clock,
  Layers,
  LineChart,
  Rocket,
  GraduationCap,
  Building,
  ShieldCheck,
} from "lucide-react";

const metrics = [
  {
    icon: Clock,
    metric: "5+ hrs/week",
    title: "saved per teacher",
    desc: "grading, test creation, attendance automation",
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    icon: Layers,
    metric: "1 platform",
    title: "replacing 4–6 tools",
    desc: "no more spreadsheets, separate LMS, messaging apps",
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    icon: LineChart,
    metric: "Real-time",
    title: "visibility",
    desc: "principals and boards see live data, not month-old reports",
    color: "bg-green-500/10 text-green-500",
  },
  {
    icon: Rocket,
    metric: "3× faster",
    title: "from enrolment to first lesson",
    desc: "no IT tickets, no training required",
    color: "bg-purple-500/10 text-purple-500",
  },
];

const roles = [
  {
    icon: GraduationCap,
    role: "Teachers",
    bullets: ["AI drafts tests", "OCR scans paper", "Parent comms built in"],
  },
  {
    icon: Building,
    role: "Principals",
    bullets: ["Live view of every class", "At-risk student flags", "Timetable management"],
  },
  {
    icon: ShieldCheck,
    role: "Boards & Admins",
    bullets: ["Automated reports", "School-wide KPIs", "Compliance docs"],
  },
];

export const WhatSchoolGains = () => {
  return (
    <section className="relative overflow-hidden py-24 bg-card/30 dark:bg-background">
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-4xl font-extrabold text-foreground md:text-5xl">
            What your school <span className="text-primary">actually gains.</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Measurable impact across every level of your institution.
          </p>
        </motion.div>

        {/* 4 Outcome Metric Cards */}
        <div className="mb-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="sketch-border hover-tilt sketch-shadow flex flex-col items-start rounded-2xl bg-card p-6"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.color}`}>
                <item.icon size={24} />
              </div>
              <h3 className="font-heading text-2xl font-black leading-tight text-foreground">
                {item.metric}
              </h3>
              <p className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-primary">
                {item.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Role-by-role Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <h3 className="text-3xl font-extrabold text-foreground">
            Role-by-role breakdown
          </h3>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-3">
          {roles.map((role, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border-2 border-border bg-background p-8 transition-all hover:border-primary/50"
            >
              <div className="absolute -right-4 -top-4 opacity-5 transition-transform group-hover:scale-110">
                <role.icon size={120} />
              </div>
              <div className="relative z-10">
                <div className="mb-6 inline-flex rounded-xl bg-primary/10 p-3 text-primary">
                  <role.icon size={28} />
                </div>
                <h4 className="mb-6 font-heading text-xl font-bold text-foreground">
                  {role.role}
                </h4>
                <ul className="space-y-4">
                  {role.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">
                        ✓
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
