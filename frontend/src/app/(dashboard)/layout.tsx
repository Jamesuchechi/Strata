"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardContextBar } from "@/components/dashboard/DashboardContextBar";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { StudioProvider, useStudio } from "@/context/StudioContext";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isContextBarOpen, toggleContextBar } = useStudio();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K => Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Cmd/Ctrl + B => Toggle Sidebar
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
      // Cmd/Ctrl + I => Toggle Context Inspector
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        toggleContextBar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleContextBar]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F7F5F2] text-[#1E1915] flex flex-col font-sans selection:bg-[#0061FE] selection:text-white antialiased">
      {/* Global Topbar */}
      <DashboardTopbar
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isContextBarOpen={isContextBarOpen}
        onToggleContextBar={toggleContextBar}
      />

      {/* Main 3-Pane Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Reusable Left Navigation Sidebar - fixed in place */}
        <DashboardSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Center Workspace Canvas - only this section scrolls */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-[#F7F5F2] flex flex-col">
          {children}
        </main>

        {/* Contextual Right Inspector Drawer - fixed in place */}
        <DashboardContextBar />
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={(actionId) => {
          if (actionId.startsWith("dataset-")) {
            router.push("/datasets");
          } else if (actionId === "action-query" || actionId.startsWith("query-")) {
            router.push("/query");
          } else if (actionId === "version-commit") {
            router.push("/versions");
          } else if (actionId === "action-analyst") {
            router.push("/analyst");
          }
        }}
      />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudioProvider>
      <DashboardShell>{children}</DashboardShell>
    </StudioProvider>
  );
}
