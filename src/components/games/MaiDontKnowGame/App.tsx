import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import ArcadeHome, { type ArcadeView } from './components/ArcadeHome';
import AuthScreen from './components/AuthScreen';
import Header from './components/Header';
import Leaderboard from './components/Leaderboard';
import PublicLobbies from './components/PublicLobbies';
import RoomScreen from './components/room/RoomScreen';
import { useAuth } from './hooks/useAuth';
import { useTrollCoins } from './hooks/useTrollCoins';
import { supabase } from './lib/supabase';

const RESUME_KEY = 'maidk:resume-room';

type View = ArcadeView | 'room';

function readStoredRoomId(): string | null {
  return window.localStorage.getItem(RESUME_KEY);
}

function storeRoomId(roomId: string | null) {
  if (roomId) {
    window.localStorage.setItem(RESUME_KEY, roomId);
  } else {
    window.localStorage.removeItem(RESUME_KEY);
  }
}

function App() {
  const { session, userId, loading, profile } = useAuth();
  const [view, setView] = useState<View>('home');
  const [roomId, setRoomId] = useState<string | null>(() => readStoredRoomId());
  const coins = useTrollCoins(userId);

  if (loading) {
    return (
      <div className="arena-backdrop flex min-h-screen items-center justify-center text-neon-blue">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!session || !userId) {
    return <AuthScreen />;
  }

  const enterRoom = (id: string) => {
    storeRoomId(id);
    setRoomId(id);
    setView('room');
  };

  const forgetRoom = () => {
    storeRoomId(null);
    setRoomId(null);
    setView('home');
  };

  const goHome = () => setView('home');

  const signOut = async () => {
    storeRoomId(null);
    setRoomId(null);
    setView('home');
    await supabase.auth.signOut();
  };

  let content: ReactNode;
  if (view === 'room' && roomId) {
    content = (
      <RoomScreen
        key={roomId}
        roomId={roomId}
        userId={userId}
        onHome={goHome}
        onLeft={forgetRoom}
        onOpenRoom={enterRoom}
      />
    );
  } else if (view === 'public') {
    content = <PublicLobbies onBack={goHome} onEnterRoom={enterRoom} />;
  } else if (view === 'leaderboard') {
    content = <Leaderboard onBack={goHome} />;
  } else {
    content = (
      <ArcadeHome
        resumeRoomId={roomId}
        onEnterRoom={enterRoom}
        onNavigate={setView}
        onResume={() => setView('room')}
      />
    );
  }

  return (
    <div className="arena-backdrop min-h-screen text-slate-100">
      <Header
        profile={profile}
        trollCoins={coins.balance}
        trollCoinError={coins.error}
        onHome={goHome}
        onSignOut={() => void signOut()}
      />
      {content}
    </div>
  );
}

export default App;

