'use client';

import { useState } from 'react';
import { TanpuraPlayer } from './TanpuraPlayer';
import { TaalTimer } from './TaalTimer';

// Container for the practice plugins. Both can run at once (different AudioContexts),
// so we render whichever the user wants visible. Tanpura is intentionally kept mounted
// once opened so its drone keeps playing even if the user switches to the Taal tab.

type Tab = 'both' | 'tanpura' | 'taal';

export function PluginShelf() {
  const [tab, setTab] = useState<Tab>('both');

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {([['both', 'Both'], ['tanpura', 'Tanpura'], ['taal', 'Taal Timer']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm border ${tab === t ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line text-ink hover:border-maroon-mid'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className={tab === 'taal' ? 'hidden' : ''}><TanpuraPlayer /></div>
        <div className={tab === 'tanpura' ? 'hidden' : ''}><TaalTimer /></div>
      </div>
    </div>
  );
}
