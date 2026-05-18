/** Fans out Server-Sent Events to browser subscribers per job. */
export class EventBroker {
  private subscribers = new Map<string, Set<(data: string) => void>>();

  subscribe(jobId: string, send: (data: string) => void): () => void {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    this.subscribers.get(jobId)!.add(send);
    return () => {
      const set = this.subscribers.get(jobId);
      if (!set) return;
      set.delete(send);
      if (set.size === 0) this.subscribers.delete(jobId);
    };
  }

  publish(jobId: string, payload: object): void {
    const data = JSON.stringify(payload);
    const set = this.subscribers.get(jobId);
    if (!set) return;
    for (const send of set) {
      try {
        send(data);
      } catch {
        /* disconnected */
      }
    }
  }
}
