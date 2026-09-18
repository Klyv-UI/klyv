'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { CopyButton } from '../CopyButton'
import { Input } from '../Input'
import { Progress } from '../Progress'
import { Text } from '../Text'
import { Textarea } from '../Textarea'
import { StatusPill } from '../internal/StatusPill'

export type PeerLinkSignalling = 'manual' | 'broadcast'

export interface PeerLinkProps {
  /** This peer's name, shown in the header and on its messages. */
  label: string
  /** Copy/paste the SDP by hand, or exchange it with other tabs and panels over a BroadcastChannel. */
  signalling?: PeerLinkSignalling
  /** BroadcastChannel name for `broadcast` signalling. Peers on the same name find each other. */
  channel?: string
  /** STUN/TURN servers. Empty by default, which is enough on one machine or one network — and works offline. */
  iceServers?: RTCIceServer[]
  /** File chunk size in bytes. 16 KB is the size every browser delivers unsplit. */
  chunkSize?: number
  /** Called with each text message the other peer sends. */
  onMessage?: (text: string) => void
  /** Merged last, so it wins. */
  className?: string
}

interface PeerLinkEntry {
  id: string
  mine: boolean
  text?: string
  file?: { name: string; size: number; done: number; verified: boolean | null; url?: string; note?: string }
}

type Signal =
  | { type: 'offer' | 'answer'; from: string; to?: string; sdp: RTCSessionDescriptionInit }
  | { type: 'candidate'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'bye'; from: string }

