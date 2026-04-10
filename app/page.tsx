'use client';

import React from 'react';
import CapabilityHub from '@/components/layout/CapabilityHub';
import NexusChat from '@/components/layout/NexusChat';
import ObserverPanel from '@/components/layout/ObserverPanel';

export default function HomePage() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#09090b]">
      {/* A. Capability Hub (Left) - 1 part */}
      <div className="w-[280px] shrink-0">
        <CapabilityHub />
      </div>

      {/* B. Nexus Chat (Middle) - 3 parts */}
      <div className="flex-1 min-w-0">
        <NexusChat />
      </div>

      {/* C. Observer Panel (Right) - 1.5 parts */}
      <div className="w-[380px] shrink-0">
        <ObserverPanel />
      </div>
    </div>
  );
}
