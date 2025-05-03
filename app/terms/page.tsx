import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, ExternalLink } from "lucide-react"

export default function TermsOfServicePage() {
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
            <FileText className="h-6 w-6 mr-2 text-red-500" />
            Terms of Service
          </h1>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 md:p-8 mb-8">
          <div className="prose prose-invert max-w-none">
            <p className="text-lg mb-6">
              Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>

            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Black Truth TV, you agree to be bound by these Terms of Service and all applicable
              laws and regulations. If you do not agree with any of these terms, you are prohibited from using or
              accessing this site.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">2. Fair Use Content</h2>
            <p>
              All content provided on Black Truth TV is offered under the Fair Use doctrine of copyright law. Please
              refer to our{" "}
              <Link href="/copyright" className="text-red-400 hover:text-red-300">
                Fair Use & Copyright Policy
              </Link>{" "}
              for more information.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">3. Use License</h2>
            <p>
              Permission is granted to temporarily access the materials on Black Truth TV for personal, non-commercial
              viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose</li>
              <li>Attempt to decompile or reverse engineer any software contained on the platform</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
              <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
            </ul>
            <p>
              This license shall automatically terminate if you violate any of these restrictions and may be terminated
              by Black Truth TV at any time.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">4. User Accounts</h2>
            <p>
              Some areas of Black Truth TV may require registration or may otherwise ask you to provide information to
              participate in certain features or access certain content. If you choose to register or provide
              information, you agree to provide accurate and current information about yourself.
            </p>
            <p className="mt-4">
              You are responsible for maintaining the confidentiality of your account password and for restricting
              access to your computer. You agree to accept responsibility for all activities that occur under your
              account.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">5. Protected Channels</h2>
            <p>
              Some channels on Black Truth TV may be password-protected and require special access. You agree not to
              share, distribute, or otherwise make these passwords available to unauthorized users. Unauthorized access
              to protected channels is strictly prohibited.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">6. Disclaimer</h2>
            <p>
              The materials on Black Truth TV are provided on an 'as is' basis. Black Truth TV makes no warranties,
              expressed or implied, and hereby disclaims and negates all other warranties including, without limitation,
              implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement
              of intellectual property or other violation of rights.
            </p>
            <p className="mt-4">
              Further, Black Truth TV does not warrant or make any representations concerning the accuracy, likely
              results, or reliability of the use of the materials on its website or otherwise relating to such materials
              or on any sites linked to this site.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">7. Limitations</h2>
            <p>
              In no event shall Black Truth TV or its suppliers be liable for any damages (including, without
              limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or
              inability to use the materials on Black Truth TV, even if Black Truth TV or a Black Truth TV authorized
              representative has been notified orally or in writing of the possibility of such damage.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">8. Links</h2>
            <p>
              Black Truth TV has not reviewed all of the sites linked to its website and is not responsible for the
              contents of any such linked site. The inclusion of any link does not imply endorsement by Black Truth TV
              of the site. Use of any such linked website is at the user's own risk.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">9. Modifications</h2>
            <p>
              Black Truth TV may revise these terms of service for its website at any time without notice. By using this
              website you are agreeing to be bound by the then current version of these terms of service.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">10. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of the United States
              and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">11. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
              <br />
              <a href="mailto:terms@blacktruthtv.com" className="text-red-400 hover:text-red-300">
                terms@blacktruthtv.com
              </a>
            </p>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <Link href="/">
            <Button variant="outline">Return to Home</Button>
          </Link>
          <Link href="/privacy">
            <Button variant="outline" className="flex items-center">
              Privacy Policy
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </Link>
          <Link href="/copyright">
            <Button variant="outline" className="flex items-center">
              Copyright Policy
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
