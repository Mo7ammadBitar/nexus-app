import React from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';

import api from '../../services/api';
import toast from 'react-hot-toast';

/**
 * PayPalCheckoutButton — Creates a PayPal order server-side,
 * then passes the orderID to the parent for SERVER-SIDE verification.
 *
 * Props:
 *   itemId    (string)   — e.g. "pack_small" or "monthly"
 *   onApproved (function) — called with (orderID) after user approves in PayPal
 */
const PayPalCheckoutButton = ({ itemId, onApproved }) => {
    return (
        <div style={{ width: '100%', minWidth: 150, margin: '0 auto' }}>
            <PayPalButtons
                forceReRender={[itemId]}
                style={{
                    layout: 'horizontal',
                    color: 'gold',
                    shape: 'rect',
                    label: 'paypal',
                    height: 40,
                    tagline: false,
                }}
                createOrder={async (data, actions) => {
                    try {
                        console.log('[PayPal] Creating order server-side for item:', itemId);
                        const response = await api.post('/payments/create-order', {
                            item_id: itemId
                        });
                        return response.data.order_id;
                    } catch (err) {
                        console.error('[PayPal] Order creation failed:', err);
                        toast.error('Failed to create order. Please try again.');
                        throw err; // Stop PayPal flow
                    }
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
