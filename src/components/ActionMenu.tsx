import React, { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "../lib/utils";

export type ActionMenuItem = {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  isHeader?: boolean;
  isDivider?: boolean;
  active?: boolean;
  customComponent?: React.ReactNode;
};

interface ActionMenuProps {
  items: ActionMenuItem[];
  triggerIcon?: React.ReactNode;
  buttonClassName?: string;
}

export const ActionMenu = ({ items, triggerIcon, buttonClassName }: ActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn("p-2 rounded-full text-[#0b2240] hover:text-secondary hover:premium-glass transition-colors", buttonClassName)}
      >
        {triggerIcon || <MoreVertical size={16} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl premium-glass border  shadow-2xl overflow-hidden z-50">
          <div className="py-1 flex flex-col">
            {items.map((item, index) => {
              if (item.customComponent) {
                return <div key={index}>{item.customComponent}</div>;
              }
              if (item.isDivider) {
                return <div key={index} className="h-px premium-glass my-1 mx-2" />;
              }
              if (item.isHeader) {
                return (
                  <div key={index} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#083344]">
                    {item.label}
                  </div>
                );
              }
              return (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick && item.onClick();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-3 transition-colors",
                    item.destructive 
                      ? "text-error hover:bg-error/10" 
                      : item.active 
                        ? "text-secondary bg-secondary/10" 
                        : "text-[#0b2240] hover:premium-glass hover:text-on-background"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
