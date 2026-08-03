import React from "react";

const MAP = {
  Hot: { bg: "bg-[#EF4444]/15", text: "text-[#F87171]", dot: "bg-[#EF4444]" },
  Warm: { bg: "bg-[#FACC15]/15", text: "text-[#FACC15]", dot: "bg-[#FACC15]" },
  Cold: { bg: "bg-[#3B82F6]/15", text: "text-[#60A5FA]", dot: "bg-[#3B82F6]" },
};

const STAGE = {
  New: "bg-[#16161A] text-[#A1A1AA] border-[#1F1F24]",
  Contacted: "bg-[#3B82F6]/10 text-[#60A5FA] border-[#3B82F6]/20",
  Qualified: "bg-[#BEF264]/10 text-[#BEF264] border-[#BEF264]/20",
  Proposal: "bg-[#A855F7]/10 text-[#C084FC] border-[#A855F7]/20",
  Won: "bg-[#10B981]/10 text-[#34D399] border-[#10B981]/20",
  Lost: "bg-[#71717A]/10 text-[#71717A] border-[#71717A]/20",
};

export function PriorityBadge({ priority, testid }) {
  const c = MAP[priority] || MAP.Cold;
  return (
    <span data-testid={testid} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {priority || "Cold"}
    </span>
  );
}

export function StageBadge({ stage }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${STAGE[stage] || STAGE.New}`}>
      {stage || "New"}
    </span>
  );
}
