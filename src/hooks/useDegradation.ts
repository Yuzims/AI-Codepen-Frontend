import { useState, useEffect } from 'react';
import { perfMonitor, degradationController, DegradationState } from '../services/perfMonitor';

export function useDegradation(): DegradationState {
  const [state, setState] = useState<DegradationState>(degradationController.getState());

  useEffect(() => {
    return perfMonitor.subscribe((event) => {
      if (event.type === 'degradation_change') {
        setState(event.state);
      }
    });
  }, []);

  return state;
}
