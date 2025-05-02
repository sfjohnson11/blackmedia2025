import { Button } from "@/components/ui/button"

interface DonationTiersProps {
  stripeUrl: string
}

export function DonationTiers({ stripeUrl }: DonationTiersProps) {
  return (
    <div className="my-16">
      <h2 className="text-3xl font-bold text-center mb-8">Choose Your Impact Level</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-red-500 transition-all duration-300">
          <h3 className="text-xl font-bold mb-2">Supporter</h3>
          <div className="text-3xl font-bold text-red-500 mb-4">
            $10<span className="text-lg text-gray-400">/month</span>
          </div>
          <ul className="space-y-2 mb-6 text-gray-300">
            <li>• Support our basic operations</li>
            <li>• Recognition on our website</li>
            <li>• Monthly newsletter</li>
          </ul>
          <a href={`${stripeUrl}?amount=1000`} target="_blank" rel="noopener noreferrer" className="block w-full">
            <Button className="w-full bg-gray-700 hover:bg-gray-600">Donate $10</Button>
          </a>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border-2 border-red-500 transform scale-105 shadow-lg relative">
          <div className="absolute -top-4 left-0 right-0 text-center">
            <span className="bg-red-500 text-white px-4 py-1 rounded-full text-sm font-bold">Most Popular</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Champion</h3>
          <div className="text-3xl font-bold text-red-500 mb-4">
            $25<span className="text-lg text-gray-400">/month</span>
          </div>
          <ul className="space-y-2 mb-6 text-gray-300">
            <li>• Fund new content creation</li>
            <li>• Early access to new features</li>
            <li>• Quarterly virtual meetups</li>
            <li>• All Supporter benefits</li>
          </ul>
          <a href={`${stripeUrl}?amount=2500`} target="_blank" rel="noopener noreferrer" className="block w-full">
            <Button className="w-full bg-red-600 hover:bg-red-700">Donate $25</Button>
          </a>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-red-500 transition-all duration-300">
          <h3 className="text-xl font-bold mb-2">Visionary</h3>
          <div className="text-3xl font-bold text-red-500 mb-4">
            $50<span className="text-lg text-gray-400">/month</span>
          </div>
          <ul className="space-y-2 mb-6 text-gray-300">
            <li>• Help expand to new channels</li>
            <li>• Input on content direction</li>
            <li>• Special recognition in credits</li>
            <li>• All Champion benefits</li>
          </ul>
          <a href={`${stripeUrl}?amount=5000`} target="_blank" rel="noopener noreferrer" className="block w-full">
            <Button className="w-full bg-gray-700 hover:bg-gray-600">Donate $50</Button>
          </a>
        </div>
      </div>

      <div className="text-center mt-8">
        <a href={stripeUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="link" className="text-red-400 hover:text-red-300">
            Or make a custom donation amount
          </Button>
        </a>
      </div>
    </div>
  )
}
