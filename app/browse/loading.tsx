import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="pt-24 px-4 md:px-10 flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center">
        <Loader2 className="h-12 w-12 text-red-600 animate-spin mb-4" />
        <p className="text-xl">Loading channels...</p>
      </div>
    </div>
  )
}
