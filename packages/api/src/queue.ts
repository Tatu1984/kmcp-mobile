import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiError, type ApiClient } from "./client";

/**
 * The offline queue.
 *
 * Signal at a kerb is intermittent, and an attendant cannot wait for it. Every
 * action that changes something is written here first and sent when the network
 * allows, so the queue — not the network — is what the interface responds to.
 *
 * Safety rests entirely on the server: session start, session end and payment
 * collection are all idempotent on a key this queue generates once and keeps.
 * Replaying an entry returns the original session and the original fare rather
 * than creating a second charge. That is why retrying is safe enough to do
 * automatically, and why the key is generated at the moment the attendant acts
 * rather than at the moment we manage to send it.
 */

const STORAGE_KEY = "kmcp.queue.v1";

export type QueuedKind = "session.start" | "session.end" | "payment.collect" | "shift.close";

export interface QueuedAction {
  /** Also the idempotency key sent to the server. Generated once, never reused. */
  id: string;
  kind: QueuedKind;
  path: string;
  body: Record<string, unknown>;
  /** When the attendant acted, not when this was sent. */
  occurredAt: string;
  attempts: number;
  lastError?: string;
  /** Set when the server refused it on its merits. Needs a human, not a retry. */
  rejected?: boolean;
}

export interface QueueState {
  pending: number;
  rejected: number;
  syncing: boolean;
}

type Listener = (state: QueueState) => void;

/** Random enough for an idempotency key, with no dependency to install. */
export function newEventId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `evt_${stamp}_${random}`;
}

export class OfflineQueue {
  private items: QueuedAction[] = [];
  private listeners = new Set<Listener>();
  private syncing = false;
  private loaded = false;

  constructor(private readonly client: ApiClient) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      this.items = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    } catch {
      // A corrupt queue file must not stop the app starting. Losing queued work
      // is bad; being unable to work at all is worse.
      this.items = [];
    }
    this.loaded = true;
    this.emit();
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      // Out of storage. The in-memory queue still drains this session.
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.state();
    for (const listener of this.listeners) listener(state);
  }

  state(): QueueState {
    return {
      pending: this.items.filter((i) => !i.rejected).length,
      rejected: this.items.filter((i) => i.rejected).length,
      syncing: this.syncing,
    };
  }

  list(): QueuedAction[] {
    return [...this.items];
  }

  /**
   * Sends now, and queues it if that fails for a reason worth retrying.
   *
   * The caller gets the server's answer when there is one. When there is not,
   * it gets null and the action is queued — the interface should then say the
   * work is saved, not that it succeeded, because the fare is not final until
   * the server has priced it.
   */
  async submit<T>(action: Omit<QueuedAction, "attempts" | "occurredAt"> & { occurredAt?: string }): Promise<T | null> {
    await this.load();

    const entry: QueuedAction = {
      ...action,
      occurredAt: action.occurredAt ?? new Date().toISOString(),
      attempts: 0,
    };

    try {
      const result = await this.client.post<T>(entry.path, entry.body);
      return result;
    } catch (error) {
      if (error instanceof ApiError && !error.isRetryable) {
        // The server said no on the merits. Queueing would mean asking again
        // forever for something already refused.
        throw error;
      }
      entry.attempts = 1;
      entry.lastError = error instanceof Error ? error.message : String(error);
      this.items.push(entry);
      await this.persist();
      this.emit();
      return null;
    }
  }

  /**
   * Drains the queue oldest first.
   *
   * Order matters: a session must exist before its payment, and both before the
   * shift closes. One failure stops the run rather than skipping ahead, because
   * sending a payment for a session that has not been created yet would be
   * refused and then wrongly marked as rejected.
   */
  async sync(): Promise<{ sent: number; failed: number; rejected: number }> {
    await this.load();
    if (this.syncing) return { sent: 0, failed: 0, rejected: 0 };

    this.syncing = true;
    this.emit();

    let sent = 0;
    let failed = 0;
    let rejected = 0;

    try {
      const queue = this.items.filter((i) => !i.rejected).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

      for (const entry of queue) {
        try {
          await this.client.post(entry.path, entry.body);
          this.items = this.items.filter((i) => i.id !== entry.id);
          sent += 1;
        } catch (error) {
          entry.attempts += 1;
          entry.lastError = error instanceof Error ? error.message : String(error);

          if (error instanceof ApiError && !error.isRetryable) {
            // Refused on its merits — a closed zone, a plate already parked.
            // Keep it so somebody can see what happened and why.
            entry.rejected = true;
            rejected += 1;
            continue;
          }

          failed += 1;
          // Still no connection. Stop; the rest are no more likely to succeed.
          break;
        }
      }
    } finally {
      this.syncing = false;
      await this.persist();
      this.emit();
    }

    return { sent, failed, rejected };
  }

  /** Removes a rejected entry once someone has dealt with it. */
  async discard(id: string): Promise<void> {
    await this.load();
    this.items = this.items.filter((i) => i.id !== id);
    await this.persist();
    this.emit();
  }
}
