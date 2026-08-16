import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export interface TutorialStep {
  id: string
  controlName: string
  explanation: string
  dataTutorialId: string
  tapMessage: string
  isEssential?: boolean
}

export const BROADCAST_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'host_box',
    controlName: 'Broadcaster Box / Options',
    explanation: 'This is your main broadcast control center. Here you can adjust stream settings, manage boxes, and control your broadcast.',
    dataTutorialId: 'tutorial-host-box',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'microphone',
    controlName: 'Microphone',
    explanation: 'Toggle your microphone on and off. Viewers will only hear you when this is on.',
    dataTutorialId: 'tutorial-microphone',
    tapMessage: 'Tap this button to learn',
    isEssential: true,
  },
  {
    id: 'camera',
    controlName: 'Camera',
    explanation: 'Toggle your camera on and off. Share your face with viewers or go audio-only.',
    dataTutorialId: 'tutorial-camera',
    tapMessage: 'Tap this button to learn',
    isEssential: true,
  },
  {
    id: 'flip_camera',
    controlName: 'Flip Camera',
    explanation: 'Switch between your front and back camera on mobile devices.',
    dataTutorialId: 'tutorial-flip-camera',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'gifts',
    controlName: 'Gifts',
    explanation: 'Open the gift tray to send virtual gifts to other broadcasters or viewers. Gifts earn coins!',
    dataTutorialId: 'tutorial-gifts',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'share',
    controlName: 'Share',
    explanation: 'Share your broadcast with friends on other platforms.',
    dataTutorialId: 'tutorial-share',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'invite_followers',
    controlName: 'Invite Followers',
    explanation: 'Send push notifications to your followers to invite them to your broadcast.',
    dataTutorialId: 'tutorial-invite-followers',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'manage_seats',
    controlName: 'Manage Seats',
    explanation: 'Open the seat manager to approve, deny, or remove seat requests from viewers.',
    dataTutorialId: 'tutorial-manage-seats',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'games',
    controlName: 'Games',
    explanation: 'Launch interactive games like Troll Toe for your audience to play.',
    dataTutorialId: 'tutorial-games',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'messages',
    controlName: 'Messages',
    explanation: 'Open your message inbox to read and reply to direct messages.',
    dataTutorialId: 'tutorial-messages',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'text_popup',
    controlName: 'Text Popup',
    explanation: 'Send an on-screen text popup to all viewers.',
    dataTutorialId: 'tutorial-text-popup',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'overlay_studio',
    controlName: 'Text/Image Overlay Studio',
    explanation: 'Design and deploy custom text and image overlays for your broadcast.',
    dataTutorialId: 'tutorial-overlay-studio',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'more_controls',
    controlName: 'More Controls',
    explanation: 'Access additional settings like theme, RGB effects, banned users, and paid chat.',
    dataTutorialId: 'tutorial-more-controls',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'chat_lock',
    controlName: 'Chat Lock',
    explanation: 'Lock or unlock the broadcast chat. When locked, only staff can chat.',
    dataTutorialId: 'tutorial-chat-lock',
    tapMessage: 'Tap this button to learn',
  },
  {
    id: 'end_stream',
    controlName: 'End Stream',
    explanation: 'End your broadcast and save your stream. This action cannot be undone.',
    dataTutorialId: 'tutorial-end-stream',
    tapMessage: 'Tap this button to learn',
    isEssential: true,
  },
]

export interface TutorialState {
  active: boolean
  currentStepIndex: number
  isCompleted: boolean
  isSkipped: boolean
}

export function useBroadcastTutorial() {
  const { user, profile } = useAuthStore()
  const [state, setState] = useState<TutorialState>({
    active: false,
    currentStepIndex: 0,
    isCompleted: false,
    isSkipped: false,
  })
  const mountedRef = useRef(true)

  const loadProgress = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('user_tutorial_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('tutorial_key', 'first_broadcast')
        .maybeSingle()
      if (error) throw error
      if (!mountedRef.current) return
      if (data) {
        setState({
          active: !data.is_completed && !data.is_skipped,
          currentStepIndex: data.current_step || 0,
          isCompleted: data.is_completed,
          isSkipped: data.is_skipped,
        })
      }
    } catch (err) {
      console.warn('[BroadcastTutorial] loadProgress error:', err)
    }
  }, [user?.id])

  useEffect(() => {
    mountedRef.current = true
    if (user?.id) {
      void loadProgress()
    }
    return () => {
      mountedRef.current = false
    }
  }, [user?.id, loadProgress])

  const advanceStep = useCallback(async () => {
    if (!user?.id) return
    const nextIndex = state.currentStepIndex + 1
    const isComplete = nextIndex >= BROADCAST_TUTORIAL_STEPS.length
    try {
      const payload: Record<string, any> = {
        user_id: user.id,
        tutorial_key: 'first_broadcast',
        current_step: isComplete ? state.currentStepIndex : nextIndex,
        is_completed: isComplete,
        is_skipped: false,
      }
      if (isComplete) {
        payload.completed_at = new Date().toISOString()
      }
      const { error } = await supabase
        .from('user_tutorial_progress')
        .upsert(payload, { onConflict: 'user_id,tutorial_key' })
      if (error) throw error
      if (!mountedRef.current) return
      setState((prev) => ({
        ...prev,
        currentStepIndex: nextIndex,
        isCompleted: isComplete,
        active: !isComplete,
      }))
    } catch (err) {
      console.warn('[BroadcastTutorial] advanceStep error:', err)
    }
  }, [user?.id, state.currentStepIndex])

  const skipTutorial = useCallback(async () => {
    if (!user?.id) return
    try {
      const { error } = await supabase
        .from('user_tutorial_progress')
        .upsert(
          {
            user_id: user.id,
            tutorial_key: 'first_broadcast',
            current_step: state.currentStepIndex,
            is_completed: false,
            is_skipped: true,
            skipped_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,tutorial_key' }
        )
      if (error) throw error
      if (!mountedRef.current) return
      setState((prev) => ({ ...prev, active: false, isSkipped: true }))
    } catch (err) {
      console.warn('[BroadcastTutorial] skipTutorial error:', err)
    }
  }, [user?.id, state.currentStepIndex])

  const resetTutorial = useCallback(async () => {
    if (!user?.id) return
    try {
      const { error } = await supabase
        .from('user_tutorial_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('tutorial_key', 'first_broadcast')
      if (error) throw error
      if (!mountedRef.current) return
      setState({
        active: true,
        currentStepIndex: 0,
        isCompleted: false,
        isSkipped: false,
      })
    } catch (err) {
      console.warn('[BroadcastTutorial] resetTutorial error:', err)
    }
  }, [user?.id])

  const startTutorial = useCallback(() => {
    setState((prev) => ({ ...prev, active: true, currentStepIndex: 0 }))
  }, [])

  return {
    ...state,
    currentStep: BROADCAST_TUTORIAL_STEPS[state.currentStepIndex] || null,
    totalSteps: BROADCAST_TUTORIAL_STEPS.length,
    advanceStep,
    skipTutorial,
    resetTutorial,
    startTutorial,
    reload: loadProgress,
  }
}
