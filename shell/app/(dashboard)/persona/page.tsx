'use client';
import TrialChatPanel from '@/components/TrialChatPanel';
import PromptTweakPanel from '@/components/PromptTweakPanel';

export default function PersonaPage() {
  return (
    <div className="-m-8 h-[calc(100%+4rem)] flex flex-row overflow-hidden">
      {/* Left: Trial chat — fills remaining space, full height */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200 min-h-0 overflow-hidden">
        <TrialChatPanel />
      </div>
      {/* Right: Chat instructions — fixed width, full height */}
      <div className="w-96 shrink-0 flex flex-col min-h-0 overflow-hidden">
        <PromptTweakPanel />
      </div>
    </div>
  );
}

