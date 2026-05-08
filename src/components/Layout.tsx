import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { View } from "../types";
import { BottomNav, DesktopNav } from "./Navigation";
import { cn } from "../lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  setView: (v: View) => void;
}

export const Layout = ({ children, currentView, setView }: LayoutProps) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-on-background">
      <DesktopNav currentView={currentView} setView={setView} />
      
      <div className="flex flex-1 flex-col overflow-hidden relative min-w-0">
        <main className="flex-1 flex flex-col overflow-y-auto no-scrollbar relative min-w-0 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "flex-1 w-full flex flex-col min-w-0",
                currentView === 'explorer' ? 'pb-0' : 'pb-28 md:pb-6'
              )}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        
        <BottomNav currentView={currentView} setView={setView} />
      </div>
    </div>
  );
};
