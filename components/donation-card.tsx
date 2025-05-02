import type { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface DonationCardProps {
  title: string
  description: string
  icon: ReactNode
}

export function DonationCard({ title, description, icon }: DonationCardProps) {
  return (
    <Card className="bg-gray-800 border-gray-700 hover:border-red-500 transition-all duration-300">
      <CardHeader className="flex items-center justify-center pt-6">
        <div className="p-3 bg-gray-700 rounded-full mb-4">{icon}</div>
        <h3 className="text-xl font-bold">{title}</h3>
      </CardHeader>
      <CardContent className="text-center text-gray-300">
        <p>{description}</p>
      </CardContent>
    </Card>
  )
}
