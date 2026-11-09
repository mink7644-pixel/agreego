import { Map, MapPin, House, Check, Plane } from "lucide-react";
import type { LucideIcon } from "lucide-react";

"use client";

export type AppTab = "map" | "places" | "home" | "vote" | "trip";

type BottomNavigationProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};

const navigationItems: {
  label: string;
  Icon: LucideIcon;
  tab: AppTab;
}[] = [
  { label: "Map", Icon: Map, tab: "map" },
  { label: "Places", Icon: MapPin, tab: "places" },
  { label: "Home", Icon: House, tab: "home" },
  { label: "Vote", Icon: Check, tab: "vote" },
  { label: "Trip", Icon: Plane, tab: "trip" },
];

export default function BottomNavigation({
  activeTab,
  onChange,
}: BottomNavigationProps) {
  return (
    <nav
      aria-label="메인 메뉴"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-md justify-around px-2 py-3">
        {navigationItems.map((item) => {
          const isActive = activeTab === item.tab;

          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onChange(item.tab)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-w-14 flex-col items-center gap-1 ${
                isActive
                  ? "text-[#6264F6]"
                  : "text-gray-500"
              }`}
            >
              <item.Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              <span className="text-xs font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
