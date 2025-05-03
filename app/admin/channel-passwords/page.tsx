"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Lock, Eye, EyeOff, Check, Copy } from "lucide-react"

export default function ChannelPasswordsPage() {
  const [channelPasswords, setChannelPasswords] = useState<{ [key: string]: string }>({})
  const [showPasswords, setShowPasswords] = useState(false)
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null)

  useEffect(() => {
    // Generate the default passwords for channels 22-29
    const passwords: { [key: string]: string } = {}
    for (let i = 22; i <= 29; i++) {
      passwords[i.toString()] = `channel${i}`
    }
    setChannelPasswords(passwords)
  }, [])

  const copyPassword = (channelId: string) => {
    const password = channelPasswords[channelId]
    navigator.clipboard.writeText(password)
    setCopiedChannel(channelId)

    // Clear the copied status after 2 seconds
    setTimeout(() => {
      setCopiedChannel(null)
    }, 2000)
  }

  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Channel Password Management</h1>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-300">
              Manage passwords for protected channels (22-29). These passwords are required for viewers to access these
              channels.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswords(!showPasswords)}
              className="flex items-center gap-2"
            >
              {showPasswords ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Show
                </>
              )}
            </Button>
          </div>

          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left">Channel</th>
                  <th className="px-4 py-3 text-left">Password</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }, (_, i) => (i + 22).toString()).map((channelId) => (
                  <tr key={channelId} className="border-b border-gray-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <Lock className="h-4 w-4 text-red-500 mr-2" />
                        <span>Channel {channelId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {showPasswords ? (
                        <span className="font-mono">{channelPasswords[channelId]}</span>
                      ) : (
                        <span>••••••••••</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyPassword(channelId)}
                        className="text-gray-400 hover:text-white"
                      >
                        {copiedChannel === channelId ? (
                          <>
                            <Check className="h-4 w-4 text-green-500 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-900/30 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 flex items-center">
            <Lock className="h-5 w-5 text-blue-400 mr-2" />
            Password Information
          </h2>
          <ul className="space-y-2 text-gray-300">
            <li>• Default passwords are set to "channel" followed by the channel number (e.g., "channel22")</li>
            <li>• Passwords are stored in the browser and expire after 24 hours</li>
            <li>• For production use, consider implementing server-side password verification</li>
            <li>• Share these passwords only with authorized viewers</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
