# Backend Integration Guide: YooKassa

This guide provides the Cloud Functions code required to integrate YooKassa.
**Note**: This code is "Prepared" but not yet deployed.

## 1. Dependencies
You need to install the YooKassa SDK in your functions folder:
```bash
cd functions
npm install yookassa-ts uuid
```

## 2. Implementation (`functions/src/payments.ts`)

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { YooCheckout, ICreatePayment } from "@a2seven/yookassa-ts";
import { v4 as uuidv4 } from "uuid";

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// 🟢 CONFIGURATION
// Replace these with your actual keys when ready
const CHECKOUT = new YooCheckout({
  shopId: "YOUR_SHOP_ID",
  secretKey: "YOUR_SECRET_KEY"
});

/**
 * 1. Create Payment Endpoint
 * POST /payments/create
 * Body: { orderId: "...", amount: 1500, returnUrl: "..." }
 */
export const createPayment = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { orderId, amount, returnUrl } = req.body;
    if (!orderId || !amount) {
      res.status(400).send("Missing orderId or amount");
      return;
    }

    const idempotenceKey = uuidv4();

    const createPayload: ICreatePayment = {
      amount: {
        value: amount.toString(),
        currency: "RUB"
      },
      capture: true, // Auto-capture
      confirmation: {
        type: "redirect",
        return_url: returnUrl || "https://your-app-scheme/payment-success"
      },
      metadata: {
        orderId: orderId
      },
      description: \`Order \${orderId}\`
    };

    const payment = await CHECKOUT.createPayment(createPayload, idempotenceKey);

    // Save to Firestore 'payments' collection
    await db.collection("payments").doc(payment.id).set({
      paymentId: payment.id,
      orderId: orderId,
      status: payment.status, // 'pending'
      amount: parseFloat(payment.amount.value),
      currency: payment.amount.currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      test: payment.test
    });

    // Link payment to Order
    await db.collection("orders").doc(orderId).update({
      paymentId: payment.id,
      paymentStatus: "pending"
    });

    res.status(200).json({
      paymentId: payment.id,
      confirmationUrl: payment.confirmation.confirmation_url
    });

  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).send("Internal Server Error");
  }
});

/**
 * 2. Webhook Endpoint
 * POST /payments/webhook
 * Set this URL in YooKassa Dashboard settings
 */
export const paymentWebhook = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const event = req.body;
    // event.type usually 'notification'
    // event.event usually 'payment.succeeded' or 'payment.canceled'

    if (!event || !event.object) {
      res.status(400).send("Invalid Webhook Payload");
      return;
    }

    const payment = event.object;
    const paymentId = payment.id;
    const status = payment.status; // 'succeeded', 'canceled'
    const orderId = payment.metadata?.orderId;

    console.log(\`Webhook received for \${paymentId}: \${status}\`);

    // 1. Update Payment Document
    await db.collection("payments").doc(paymentId).update({
      status: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: payment.payment_method // e.g., type: 'bank_card'
    });

    // 2. Update Order Document
    if (orderId) { // Only if we linked it
        const updates: any = {
            paymentStatus: status
        };
        
        // If succeeded, mark method as online/card
        if (status === "succeeded") {
            updates.paymentMethod = "online_card"; 
            // Optional: Mark order as Paid?
            // updates.status = "completed"; // Uncomment if you want auto-completion
        }

        await db.collection("orders").doc(orderId).update(updates);
    }

    res.status(200).send("OK");

  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Internal Server Error");
  }
});
```

## 3. Deployment
Run:
```bash
firebase deploy --only functions
```

## 4. Firestore Schema Update
- **Collection**: `payments` (Created automatically)
- **Collection**: `orders`
    - `paymentId`: String
    - `paymentStatus`: String ("pending", "succeeded", "canceled")
    - `paymentMethod`: String ("online" or "cash")
