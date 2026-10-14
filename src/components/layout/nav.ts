import {
  Activity,
  Bell,
  Bot,
  Box,
  Gauge,
  LayoutDashboard,
  LineChart,
  ServerCog,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/telemetry", label: "Live Telemetry", icon: Activity },
      { href: "/digital-twin", label: "Digital Twin", icon: Box, badge: "3D" },
      { href: "/predictions", label: "Predictions", icon: LineChart },
      { href: "/optimization", label: "Optimization", icon: Gauge },
      { href: "/copilot", label: "AI Copilot", icon: Bot },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/alerts", label: "Alerts & Events", icon: Bell },
      { href: "/system", label: "System & Data", icon: ServerCog },
    ],
  },
];

export function sectionForPath(pathname: string): string {
  for (const g of NAV) for (const i of g.items) if (pathname.startsWith(i.href)) return i.label;
  return "Overview";
}
