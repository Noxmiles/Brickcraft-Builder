type EventCallback = (...args: any[]) => void;

class EventEmitter {
  private listeners: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(...args));
  }
}

export const globalEvents = new EventEmitter();

// Handle Auto-Pause based on Visibility API
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        globalEvents.emit('SIMULATION_PAUSE');
    } else {
        globalEvents.emit('SIMULATION_RESUME');
    }
});
