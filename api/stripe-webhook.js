// api/stripe-webhook.js — Handle Stripe subscription events
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('New subscription started:', session.customer_email, session.subscription);
      // TODO: save to Supabase — mark user as subscribed
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('Subscription cancelled:', sub.customer);
      // TODO: revoke access in Supabase
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('Payment failed:', invoice.customer_email);
      // TODO: notify user, restrict access
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log('Subscription updated:', sub.customer, sub.status);
      break;
    }
    default:
      console.log('Unhandled event:', event.type);
  }

  return res.status(200).json({ received: true });
}
