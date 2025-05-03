import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Shield } from "lucide-react"

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-24 px-4 md:px-10 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center">
            <Shield className="h-6 w-6 mr-2 text-red-500" />
            Privacy Policy
          </h1>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 md:p-8 mb-8">
          <div className="prose prose-invert max-w-none">
            <p className="text-lg mb-6">
              Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>

            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
            <p>
              Welcome to Black Truth TV. We are committed to protecting your privacy and providing you with a safe and
              secure viewing experience. This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our streaming service.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Personal Information</h3>
            <p>We may collect the following types of personal information:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Contact information (such as name and email address)</li>
              <li>Account credentials</li>
              <li>Payment information (processed securely through our payment providers)</li>
              <li>Demographic information</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.2 Usage Information</h3>
            <p>We collect information about how you use our service, including:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Viewing history and preferences</li>
              <li>Device information (type, operating system, browser)</li>
              <li>IP address and location data</li>
              <li>Log data and analytics information</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Provide, maintain, and improve our streaming service</li>
              <li>Process transactions and send related information</li>
              <li>Send administrative messages, updates, and security alerts</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Personalize your experience and deliver content relevant to your interests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4">4. Sharing Your Information</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Service providers who perform services on our behalf</li>
              <li>Partners with whom we offer co-branded services or products</li>
              <li>Law enforcement or other government agencies, as required by law</li>
            </ul>
            <p>
              We do not sell your personal information to third parties for marketing purposes without your explicit
              consent.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">5. Your Rights and Choices</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Accessing, correcting, or deleting your personal information</li>
              <li>Withdrawing your consent at any time</li>
              <li>Opting out of marketing communications</li>
              <li>Requesting a copy of your personal information</li>
            </ul>
            <p>
              To exercise these rights, please contact us using the information provided in the "Contact Us" section
              below.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information
              against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission
              over the Internet or electronic storage is 100% secure, so we cannot guarantee absolute security.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">7. Children's Privacy</h2>
            <p>
              Our service is not intended for children under the age of 13. We do not knowingly collect personal
              information from children under 13. If you are a parent or guardian and believe that your child has
              provided us with personal information, please contact us.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">8. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy
              Policy periodically for any changes.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">9. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
              <br />
              <a href="mailto:privacy@blacktruthtv.com" className="text-red-400 hover:text-red-300">
                privacy@blacktruthtv.com
              </a>
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link href="/">
            <Button variant="outline" className="bg-gray-800 text-white hover:bg-gray-700 border-gray-600">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
