import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#09050f] text-white">
                <div className="glass-card rounded-3xl p-8 text-center">Loading...</div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}
