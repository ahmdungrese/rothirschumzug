"use client";

import React from 'react';
import { KanbanDispositionBoard } from '@/components/dashboard/KanbanDispositionBoard';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Shield: Teamleiter haben keinen Zugriff auf das Dispositions-Board
  if (profile?.role === 'teamlead') {
    return null;
  }

  return (
    <div className="w-full">
      <KanbanDispositionBoard />
    </div>
  );
}
