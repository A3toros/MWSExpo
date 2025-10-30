import { useEffect, useMemo, useState } from 'react';
import { CyberGlitchManager } from './CyberGlitchManager';

export function useOneAtATimeGlitch(): { active: boolean; id: string } {
  const id = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`, []);
  const [active, setActive] = useState(false);

  useEffect(() => {
    CyberGlitchManager.register(id);
    const unsub = CyberGlitchManager.subscribe((activeId) => setActive(activeId === id));
    return () => {
      unsub();
      CyberGlitchManager.unregister(id);
    };
  }, [id]);

  return { active, id };
}


