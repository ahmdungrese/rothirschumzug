"use client";

import React from 'react';
import { KanbanDispositionBoard } from '@/components/dashboard/KanbanDispositionBoard';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { profile } = useAuth();

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
