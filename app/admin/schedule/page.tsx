// /pages/admin/schedule.tsx
"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { format } from "date-fns"

interface Program {
  id: number
  channel_id: string
  title: string
  mp4_url: string
  start_time: string
  duration: number
}

interface Channel {
  id: string
  name: string
}

export default function ProgramScheduler() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedChannel, setSelectedChannel] = useState<string>("")

  const [newProgram, setNewProgram] = useState({
    title: "",
    mp4_url: "",
    start_time: "",
    duration: 1800,
  })

  useEffect(() => {
    async function load() {
      const { data: channelsData } = await supabase.from("channels").select("id, name")
      const { data: programsData } = await supabase.from("programs").select("*").order("start_time")
      if (channelsData) {
        setChannels(channelsData)
        setSelectedChannel(channelsData[0]?.id || "")
      }
      if (programsData) setPrograms(programsData)
    }
    load()
  }, [])

  const handleAddProgram = async () => {
    const payload = { ...newProgram, channel_id: selectedChannel }
    const { error } = await supabase.from("programs").insert([payload])
    if (!error) {
      setPrograms([...programs, { ...payload, id: Date.now() }])
      setNewProgram({ title: "", mp4_url: "", start_time: "", duration: 1800 })
    }
  }

  const handleInputChange = (field: string, value: string | number) => {
    setNewProgram((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Program Scheduler</h1>
      <Tabs defaultValue={selectedChannel} onValueChange={setSelectedChannel}>
        <TabsList className="overflow-x-auto whitespace-nowrap mb-6">
          {channels.map((channel) => (
            <TabsTrigger key={channel.id} value={channel.id}>
              {channel.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {channels.map((channel) => (
          <TabsContent key={channel.id} value={channel.id}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-4">
                <h2 className="font-bold mb-2">Add New Program</h2>
                <Input
                  placeholder="Title"
                  value={newProgram.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  className="mb-2"
                />
                <Input
                  placeholder="MP4 URL (filename.mp4)"
                  value={newProgram.mp4_url}
                  onChange={(e) => handleInputChange("mp4_url", e.target.value)}
                  className="mb-2"
                />
                <Input
                  type="datetime-local"
                  placeholder="Start Time"
                  value={newProgram.start_time}
                  onChange={(e) => handleInputChange("start_time", e.target.value)}
                  className="mb-2"
                />
                <Input
                  type="number"
                  placeholder="Duration (seconds)"
                  value={newProgram.duration}
                  onChange={(e) => handleInputChange("duration", parseInt(e.target.value))}
                  className="mb-2"
                />
                <Button onClick={handleAddProgram} className="w-full">Add Program</Button>
              </Card>

              <Card className="p-4">
                <h2 className="font-bold mb-2">Upcoming Programs</h2>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {programs
                    .filter((p) => p.channel_id === selectedChannel)
                    .map((program) => (
                      <div key={program.id} className="p-2 border-b border-gray-700">
                        <div className="font-semibold">{program.title}</div>
                        <div className="text-sm text-gray-400">
                          {format(new Date(program.start_time), "PPP p")} – {program.duration}s
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
