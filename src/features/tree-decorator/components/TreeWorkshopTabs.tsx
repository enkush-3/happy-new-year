import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { SecondaryButton } from "../../../components/ui/game";

const tabs = [
  { id: "ornaments", label: "Чимэглэл" },
  { id: "edit", label: "Засах" },
  { id: "tree", label: "Мод" },
] as const;

export type WorkshopTab = (typeof tabs)[number]["id"];

interface TreeWorkshopTabsProps {
  activeTab: WorkshopTab;
  onChange: (tab: WorkshopTab) => void;
  panels: Record<WorkshopTab, ReactNode>;
  editTabRef: RefObject<HTMLButtonElement | null>;
}

export default function TreeWorkshopTabs({ activeTab, onChange, panels, editTabRef }: TreeWorkshopTabsProps) {
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowLeft": nextIndex = (index - 1 + tabs.length) % tabs.length; break;
      case "ArrowRight": nextIndex = (index + 1) % tabs.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    onChange(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="tree-workshop__tabset">
      <div className="tree-workshop__tabs" role="tablist" aria-label="Гацуурын засвар">
        {tabs.map(({ id: tab, label }, index) => (
          <SecondaryButton
            key={tab}
            ref={(node) => {
              tabRefs.current[index] = node;
              if (tab === "edit") editTabRef.current = node;
            }}
            id={`${id}-tab-${tab}`}
            className="tree-workshop__tab"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${id}-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            {label}
          </SecondaryButton>
        ))}
      </div>
      <div className="tree-workshop__tab-content" ref={scrollRef}>
        {tabs.map(({ id: tab }) => (
          <div
            key={tab}
            id={`${id}-panel-${tab}`}
            className="tree-workshop__tab-panel"
            role="tabpanel"
            aria-labelledby={`${id}-tab-${tab}`}
            tabIndex={0}
            hidden={activeTab !== tab}
          >
            {panels[tab]}
          </div>
        ))}
      </div>
    </div>
  );
}
