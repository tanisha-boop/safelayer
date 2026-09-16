import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  HelpCircle,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";

const workflowSteps = [
  {
    number: "01",
    title: "Field activity",
    text: "Create and execute an operational assignment with ownership, timing, status, and completion information.",
    icon: Activity,
  },
  {
    number: "02",
    title: "Evidence",
    text: "Attach operational proof such as photographs or supporting records to the activity being performed.",
    icon: FileCheck2,
  },
  {
    number: "03",
    title: "Verification",
    text: "Review submitted evidence and record whether the supporting proof is acceptable.",
    icon: CheckCircle2,
  },
  {
    number: "04",
    title: "Risk & Trust",
    text: "Use available evidence and operational signals to assess whether additional attention or investigation is required.",
    icon: AlertTriangle,
  },
  {
    number: "05",
    title: "Human review",
    text: "Route exceptions and higher-risk records to a reviewer for an explicit decision and resolution.",
    icon: ClipboardCheck,
  },
  {
    number: "06",
    title: "Audit trail",
    text: "Preserve important operational events so actions and changes can be investigated later.",
    icon: ShieldCheck,
  },
];

const moduleGuides = [
  {
    title: "Field Operations",
    text: "Manage assignments and operational activities from creation through completion.",
  },
  {
    title: "Evidence",
    text: "Upload and verify supporting evidence associated with field activities.",
  },
  {
    title: "RouteProof",
    text: "Capture check-in, GPS, and check-out signals associated with field activity.",
  },
  {
    title: "FieldLedger",
    text: "Track collections, remittances, and financial-control exceptions.",
  },
  {
    title: "InvoiceGuard",
    text: "Review invoice records and verification outcomes before financial processing.",
  },
  {
    title: "Reviews",
    text: "Handle records that require human decisions, resolutions, or additional investigation.",
  },
  {
    title: "Risk & Trust",
    text: "View trust assessments and operational risk signals generated from available system data.",
  },
  {
    title: "Compliance",
    text: "Maintain an operational register of permits, certifications, insurance, and other requirements.",
  },
  {
    title: "Reports",
    text: "Review operational indicators and trends across activity, evidence, review, and financial controls.",
  },
];

const roleGuides = [
  {
    role: "Field users",
    text: "Complete assigned activities, capture required evidence, and provide accurate operational information.",
  },
  {
    role: "Managers",
    text: "Monitor operational progress, review exceptions, and follow up on activities requiring attention.",
  },
  {
    role: "Finance users",
    text: "Monitor collection and remittance controls and investigate financial discrepancies.",
  },
  {
    role: "Reviewers",
    text: "Evaluate flagged records and document decisions or resolutions.",
  },
  {
    role: "Administrators",
    text: "Manage users, access boundaries, and organizational configuration.",
  },
];

const faqs = [
  {
    question: "What is SafeLayer designed to protect?",
    answer:
      "SafeLayer is designed to strengthen operational trust by connecting field activity with evidence, verification, risk assessment, human review, and audit history.",
  },
  {
    question: "Is every risk decision automatic?",
    answer:
      "No. Risk and trust signals support operational review. Records that require judgment can be routed through the human review workflow.",
  },
  {
    question: "Why is evidence connected to an activity?",
    answer:
      "Linking evidence to the activity that produced it preserves operational context and makes later verification and investigation more meaningful.",
  },
  {
    question: "What should I do when a record needs investigation?",
    answer:
      "Use the relevant review workflow to examine the record, supporting evidence, risk signals, and available audit history before recording a resolution.",
  },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

export default function Help() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <HelpCircle size={17} />
              SafeLayer operating guide
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Help & documentation
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
              Understand how SafeLayer connects operational activity,
              evidence, verification, risk, human review, and audit history
              into one trust workflow.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Operating principle
            </p>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              Know what happened in the field.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Core workflow"
          title="How SafeLayer works"
          description="SafeLayer is organized around a traceable operational lifecycle rather than isolated records."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflowSteps.map(({ number, title, text, icon: Icon }) => (
            <section
              key={number}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Icon
                    size={18}
                    className="text-slate-600 dark:text-slate-300"
                  />
                </div>

                <span className="text-xs font-bold tracking-widest text-slate-300 dark:text-slate-700">
                  {number}
                </span>
              </div>

              <h3 className="mt-5 font-bold text-slate-900 dark:text-white">
                {title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {text}
              </p>
            </section>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Modules"
          title="What each module is for"
          description="Use the module that corresponds to the operational stage or control you need to manage."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleGuides.map(({ title, text }) => (
            <section
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="font-bold text-slate-900 dark:text-white">
                {title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {text}
              </p>
            </section>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Access model"
          title="Role responsibilities"
          description="SafeLayer separates operational responsibilities so users only perform actions appropriate to their role."
        />

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {roleGuides.map(({ role, text }) => (
              <div
                key={role}
                className="grid gap-2 px-5 py-4 md:grid-cols-[180px_1fr]"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {role}
                </p>

                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Troubleshooting"
          title="Common questions"
          description="Quick guidance for the most important SafeLayer operating questions."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map(({ question, answer }) => (
            <section
              key={question}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="font-bold text-slate-900 dark:text-white">
                {question}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {answer}
              </p>
            </section>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={19}
            className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
          />

          <div>
            <h2 className="font-bold text-emerald-900 dark:text-emerald-300">
              Trust is built from traceability
            </h2>

            <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-400">
              SafeLayer does not treat a single record as the whole truth.
              Operational evidence, verification, risk signals, human
              decisions, and audit history provide the surrounding context
              needed to investigate what happened.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <BookOpen size={14} />
        <Search size={14} />
        <Workflow size={14} />
        <span>Use global search to locate operational records.</span>
      </div>
    </div>
  );
}