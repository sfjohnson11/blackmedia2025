'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ChannelHealth {
  channelId: number
  channelName: string
  status: 'great' | 'good' | 'warning' | 'critical' | 'expired' | 'no_content' | 'error'
  endTime: string | null
  hoursRemaining: number
  programCount: number
}

const STATUS_CONFIG = {
  great:      { label: '✓ Great',     color: '#4ca87c', bg: 'rgba(76,168,124,0.1)',  border: 'rgba(76,168,124,0.3)',  desc: '7+ days' },
  good:       { label: '✓ Good',      color: '#4c9cc9', bg: 'rgba(76,156,201,0.1)',  border: 'rgba(76,156,201,0.3)',  desc: '2–7 days' },
  warning:    { label: '⚠ Warning',   color: '#c9a84c', bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.3)',  desc: '24–48 hrs' },
  critical:   { label: '⚡ Critical',  color: '#ff6b35', bg: 'rgba(255,107,53,0.1)',  border: 'rgba(255,107,53,0.3)',  desc: 'Under 24hrs' },
  expired:    { label: '✗ Expired',   color: '#c94c4c', bg: 'rgba(201,76,76,0.1)',   border: 'rgba(201,76,76,0.3)',   desc: 'No content' },
  no_content: { label: '— Empty',     color: '#555',    bg: 'rgba(85,85,85,0.1)',    border: 'rgba(85,85,85,0.3)',    desc: 'No programs' },
  error:      { label: '✗ Error',     color: '#c94c4c', bg: 'rgba(201,76,76,0.1)',   border: 'rgba(201,76,76,0.3)',   desc: 'Error' },
}

export default function ScheduleHealthPage() {
  const [health, setHealth] = useState<ChannelHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)

  async function loadHealth() {
    setLoading(true)
    try {
      const res = await fetch('/api/cron/schedule-health')
      const data = await res.json()
      setHealth(data.health || [])
      setLastChecked(data.checkedAt)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function runNow() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/cron/auto-extend', { method: 'POST' })
      const data = await res.json()
      setRunResult(data)
      await loadHealth()
    } catch (e: any) {
      setRunResult({ error: e.message })
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => { loadHealth() }, [])

  const counts = {
    great:   health.filter(h => h.status === 'great').length,
    good:    health.filter(h => h.status === 'good').length,
    warning: health.filter(h => h.status === 'warning').length,
    critical: health.filter(h => h.status === 'critical').length,
    expired: health.filter(h => h.status === 'expired' || h.status === 'no_content').length,
  }

  const needsAttention = health.filter(h =>
    ['warning', 'critical', 'expired', 'no_content'].includes(h.status)
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">Schedule Health Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">
              Cron runs every night at 2am UTC and auto-extends any channel ending within 48 hours.
              {lastChecked && ` Last checked: ${new Date(lastChecked).toLocaleString()}`}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={loadHealth}
              disabled={loading}
              className="px-4 py-2 border border-gray-600 rounded-lg text-sm hover:border-yellow-500/40 transition"
            >
              {loading ? 'Refreshing...' : '↻ Refresh'}
            </button>
            <button
              onClick={runNow}
              disabled={running}
              className="px-4 py-2 bg-yellow-400 text-black rounded-lg text-sm font-bold uppercase hover:bg-yellow-300 transition disabled:opacity-40"
            >
              {running ? 'Running...' : '▶ Run Cron Now'}
            </button>
            <Link href="/admin" className="px-4 py-2 border border-gray-600 rounded-lg text-sm hover:border-gray-400 transition">
              ← Admin
            </Link>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Great (7d+)',     count: counts.great,    color: '#4ca87c' },
            { label: 'Good (2-7d)',     count: counts.good,     color: '#4c9cc9' },
            { label: 'Warning (24-48h)', count: counts.warning, color: '#c9a84c' },
            { label: 'Critical (<24h)', count: counts.critical,  color: '#ff6b35' },
            { label: 'Empty/Expired',   count: counts.expired,  color: '#c94c4c' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Run result */}
        {runResult && (
          <div className={`rounded-xl p-4 border ${runResult.error ? 'bg-red-950/30 border-red-700' : 'bg-green-950/30 border-green-700'}`}>
            <div className="text-sm font-semibold mb-2" style={{ color: runResult.error ? '#f09090' : '#7de0b0' }}>
              {runResult.error
                ? `✗ Error: ${runResult.error}`
                : `✓ Cron completed — ${runResult.channels_extended} channel(s) extended, ${runResult.channels_checked} checked`
              }
            </div>
            {runResult.results && (
              <div className="space-y-1">
                {runResult.results
                  .filter((r: any) => r.status === 'extended' || r.status === 'error')
                  .map((r: any, i: number) => (
                    <div key={i} className="text-xs text-gray-300">
                      <span style={{ color: r.status === 'extended' ? '#7de0b0' : '#f09090' }}>
                        Ch {r.channelId} {r.channelName}:
                      </span>
                      {' '}{r.message}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Needs attention */}
        {needsAttention.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-yellow-400 font-semibold mb-3">
              ⚠ Needs Attention ({needsAttention.length})
            </div>
            <div className="space-y-2">
              {needsAttention.map(ch => {
                const cfg = STATUS_CONFIG[ch.status] || STATUS_CONFIG.error
                return (
                  <div
                    key={ch.channelId}
                    className="flex items-center justify-between px-4 py-3 rounded-xl flex-wrap gap-2"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold w-8 text-center" style={{ color: cfg.color }}>
                        {ch.channelId}
                      </span>
                      <span className="font-semibold text-sm">{ch.channelName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs flex-wrap">
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="text-gray-400">{ch.hoursRemaining}h remaining</span>
                      <span className="text-gray-500">{ch.programCount} programs</span>
                      {ch.endTime && (
                        <span className="text-gray-500">
                          ends {new Date(ch.endTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All channels table */}
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">
            All Channels ({health.length})
          </div>
          {loading ? (
            <div className="text-gray-400 text-sm text-center py-8">Loading channel health...</div>
          ) : (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    {['Ch', 'Channel', 'Status', 'Hours Left', 'Schedule Ends', 'Programs'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {health.map(ch => {
                    const cfg = STATUS_CONFIG[ch.status] || STATUS_CONFIG.error
                    return (
                      <tr key={ch.channelId} className="border-t border-gray-800 hover:bg-gray-800/40">
                        <td className="px-4 py-3 text-gray-400 text-xs">{ch.channelId}</td>
                        <td className="px-4 py-3 font-medium">{ch.channelName}</td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: cfg.color }}>
                          {ch.hoursRemaining > 0 ? `${ch.hoursRemaining}h` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {ch.endTime
                            ? new Date(ch.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {ch.programCount.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-yellow-400 font-semibold mb-3">
            How Auto-Scheduling Works
          </div>
          <div className="space-y-2 text-sm text-gray-400">
            <p>🕑 <strong className="text-white">Every night at 2am UTC</strong> — Vercel cron calls <code className="text-yellow-400">/api/cron/auto-extend</code> automatically.</p>
            <p>🔍 <strong className="text-white">Checks all 31 channels</strong> — finds any channel whose schedule ends within 48 hours.</p>
            <p>🔁 <strong className="text-white">Auto-extends by 7 days</strong> — loops existing content forward. No manual work needed.</p>
            <p>📊 <strong className="text-white">This dashboard</strong> — shows the health of every channel in real time.</p>
            <p>▶ <strong className="text-white">Run Cron Now button</strong> — triggers the cron manually anytime you want.</p>
          </div>
        </div>

      </div>
    </div>
  )
}
