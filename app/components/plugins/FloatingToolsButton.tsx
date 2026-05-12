'use client';

import { useState } from 'react';
import { PluginShelf } from './PluginShelf';

// Floating "🎵 Tools" button — opens the practice plugins as an overlay drawer.
// Used on the live session page so a student can pull up the tanpura mid-class.

export function FloatingToolsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full shadow-lg bg-maroon-mid text-parchment px-4 py-3 text-sm font-medium hover:bg-maroon"
        aria-label="Open practice tools"
      >
        🎵 Tools
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative ml-auto h-full w-full max-w-2xl bg-parchment shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-parchment border-b border-line px-5 py-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-maroon">Practice Tools</h2>
              <button onClick={() => setOpen(false)} className="text-muted-warm hover:text-maroon-mid text-sm">Close</button>
            </div>
            <div className="p-5">
              <PluginShelf />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
