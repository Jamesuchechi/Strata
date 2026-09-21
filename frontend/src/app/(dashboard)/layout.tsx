"use client";

import React, { useState, useEffect } from "react";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardContextBar } from "@/components/dashboard/DashboardContextBar";
import { CommandPalette } from "@/components/dashboard/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isContextBarOpen, setIsContextBarOpen] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("datasets");
  const [activeDatasetId, setActiveDatasetId] = useState("orders_q3");

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
        setIsContextBarOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1E1915] flex flex-col font-sans selection:bg-[#0061FE] selection:text-white antialiased">
      {/* Global Topbar */}
      <DashboardTopbar
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isContextBarOpen={isContextBarOpen}
        onToggleContextBar={() => setIsContextBarOpen((prev) => !prev)}
      />

      {/* Main 3-Pane Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Reusable Left Navigation Sidebar */}
        <DashboardSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          activeNav={activeNav}
          onSelectNav={(id) => setActiveNav(id)}
          activeDatasetId={activeDatasetId}
          onSelectDataset={(id) => setActiveDatasetId(id)}
        />

        {/* Center Workspace Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[#F7F5F2] flex flex-col">
          {children}
        </main>

        {/* Contextual Right Inspector Drawer */}
        <DashboardContextBar
          isOpen={isContextBarOpen}
          onClose={() => setIsContextBarOpen(false)}
        />
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={(actionId) => {
          if (actionId.startsWith("dataset-")) {
            setActiveNav("datasets");
          } else if (actionId === "action-query" || actionId.startsWith("query-")) {
            setActiveNav("query");
          } else if (actionId === "version-commit") {
            setActiveNav("versions");
          } else if (actionId === "action-analyst") {
            setActiveNav("analyst");
          }
        }}
      />
    </div>
  );
}
