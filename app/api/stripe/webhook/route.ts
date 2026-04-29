import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id

        const updates = {
          membership_tier: 'member',
          membership_status: sub.status === 'active' ? 'active' : 'inactive',
          stripe_subscription_id: sub.id,
          stripe_price_id: sub.items.data[0]?.price.id,
          membership_ends_at: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        }

        if (userId) {
          await supabase.from('user_profiles').update(updates).eq('id', userId)
        } else {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('stripe_customer_id', sub.customer)
            .single()
          if (profile) {
            await supabase.from('user_profiles').update(updates).eq('id', profile.id)
          }
        }

        await supabase.from('membership_events').insert({
          user_id: userId || null,
          stripe_event_id: event.id,
          event_type: event.type,
          tier: 'member',
          status: sub.status,
        }).onConflict('stripe_event_id').ignore()

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = sub.metadata?.supabase_user_id

        if (userId) {
          await supabase.from('user_profiles').update({
            membership_status: 'active',
            membership_tier: 'member',
            membership_ends_at: new Date(sub.current_period_end * 1000).toISOString(),
          }).eq('id', userId)

          await supabase.from('membership_events').insert({
            user_id: userId,
            stripe_event_id: event.id,
            event_type: event.type,
            tier: 'member',
            status: 'active',
            amount_cents: invoice.amount_paid,
          }).onConflict('stripe_event_id').ignore()
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = sub.metadata?.supabase_user_id

        if (userId) {
          await supabase.from('user_profiles').update({
            membership_status: 'past_due',
          }).eq('id', userId)
        }

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id

        const updates = { membership_status: 'cancelled', membership_tier: 'free' }

        if (userId) {
          await supabase.from('user_profiles').update(updates).eq('id', userId)
        } else {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('stripe_customer_id', sub.customer)
            .single()
          if (profile) {
            await supabase.from('user_profiles').update(updates).eq('id', profile.id)
          }
        }

        await supabase.from('membership_events').insert({
          user_id: userId || null,
          stripe_event_id: event.id,
          event_type: event.type,
          status: 'cancelled',
        }).onConflict('stripe_event_id').ignore()

        break
      }

      default:
        console.log(`Unhandled event: ${event.type}`)
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
