import Image from "next/image"

export function DonationHeader() {
  return (
    <div className="relative w-full h-[300px] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black z-10"></div>
      <Image
        src="/placeholder.svg?key=eargl"
        alt="Support Black Truth TV"
        width={1200}
        height={600}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">Support Our Mission</h1>
        </div>
      </div>
    </div>
  )
}
