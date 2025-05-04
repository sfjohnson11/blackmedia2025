import { FreedomSchoolSignUp } from "@/components/freedom-school-signup"
import { FreedomSchoolPlayer } from "@/components/freedom-school-player"
import Image from "next/image"

export const metadata = {
  title: "Freedom School - Black Truth TV",
  description: "Sign up for our Freedom School program in the tradition of African American History",
}

export default function FreedomSchoolPage() {
  return (
    <div className="min-h-screen bg-black pt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="relative w-full h-[40vh] md:h-[50vh] rounded-xl overflow-hidden mb-12">
          <Image
            src="/placeholder.svg?key=freedom-school-hero"
            alt="Freedom School"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Freedom School</h1>
            <p className="text-xl md:text-2xl text-gray-200 max-w-3xl">
              Continuing the tradition of education for liberation in the African American community
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-xl p-6 md:p-8 mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">About Our Freedom School</h2>
              <p className="text-gray-300 mb-4">
                Our Freedom School continues the powerful legacy established during the Civil Rights Movement, where
                education was recognized as a path to liberation and social change.
              </p>
              <p className="text-gray-300 mb-4">
                At Black Truth TV's Freedom School, we offer courses that explore African American history, culture,
                literature, and social justice. Our curriculum is designed to empower, educate, and inspire participants
                of all ages.
              </p>
              <p className="text-gray-300 mb-4">
                Classes are held weekly on our Family Channel and include interactive elements, recommended readings,
                and community discussions.
              </p>
            </div>

            {/* Freedom School Channel Player */}
            <div className="bg-gray-900 rounded-xl p-6 md:p-8 mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Freedom School Channel</h2>
              <p className="text-gray-300 mb-4">
                Watch our continuous stream of educational content about the history and significance of Freedom Schools
                in the African American tradition.
              </p>
              <FreedomSchoolPlayer />
            </div>

            <div className="bg-gray-900 rounded-xl p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Upcoming Courses</h2>
              <div className="space-y-6">
                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="text-xl font-semibold">The History of Freedom Schools</h3>
                  <p className="text-gray-400">Starting June 15th • 8 Sessions</p>
                  <p className="text-gray-300 mt-2">
                    Explore the origins and impact of Freedom Schools during the Civil Rights Movement and their
                    continuing legacy today.
                  </p>
                </div>

                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="text-xl font-semibold">African American Literature: Voices of Resistance</h3>
                  <p className="text-gray-400">Starting July 10th • 10 Sessions</p>
                  <p className="text-gray-300 mt-2">
                    Discover powerful works by African American authors who used their writing as a form of resistance
                    and cultural preservation.
                  </p>
                </div>

                <div className="border-l-4 border-red-600 pl-4">
                  <h3 className="text-xl font-semibold">Youth Leadership Development</h3>
                  <p className="text-gray-400">Starting August 5th • Ongoing</p>
                  <p className="text-gray-300 mt-2">
                    A program designed specifically for young people to develop leadership skills through the lens of
                    social justice and community organizing.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sign-up Form */}
          <div className="lg:col-span-1">
            <FreedomSchoolSignUp />
          </div>
        </div>
      </div>
    </div>
  )
}
