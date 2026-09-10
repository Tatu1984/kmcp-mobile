import * as React from "react";

import { RazorpayCheckout, type CheckoutResult, type GatewayOrder } from "../components/razorpay-checkout";

/**
 * Opens a Razorpay checkout sheet and resolves once it closes.
 *
 * Every call site that starts a gateway payment — the wallet top-up, paying a
 * session by UPI, buying a pass — needs the same three things: somewhere to
 * hold the order while the sheet is open, a way to turn "the sheet closed"
 * into a single awaited result, and the `<RazorpayCheckout>` element itself
 * mounted somewhere in the tree. Repeating that per screen would be three
 * copies of the same `useState` plus a resolver ref; this hook is that copy,
 * written once.
 */
export interface CheckoutRequest {
  gatewayKeyId: string;
  gatewayOrder: GatewayOrder;
  description: string;
}

export function useRazorpayCheckout(): {
  open: (request: CheckoutRequest) => Promise<CheckoutResult>;
  modal: React.ReactNode;
} {
  const [request, setRequest] = React.useState<CheckoutRequest | null>(null);
  const resolverRef = React.useRef<((result: CheckoutResult) => void) | null>(null);

  const settle = React.useCallback((result: CheckoutResult) => {
    setRequest(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  }, []);

  const open = React.useCallback((next: CheckoutRequest): Promise<CheckoutResult> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest(next);
    });
  }, []);

  const modal = request
    ? React.createElement(RazorpayCheckout, {
        visible: true,
        gatewayKeyId: request.gatewayKeyId,
        gatewayOrder: request.gatewayOrder,
        description: request.description,
        onResult: settle,
        onRequestClose: () => settle({ status: "cancelled" }),
      })
    : null;

  return { open, modal };
}
