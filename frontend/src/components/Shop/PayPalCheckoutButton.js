import React, { useMemo } from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';

/**
 * PayPalCheckoutButton — Creates a PayPal order client-side,
 * then passes the orderID to the parent for SERVER-SIDE verification.
 *
 * Props:
 *   amount    (string)   — e.g. "4.99"
 *   onApproved (function) — called with (orderID) after user approves in PayPal
 */
const PayPalCheckoutButton = ({ amount, onApproved }) => {
    const sanitizedAmount = useMemo(() => {
        if (!amount && amount !== 0) return '1.00';
        const cleaned = String(amount).replace(/[^0-9.]/g, '');
        const parsed = parseFloat(cleaned);
        if (isNaN(parsed) || parsed <= 0) return '1.00';
        return parsed.toFixed(2);
    }, [amount]);

    return (
        <div style={{ width: '100%', minWidth: 150, margin: '0 auto' }}>
            <PayPalButtons
                forceReRender={[sanitizedAmount]}
                style={{
                    layout: 'horizontal',
                    color: 'gold',
                    shape: 'rect',
                    label: 'paypal',
                    height: 40,
                    tagline: false,
                }}
                createOrder={(data, actions) => {
                    console.log('[PayPal] Creating order — amount:', sanitizedAmount);
                    return actions.order.create({
                        purchase_units: [
                            {
                                description: 'Nexus Purchase',
                                amount: {
                                    currency_code: 'USD',
                                    value: sanitizedAmount,
                                },
                            },
                        ],
                        // Do NOT auto-capture — let our backend capture & verify
                        intent: 'CAPTURE',
                    });
                }}
                onApprove={async (data) => {
                    // User approved in PayPal popup — send orderID to parent
                    // The parent will call our backend to capture + verify
                    console.log('[PayPal] User approved — orderID:', data.orderID);
                    if (onApproved) onApproved(data.orderID);
                }}
                onError={(err) => {
                    console.error('[PayPal] Checkout Error:', err);
                }}
                onCancel={() => {
                    console.log('[PayPal] Payment cancelled by user.');
                }}
            />
        </div>
    );
};

export default PayPalCheckoutButton;
