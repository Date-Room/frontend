/**
 * One M-Pesa payment, from the prompt to the confirmation, shared by every
 * place that takes M-Pesa (plans and packs, time extensions, squad nights).
 * <MpesaPaymentPanel /> renders it; callers just await `runMpesaPayment`.
 *
 * The rules it keeps: a paid order is never reported as failed because we
 * stopped waiting; the payer can resend a prompt that never arrived (after
 * the server's 40s double-tap guard); closing the panel leaves the payment
 * confirming in the background, and a late confirmation still lands.
 */
import { api } from "@/lib/api";
import { getMpesaTransactionStatus, type MpesaTransactionStatus } from "@/lib/billing";

/** Thrown when the payer closes the panel before M-Pesa confirms. Not a failure. */
export class MpesaStillConfirming extends Error {
  constructor(label: string) {
    super(`We're still confirming your M-Pesa payment. Your ${label} will be added as soon as it's confirmed.`);
    this.name = "MpesaStillConfirming";
  }
}

export function isMpesaStillConfirming(e: unknown): e is MpesaStillConfirming {
  return e instanceof MpesaStillConfirming;
}

export const RESEND_AFTER_MS = 45_000;
export const SLOW_AFTER_MS = 120_000;
const FAST_POLL_MS = 3_000;
const SLOW_POLL_MS = 10_000;
const FAST_FOR_MS = 3 * 60_000;
const GIVE_UP_MS = 15 * 60_000;
const DONE_CLOSE_MS = 1_600;

export type FlowPhase = "waiting" | "slow" | "failed" | "done";

export type FlowState = {
  id: number;
  label: string;
  /** Every order sent for this payment, oldest first. Any one completing settles it. */
  attempts: string[];
  startedAt: number;
  lastPushAt: number;
  phase: FlowPhase;
  failure?: string;
  resending: boolean;
  notice?: string;
  checking: boolean;
  open: boolean;
};

/** Pure: which screen the panel shows, given what we know and the time. */
export function flowPhase(
  s: Pick<FlowState, "phase" | "lastPushAt">,
  now: number,
): FlowPhase {
  if (s.phase === "done" || s.phase === "failed") return s.phase;
  return now - s.lastPushAt >= SLOW_AFTER_MS ? "slow" : "waiting";
}

/** Pure: may the payer ask for another prompt yet? */
export function canResend(s: Pick<FlowState, "phase" | "lastPushAt" | "resending">, now: number): boolean {
  if (s.resending || s.phase === "done") return false;
  return s.phase === "failed" || now - s.lastPushAt >= RESEND_AFTER_MS;
}

type Controller = {
  start: () => Promise<{ transaction_id: string }>;
  resolve: (s: MpesaTransactionStatus) => void;
  reject: (e: unknown) => void;
  settled: boolean;
};

let state: FlowState | null = null;
let controller: Controller | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
let onLateConfirm: (label: string) => void = () => {};

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFlow(): FlowState | null {
  return state;
}

/** App wiring: what to do when a payment confirms after its panel closed. */
export function setOnLateConfirm(fn: (label: string) => void): void {
  onLateConfirm = fn;
}

function update(patch: Partial<FlowState>): void {
  if (!state) return;
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function settle(flowId: number, status: MpesaTransactionStatus): void {
  if (!state || state.id !== flowId) return;
  const wasOpen = state.open;
  update({ phase: "done", failure: undefined });
  if (controller && !controller.settled) {
    controller.settled = true;
    controller.resolve(status);
  } else {
    onLateConfirm(state.label);
  }
  if (wasOpen) window.setTimeout(() => state?.id === flowId && update({ open: false }), DONE_CLOSE_MS);
}

async function poll(flowId: number): Promise<void> {
  while (state && state.id === flowId && state.phase !== "done") {
    const elapsed = Date.now() - state.startedAt;
    if (elapsed > GIVE_UP_MS) return; // the server keeps recovering it
    const latest = state.attempts[state.attempts.length - 1];
    for (const tid of [...state.attempts].reverse()) {
      let status: MpesaTransactionStatus;
      try {
        status = await getMpesaTransactionStatus(tid);
      } catch {
        continue;
      }
      if (status.status === "completed") return settle(flowId, status);
      if (status.status === "failed" && tid === latest && state?.id === flowId && state.phase !== "failed") {
        update({ phase: "failed", failure: status.result_description || "M-Pesa didn't complete the payment." });
      }
    }
    if (state?.id === flowId && state.phase !== "failed") {
      update({ phase: flowPhase(state, Date.now()) });
    }
    await sleep(elapsed < FAST_FOR_MS ? FAST_POLL_MS : SLOW_POLL_MS);
  }
}

/**
 * Send the prompt and stay with the payer until M-Pesa confirms. Resolves
 * with the confirmed order; rejects with MpesaStillConfirming if they close
 * the panel first, or with the failure if they close it after one.
 */
export async function runMpesaPayment(opts: {
  label: string;
  start: () => Promise<{ transaction_id: string }>;
}): Promise<MpesaTransactionStatus> {
  const { transaction_id } = await opts.start();
  const now = Date.now();
  const id = nextId++;
  state = {
    id,
    label: opts.label,
    attempts: [transaction_id],
    startedAt: now,
    lastPushAt: now,
    phase: "waiting",
    resending: false,
    checking: false,
    open: true,
  };
  listeners.forEach((fn) => fn());
  return new Promise<MpesaTransactionStatus>((resolve, reject) => {
    controller = { start: opts.start, resolve, reject, settled: false };
    void poll(id);
  });
}

/** "Send it again": a fresh prompt, a new order; earlier ones still count if paid. */
export async function resendPrompt(): Promise<void> {
  if (!state || !controller || !canResend(state, Date.now())) return;
  const flowId = state.id;
  update({ resending: true, notice: undefined });
  try {
    const { transaction_id } = await controller.start();
    if (state?.id !== flowId) return;
    update({
      attempts: [...state.attempts, transaction_id],
      lastPushAt: Date.now(),
      phase: "waiting",
      failure: undefined,
      notice: "New prompt sent. Check your phone.",
    });
  } catch (e) {
    update({ notice: e instanceof Error ? e.message : "Couldn't send another prompt." });
  } finally {
    if (state?.id === flowId) update({ resending: false });
  }
}

/** "I've paid, check now": ask PokeaPay directly about every order sent. */
export async function checkNow(): Promise<void> {
  if (!state || state.checking || state.phase === "done") return;
  const flowId = state.id;
  update({ checking: true, notice: undefined });
  try {
    for (const tid of [...state.attempts].reverse()) {
      const status = await api.post<MpesaTransactionStatus>(
        `/v1/billing/mpesa/transactions/${tid}/recheck`,
      );
      if (status.status === "completed") return settle(flowId, status);
    }
    update({ notice: "Not confirmed yet. If you've paid, it'll be added automatically." });
  } catch {
    update({ notice: "Couldn't check right now. We'll keep trying in the background." });
  } finally {
    if (state?.id === flowId) update({ checking: false });
  }
}

/** The payer closed the panel. Payment keeps confirming in the background. */
export function closePanel(): void {
  if (!state) return;
  const label = state.label;
  const failure = state.phase === "failed" ? state.failure : undefined;
  update({ open: false });
  if (controller && !controller.settled && state.phase !== "done") {
    controller.settled = true;
    controller.reject(failure ? new Error(failure) : new MpesaStillConfirming(label));
  }
}
