export interface Ticket {
  position: number; // 0 = running now
  release: () => void;
}

interface Waiter {
  resolve: (t: Ticket) => void;
}

export class Gate {
  active = 0;
  private waiters: Waiter[] = [];

  constructor(private maxConcurrent: number, private maxQueue: number) {}

  get queued(): number { return this.waiters.length; }

  acquire(): Promise<Ticket> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve(this.makeTicket(0));
    }
    if (this.waiters.length >= this.maxQueue) {
      return Promise.reject(new Error('server busy: queue full'));
    }
    return new Promise<Ticket>((resolve) => {
      this.waiters.push({ resolve });
    });
  }

  private makeTicket(position: number): Ticket {
    let released = false;
    return {
      position,
      release: (): void => {
        if (released) return;
        released = true;
        const next = this.waiters.shift();
        if (next) {
          next.resolve(this.makeTicket(0));
        } else {
          this.active--;
        }
      },
    };
  }
}
