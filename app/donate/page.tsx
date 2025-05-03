import Link from "next/link"
import { Heart, DollarSign, Users, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DonationCard } from "@/components/donation-card"
import { DonationTiers } from "@/components/donation-tiers"
import { DonationFAQ } from "@/components/donation-faq"
import { DonationImpact } from "@/components/donation-impact"
import { DonationHeader } from "@/components/donation-header"

export default function DonatePage() {
  const stripeUrl = "https://donate.stripe.com/8wM8xL9TreuzeIMcRM"

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-b from-black to-gray-900">
      <DonationHeader />

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Support Black Truth TV</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Your donation helps us continue to provide quality content that educates, inspires, and empowers our
            community.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <DonationCard
            title="Support Our Mission"
            description="Help us continue to bring truth and knowledge to our community through quality programming."
            icon={<Heart className="h-10 w-10 text-red-500" />}
          />
          <DonationCard
            title="Expand Our Reach"
            description="Your donation helps us reach more viewers and expand our channel offerings."
            icon={<Users className="h-10 w-10 text-blue-500" />}
          />
          <DonationCard
            title="Sustain Our Future"
            description="Regular donations ensure we can continue our work for years to come."
            icon={<Clock className="h-10 w-10 text-green-500" />}
          />
        </div>

        <div className="text-center mb-16">
          <a href={stripeUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-xl rounded-lg flex items-center gap-3"
            >
              <DollarSign className="h-6 w-6" />
              Make a One-Time Donation
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </a>
          <p className="mt-4 text-gray-400">Secure one-time payments processed by Stripe</p>
          <p className="mt-2 text-gray-400">Default amount is $10, but you can donate any amount you choose</p>
        </div>

        <DonationTiers stripeUrl={stripeUrl} />

        <DonationImpact />

        <DonationFAQ />

        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold mb-6">Other Ways to Support</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Share Our Content</h3>
              <p className="text-gray-300 mb-4">Help spread the word by sharing our content on social media.</p>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  Visit Channel
                </Button>
              </Link>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Become a Partner</h3>
              <p className="text-gray-300 mb-4">Interested in partnering with Black Truth TV? Get in touch with us.</p>
              <Link href="/contact">
                <Button variant="outline" className="w-full">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