const HIGH_WATER = 1 << 20
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
const sha256 = async (data: ArrayBuffer | Blob) => {
  if (!globalThis.crypto?.subtle) return null
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data
  return hex(await crypto.subtle.digest('SHA-256', buffer))
}
const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1 << 20 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1 << 20)).toFixed(1)} MB`)

/** Resolves once ICE gathering finishes, so a pasted SDP carries every candidate. */
const gathered = (pc: RTCPeerConnection, timeout = 3000) =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve()
    const done = () => pc.iceGatheringState === 'complete' && resolve()
    pc.addEventListener('icegatheringstatechange', done)
    setTimeout(resolve, timeout)
  })

/**
 * A direct browser-to-browser link: text and files over a WebRTC data channel,
 * with no server in the path once it is connected.
 *
 * Signalling is the part WebRTC leaves to you, so both honest options are here:
 * copy the offer and answer by hand — slow, but it works between any two
 * browsers — or let peers on the same origin find each other over a
 * BroadcastChannel. Files go in 16 KB chunks and the sender waits whenever the
 * channel's buffer passes a megabyte, because pushing faster than the network
 * drains only grows memory until the tab dies. The receiver hashes what arrived
 * and compares it with the sender's SHA-256 before offering the download.
 */
export function PeerLink({ label, signalling = 'manual', channel = 'klyv-peer-link', iceServers = [], chunkSize = 16_384, onMessage, className }: PeerLinkProps) {
  const uid = useId()
  const me = useRef(`${label}-${Math.random().toString(36).slice(2, 8)}`)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const busRef = useRef<BroadcastChannel | null>(null)
  const peerRef = useRef<string | null>(null)
  const queued = useRef<RTCIceCandidateInit[]>([])
  const incoming = useRef<{ id: string; name: string; size: number; sha256: string; type: string; chunks: ArrayBuffer[]; done: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [state, setState] = useState<RTCPeerConnectionState | 'idle'>('idle')
  const [open, setOpen] = useState(false)
  const [localSdp, setLocalSdp] = useState('')
  const [remoteSdp, setRemoteSdp] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [entries, setEntries] = useState<PeerLinkEntry[]>([])
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const patch = (id: string, file: Partial<NonNullable<PeerLinkEntry['file']>>) =>
    setEntries((list) => list.map((entry) => (entry.id === id && entry.file ? { ...entry, file: { ...entry.file, ...file } } : entry)))

  const onData = async (event: MessageEvent<string | ArrayBuffer>) => {
    if (typeof event.data !== 'string') {
      const file = incoming.current
      if (!file) return
      file.chunks.push(event.data)
      file.done += event.data.byteLength
      if (file.chunks.length % 8 === 0 || file.done === file.size) patch(file.id, { done: file.done })
      return
    }
    const message = JSON.parse(event.data) as { t: string; id: string; body?: string; name?: string; size?: number; sha256?: string; type?: string }
    if (message.t === 'text') {
      setEntries((list) => [...list, { id: message.id, mine: false, text: message.body }])
      onMessageRef.current?.(message.body ?? '')
    } else if (message.t === 'file') {
      incoming.current = { id: message.id, name: message.name!, size: message.size!, sha256: message.sha256!, type: message.type!, chunks: [], done: 0 }
      setEntries((list) => [...list, { id: message.id, mine: false, file: { name: message.name!, size: message.size!, done: 0, verified: null } }])
    } else if (message.t === 'file-end' && incoming.current?.id === message.id) {
      const file = incoming.current
      incoming.current = null
      const blob = new Blob(file.chunks, { type: file.type })
      const digest = await sha256(blob)
      const url = URL.createObjectURL(blob)
      urls.current.push(url)
      patch(file.id, {
        done: file.done,
        verified: digest === null ? null : digest === file.sha256 && blob.size === file.size,
        url,
        note: digest === null ? 'Arrived — this browser cannot hash it to check' : undefined,
      })
    }
  }

  const bind = (dc: RTCDataChannel) => {
    dcRef.current = dc
    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = HIGH_WATER / 4
    dc.onopen = () => setOpen(true)
    dc.onclose = () => setOpen(false)
    dc.onmessage = (event) => void onData(event)
  }

  const reset = () => {
    dcRef.current?.close()
    pcRef.current?.close()
    dcRef.current = null
    pcRef.current = null
    peerRef.current = null
    queued.current = []
    setOpen(false)
    setState('idle')
  }

  const create = () => {
    reset()
    const pc = new RTCPeerConnection({ iceServers })
    pcRef.current = pc
    pc.onconnectionstatechange = () => setState(pc.connectionState)
    pc.ondatachannel = (event) => bind(event.channel)
    pc.onicecandidate = (event) => {
      if (signalling === 'broadcast' && event.candidate) busRef.current?.postMessage({ type: 'candidate', from: me.current, candidate: event.candidate.toJSON() } satisfies Signal)
    }
    setState(pc.connectionState)
    return pc
  }

  const flushCandidates = async (pc: RTCPeerConnection) => {
    for (const candidate of queued.current.splice(0)) await pc.addIceCandidate(candidate).catch(() => undefined)
  }

  const run = (task: () => Promise<void>) => {
    setError('')
    task().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
  }

  const offer = () =>
    run(async () => {
      const pc = create()
      bind(pc.createDataChannel('klyv'))
      await pc.setLocalDescription(await pc.createOffer())
      if (signalling === 'broadcast') busRef.current?.postMessage({ type: 'offer', from: me.current, sdp: pc.localDescription!.toJSON() } satisfies Signal)
      else {
        await gathered(pc)
        setLocalSdp(JSON.stringify(pc.localDescription))
      }
    })

  const answer = async (sdp: RTCSessionDescriptionInit, from?: string) => {
    const pc = create()
    peerRef.current = from ?? null
    await pc.setRemoteDescription(sdp)
    await flushCandidates(pc)
    await pc.setLocalDescription(await pc.createAnswer())
    if (from) busRef.current?.postMessage({ type: 'answer', from: me.current, to: from, sdp: pc.localDescription!.toJSON() } satisfies Signal)
    else {
      await gathered(pc)
      setLocalSdp(JSON.stringify(pc.localDescription))
    }
  }

  const applyPasted = () =>
    run(async () => {
      const sdp = JSON.parse(remoteSdp) as RTCSessionDescriptionInit
      if (sdp.type === 'offer') await answer(sdp)
      else if (sdp.type === 'answer' && pcRef.current) await pcRef.current.setRemoteDescription(sdp)
      else throw new Error('Paste an offer first, or create an offer before pasting an answer.')
      setRemoteSdp('')
    })

  useEffect(() => {
    setSupported(typeof RTCPeerConnection !== 'undefined')
    return reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (signalling !== 'broadcast' || typeof BroadcastChannel === 'undefined') return
    const bus = new BroadcastChannel(channel)
    busRef.current = bus
    bus.onmessage = (event: MessageEvent<Signal>) =>
      run(async () => {
        const signal = event.data
        if (signal.from === me.current) return
        if (signal.type === 'offer') {
          // Already talking to someone: a second offer would tear that link down.
          if (pcRef.current && peerRef.current && peerRef.current !== signal.from) return
          await answer(signal.sdp, signal.from)
        }
        else if (signal.type === 'answer' && signal.to === me.current && pcRef.current) {
          peerRef.current = signal.from
          await pcRef.current.setRemoteDescription(signal.sdp)
          await flushCandidates(pcRef.current)
        } else if (signal.type === 'candidate' && (!peerRef.current || peerRef.current === signal.from)) {
          const pc = pcRef.current
          if (pc?.remoteDescription) await pc.addIceCandidate(signal.candidate).catch(() => undefined)
          else queued.current.push(signal.candidate)
        } else if (signal.type === 'bye' && signal.from === peerRef.current) reset()
      })
    return () => {
      bus.postMessage({ type: 'bye', from: me.current } satisfies Signal)
      bus.close()
      busRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalling, channel])


  const disconnect = () => {
    busRef.current?.postMessage({ type: 'bye', from: me.current } satisfies Signal)
    reset()
    setLocalSdp('')
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open' || !draft.trim()) return
    const id = `${me.current}-${Date.now()}`
    dc.send(JSON.stringify({ t: 'text', id, body: draft }))
    setEntries((list) => [...list, { id, mine: true, text: draft }])
    setDraft('')
  }

  const sendFile = (file: File) =>
    run(async () => {
      const dc = dcRef.current
      if (!dc || dc.readyState !== 'open') return
      const id = `${me.current}-${Date.now()}`
      const buffer = await file.arrayBuffer()
      const digest = (await sha256(buffer)) ?? ''
      setEntries((list) => [...list, { id, mine: true, file: { name: file.name, size: file.size, done: 0, verified: null } }])
      dc.send(JSON.stringify({ t: 'file', id, name: file.name, size: file.size, type: file.type, sha256: digest }))
      for (let offset = 0, count = 0; offset < buffer.byteLength; offset += chunkSize, count += 1) {
        // Back-pressure: wait for the buffer to drain rather than queueing the whole file.
        if (dc.bufferedAmount > HIGH_WATER) await new Promise((resolve) => dc.addEventListener('bufferedamountlow', resolve, { once: true }))
        if (dc.readyState !== 'open') throw new Error('The channel closed mid-transfer.')
        dc.send(buffer.slice(offset, offset + chunkSize))
        if (count % 8 === 0) patch(id, { done: Math.min(offset + chunkSize, buffer.byteLength) })
      }
      dc.send(JSON.stringify({ t: 'file-end', id }))
      patch(id, { done: buffer.byteLength, note: 'Sent with its SHA-256' })
    })

  const tone = open ? 'success' : state === 'failed' ? 'danger' : state === 'connecting' || state === 'new' ? 'warning' : 'neutral'
  const stateLabel = open ? 'Connected' : state === 'idle' ? 'Not connected' : state[0]!.toUpperCase() + state.slice(1)

  return (
    <section aria-label={`Peer ${label}`} className={cn('flex w-full min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]', className)}>
      <header className="flex items-center justify-between gap-2">
        <Text as="h3" size="heading">
          {label}
        </Text>
        <span role="status">
          <StatusPill tone={tone}>{stateLabel}</StatusPill>
        </span>
      </header>

      {supported === false ? (
        <Text size="label" tone="soft">
          This browser has no WebRTC, so a direct link cannot be made here.
        </Text>
      ) : (
        <>
          {signalling === 'broadcast' ? (
            <div className="flex flex-wrap items-center gap-2">
              {state === 'idle' ? <Button size="sm" onClick={offer}>Connect</Button> : <Button size="sm" variant="outline" onClick={disconnect}>Disconnect</Button>}
              <Text as="span" size="caption" tone="faint">
                Signals over the “{channel}” channel to peers in this browser.
              </Text>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={offer}>Create offer</Button>
                {state !== 'idle' && <Button size="sm" variant="ghost" onClick={disconnect}>Reset</Button>}
              </div>
              {localSdp && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${uid}-local`} className="text-[12px] font-semibold text-ink-soft">
                    Your {JSON.parse(localSdp).type} — give this to the other peer
                  </label>
                  <Textarea id={`${uid}-local`} readOnly rows={3} value={localSdp} className="font-mono text-[11px]" />
                  <CopyButton value={localSdp} size="sm" className="self-start" />
                </div>
              )}
              <label htmlFor={`${uid}-remote`} className="text-[12px] font-semibold text-ink-soft">
                Paste their offer or answer
              </label>
              <Textarea id={`${uid}-remote`} rows={3} value={remoteSdp} onChange={(event) => setRemoteSdp(event.target.value)} className="font-mono text-[11px]" />
              <Button size="sm" variant="outline" disabled={!remoteSdp.trim()} onClick={applyPasted} className="self-start">
                Apply
              </Button>
            </div>
          )}
          {error && (
            <Text size="caption" tone="danger" role="alert">
              {error}
            </Text>
          )}

          <ol role="log" aria-label={`${label} messages`} className="flex max-h-56 min-h-24 flex-col gap-2 overflow-y-auto rounded-[var(--radius-tile)] bg-surface-sunken p-2.5">
            {entries.length === 0 && (
              <li>
                <Text size="caption" tone="faint">
                  Nothing sent yet.
                </Text>
              </li>
            )}
            {entries.map((entry) => (
              <li key={entry.id} className={cn('flex max-w-[85%] flex-col gap-1 rounded-[var(--radius-tile)] px-3 py-2', entry.mine ? 'self-end bg-accent text-accent-ink' : 'self-start bg-surface text-ink')}>
                {entry.text !== undefined && <span className="whitespace-pre-wrap break-words text-[13px] font-medium">{entry.text}</span>}
                {entry.file && (
                  <>
                    <span className="text-[12px] font-bold">
                      {entry.file.name} · {size(entry.file.size)}
                    </span>
                    {entry.file.done < entry.file.size && <Progress size="sm" label={`${entry.file.name} transfer`} value={entry.file.done} max={entry.file.size} />}
                    <span className="text-[11px] font-semibold">
                      {entry.file.verified === true
                        ? 'SHA-256 matches'
                        : entry.file.verified === false
                          ? 'SHA-256 mismatch — do not trust this file'
                          : entry.file.note ?? `${Math.round((entry.file.done / Math.max(entry.file.size, 1)) * 100)}%`}
                    </span>
                    {entry.file.url && entry.file.verified !== false && (
                      <a href={entry.file.url} download={entry.file.name} className="text-[12px] font-bold underline">
                        Save {entry.file.name}
                      </a>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>

          <form onSubmit={send} className="flex gap-2">
            <Input aria-label={`Message from ${label}`} inputSize="sm" value={draft} disabled={!open} placeholder={open ? 'Say something' : 'Connect first'} onChange={(event) => setDraft(event.target.value)} containerClassName="min-w-0 flex-1" />
            <Button size="sm" type="submit" disabled={!open || !draft.trim()}>
              Send
            </Button>
            <Button size="sm" variant="outline" disabled={!open} onClick={() => fileInput.current?.click()}>
              File
            </Button>
            <input
              ref={fileInput}
              type="file"
              hidden
              aria-label={`File to send from ${label}`}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) sendFile(file)
                event.target.value = ''
              }}
            />
          </form>
        </>
      )}
    </section>
  )
}
