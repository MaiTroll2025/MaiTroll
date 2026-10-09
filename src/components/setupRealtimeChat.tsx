import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { Stream, CreatorProfile, ChatMessage } from '../types/database'
import { supabase } from '../lib/supabase'
import TipForm from '../components/TipForm'

export default function StreamPage() {
  const { streamId } = useParams()
  const [stream, setStream] = useState<Stream | null>(null)
  const [creator, setCreator] = useState<CreatorProfile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchStream = useCallback(async () => {
    setLoading(true)
    const { data: streamData } = await supabase
      .from('streams')
      .select('*')
      .eq('id', streamId)
      .single()
    
    if (streamData) {
      setStream(streamData)
      const { data: creatorData } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('user_id', streamData.creator_id)
        .single()
      setCreator(creatorData)
    }
    setLoading(false)
  }, [streamId])

  const setupRealtimeChat = useCallback(() => {
    const channel = supabase
      .channel(`chat:${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `stream_id=eq.${streamId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage])
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [streamId])

  useEffect(() => {
    void fetchStream()
    return setupRealtimeChat()
  }, [fetchStream, setupRealtimeChat])

  const sendMessage = async () => {
    if (!message.trim()) return
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        stream_id: streamId,
        user_id: 'guest',
        content: message
      })
    
    if (!error) {
      setMessage('')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!stream) {
    return <div className="flex items-center justify-center min-h-screen">Stream not found</div>
  }

  return (
    <div className="bg-gray-950 text-white min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4">
              <video
                src={stream.recording_url || ''}
                controls
                className="w-full h-full"
                autoPlay
              />
            </div>
            
            <div className="bg-gray-900 rounded-xl p-4 mb-4">
              <h1 className="text-2xl font-bold mb-2">{stream.title}</h1>
              <p className="text-gray-400 mb-4">{stream.description}</p>
              <div className="flex items-center space-x-4">
                <span className="bg-gray-800 px-3 py-1 rounded-full text-sm">
                  👥 {stream.viewer_count} viewers
                </span>
                <span className="bg-gray-800 px-3 py-1 rounded-full text-sm">
                  {stream.category}
                </span>
              </div>
            </div>

            {creator && <TipForm creatorId={creator.id} />}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl p-4 h-[500px] flex flex-col">
              <h3 className="font-bold mb-4">Chat</h3>
              <div className="flex-1 overflow-y-auto mb-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="mb-2">
                    <span className="text-purple-400 font-semibold">Guest:</span> {msg.content}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg transition"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}