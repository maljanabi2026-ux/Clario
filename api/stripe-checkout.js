// api/stripe-checkout.js — Create Stripe Checkout session
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  clarity_monthly:  'price_1TBOHMCHBEeHq8zhyWdK4Ipf',
  clarity_annual:   'price_1TBOKuCHBEeHq8zhB68WC6iq',
  insight_monthly:  'price_1TBOIFCHBEeHq8zh1tCJpwH8',
  insight_annual:   'price_1TBON9CHBEeHq8zhhc9tNCk9',
  mastery_monthly:  'price_1TBOJACHBEeHq8zhT8aEoCFE',
  mastery_annual:   'price_1TBOOVCHBEeHq8zho2YxYfK3',
};

const BASE_URL = 'https://clarioai.ae';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { plan, billing } = req.body;

  if (!plan || !billing) {
    return res.status(400).json({ error: 'plan and billing are required' });
  }

  const key = `${plan}_${billing}`;
  const priceId = PRICES[key];

  if (!priceId) {
    return res.status(400).json({ error: `Invalid plan/billing: ${key}` });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 3,
      },
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/#pricing`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
