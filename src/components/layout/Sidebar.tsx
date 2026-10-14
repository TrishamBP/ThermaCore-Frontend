"use client";

import { Server } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/cn";
import { useHref } from "@/hooks/useRun";

import { NAV } from "./nav";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-on-accent">
        <Server className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-[17px] leading-tight font-bold tracking-wide text-fg">THERMACORE</div>
        <div className="text-[10px] leading-tight font-medium tracking-[0.12em] text-fg-3">DATA CENTER INTELLIGENCE</div>
      </div>
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const href = useHref();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-5">
      {NAV.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.1em] text-fg-3 uppercase">{group.label}</div>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={href(item.href)}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-2.5 rounded-sm px-3 text-[13px] font-medium transition-colors",
                      active ? "bg-raised text-fg shadow-[inset_2px_0_0_var(--color-accent)]" : "text-fg-2 hover:bg-raised/60 hover:text-fg",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-fg" : "text-fg-3 group-hover:text-fg")} aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-[3px] border border-accent/50 px-1 text-[10px] font-semibold text-fg">{item.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3 py-4 lg:flex">
      <div className="px-2"><Brand /></div>
      <div className="h-px bg-line" />
      <SidebarNav />
      <div className="mt-auto rounded-sm border border-line bg-bg px-3 py-2.5 text-[11px] leading-relaxed text-fg-3">
        Recommendation-only console. No control actions are sent to equipment.
      </div>
    </aside>
  );
}
