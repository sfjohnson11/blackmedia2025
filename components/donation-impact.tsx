export function DonationImpact() {
  return (
    <div className="my-16 bg-gray-800 rounded-lg p-8">
      <h2 className="text-3xl font-bold text-center mb-8">Your Impact</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="text-4xl font-bold text-red-500 mb-2">29</div>
          <p className="text-xl text-gray-300">Channels Supported</p>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-red-500 mb-2">24/7</div>
          <p className="text-xl text-gray-300">Hours of Content</p>
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold text-red-500 mb-2">1000+</div>
          <p className="text-xl text-gray-300">Community Members</p>
        </div>
      </div>
      <div className="mt-8 text-center text-gray-300">
        <p className="max-w-3xl mx-auto">
          Your donations directly impact our ability to create and distribute quality content. With your support, we can
          continue to grow our platform and reach more viewers with important messages that educate and inspire.
        </p>
      </div>
    </div>
  )
}
