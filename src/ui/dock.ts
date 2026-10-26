export interface DockHandlers {
  launch: () => void;
  act: (action: string) => void;
  onOffer: (value: number) => void;
}

export function bindDock(handlers: DockHandlers): void {
  document.getElementById('enter-xr')?.addEventListener('click', () => handlers.launch());
  document.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.act;
      if (action) handlers.act(action);
    });
  });
  const slider = document.getElementById('offer-slider');
  slider?.addEventListener('input', () => {
    if (slider instanceof HTMLInputElement) handlers.onOffer(Number(slider.value));
  });
}

export interface DockState {
  offer: number;
  min: number;
  max: number;
  shift: string;
  jain: string;
  phase: string;
}

export function syncDock(state: DockState): void {
  const slider = document.getElementById('offer-slider');
  if (slider instanceof HTMLInputElement && document.activeElement !== slider) {
    slider.min = String(state.min);
    slider.max = String(state.max);
    slider.value = String(state.offer);
  } else if (slider instanceof HTMLInputElement) {
    slider.min = String(state.min);
    slider.max = String(state.max);
  }
  const shift = document.getElementById('shift-readout');
  if (shift) shift.textContent = state.shift;
  const jain = document.getElementById('jain-readout');
  if (jain) jain.textContent = state.jain;
  const phase = document.getElementById('phase-readout');
  if (phase) phase.textContent = state.phase;
}
