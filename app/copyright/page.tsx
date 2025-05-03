import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, Info } from "lucide-react"

export default function CopyrightPage() {
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
            Fair Use & Copyright Policy
          </h1>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 md:p-8 mb-8">
          <div className="prose prose-invert max-w-none">
            <div className="bg-blue-900/30 p-4 rounded-md mb-8 flex">
              <Info className="h-6 w-6 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-400 mb-2">Fair Use Statement</h3>
                <p className="text-gray-300">
                  <strong>
                    All content on Black Truth TV is provided under the Fair Use doctrine of copyright law.
                  </strong>{" "}
                  Our platform is dedicated to education, commentary, criticism, news reporting, research, and
                  scholarship.
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4">1. Fair Use Policy</h2>
            <p>
              Black Truth TV operates under the Fair Use doctrine as outlined in Section 107 of the Copyright Act. All
              content on our platform is provided for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Educational purposes and teaching</li>
              <li>Critical commentary and analysis</li>
              <li>News reporting and journalism</li>
              <li>Research and scholarship</li>
              <li>Historical documentation and archiving</li>
              <li>Public interest and community awareness</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4">2. What is Fair Use?</h2>
            <p>
              Fair use is a legal doctrine that permits limited use of copyrighted material without acquiring permission
              from the rights holders. It is a crucial exception to the exclusive rights granted by copyright law to the
              author of a creative work.
            </p>
            <p className="mt-4">
              According to U.S. Copyright law, the following factors are considered in determining whether the use of a
              work is "fair use":
            </p>
            <ol className="list-decimal pl-6 space-y-2 mb-4">
              <li>
                <strong>Purpose and character of the use</strong>, including whether the use is of a commercial nature
                or is for nonprofit educational purposes
              </li>
              <li>
                <strong>Nature of the copyrighted work</strong>
              </li>
              <li>
                <strong>Amount and substantiality</strong> of the portion used in relation to the copyrighted work as a
                whole
              </li>
              <li>
                <strong>Effect of the use upon the potential market</strong> for or value of the copyrighted work
              </li>
            </ol>

            <div className="bg-green-900/30 p-4 rounded-md my-6">
              <h3 className="flex items-center text-green-400 font-semibold mb-2">
                <CheckCircle className="h-5 w-5 mr-2" />
                Our Fair Use Commitment
              </h3>
              <p>
                Black Truth TV is committed to ensuring all content on our platform qualifies as fair use. We carefully
                curate our content to provide context, commentary, and educational value. Our platform serves as a
                critical resource for education, research, and public discourse.
              </p>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4">3. Transformative Use</h2>
            <p>
              Our content is transformative in nature, meaning we add new meaning, message, or expression to the
              original works. This is achieved through:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Adding commentary and critical analysis</li>
              <li>Providing historical context and educational information</li>
              <li>Curating content for educational purposes</li>
              <li>Organizing content to facilitate research and scholarship</li>
              <li>Presenting content in a way that serves the public interest</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4">4. Copyright Respect</h2>
            <p>
              While operating under fair use, Black Truth TV respects the rights of copyright holders. We acknowledge
              the original creators and sources of content whenever possible. We believe that fair use enhances rather
              than diminishes the value of original works by expanding their reach and impact.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">5. DMCA Compliance</h2>
            <p>
              Despite our commitment to fair use, we respect the rights of copyright owners and comply with the Digital
              Millennium Copyright Act (DMCA). If you believe that content on our platform infringes your copyright and
              does not constitute fair use, you may submit a DMCA takedown notice.
            </p>

            <div className="bg-yellow-900/30 p-4 rounded-md my-6">
              <h3 className="flex items-center text-yellow-400 font-semibold mb-2">
                <AlertTriangle className="h-5 w-5 mr-2" />
                DMCA Takedown Requests
              </h3>
              <p className="mb-3">
                To submit a DMCA takedown notice, please provide the following information to the contact address below:
              </p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>A physical or electronic signature of the copyright owner or authorized agent</li>
                <li>Identification of the copyrighted work claimed to have been infringed</li>
                <li>
                  Identification of the material that is claimed to be infringing and its location on our platform
                </li>
                <li>Your contact information (address, telephone number, email)</li>
                <li>
                  A statement that you have a good faith belief that the use is not authorized by the copyright owner,
                  its agent, or the law
                </li>
                <li>
                  A statement, under penalty of perjury, that the information in the notice is accurate and that you are
                  the copyright owner or authorized to act on behalf of the owner
                </li>
              </ol>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4">6. Educational Mission</h2>
            <p>
              Black Truth TV's primary mission is educational. We believe in the importance of preserving and sharing
              knowledge, particularly regarding historical events, cultural heritage, and social issues that may not be
              adequately covered in mainstream media. Our platform serves as a valuable resource for educators,
              students, researchers, and the general public.
            </p>

            <h2 className="text-2xl font-bold mt-8 mb-4">7. Contact Information</h2>
            <p>
              For copyright inquiries or DMCA notices, please contact us at:
              <br />
              <a href="mailto:copyright@blacktruthtv.com" className="text-red-400 hover:text-red-300">
                copyright@blacktruthtv.com
              </a>
            </p>

            <p className="mt-8 text-sm text-gray-400">
              Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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
