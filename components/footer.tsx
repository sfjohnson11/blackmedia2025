import Link from "next/link"
import { Heart } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-black text-gray-400 py-10 border-t border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white text-lg font-bold mb-4">Black Truth TV</h3>
            <p className="mb-4">Bringing truth and knowledge through quality programming 24/7.</p>
            <Link href="/donate" className="text-red-500 hover:text-red-400 flex items-center">
              <Heart className="h-4 w-4 mr-1" />
              Support Our Mission
            </Link>
          </div>

          <div>
            <h3 className="text-white text-lg font-bold mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/channels" className="hover:text-white">
                  Channels
                </Link>
              </li>
              <li>
                <Link href="/browse" className="hover:text-white">
                  Browse
                </Link>
              </li>
              <li>
                <Link href="/donate" className="hover:text-white">
                  Donate
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-lg font-bold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/copyright" className="hover:text-white">
                  Copyright
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-lg font-bold mb-4">Connect</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact Us
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Facebook
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Twitter
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p>&copy; {new Date().getFullYear()} Black Truth TV. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
