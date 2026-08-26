import { Routes, Route, Navigate } from 'react-router-dom'

import PhoneHomepage from './pages/PhoneHomepage'
import PhoneAuth from './pages/PhoneAuth'
import PhoneGoLive from './pages/PhoneGoLive'
import PhoneMAIPiks from './pages/PhoneMaiPiks'
import PhoneBroadcastPage from './pages/PhoneBroadcastPage'
import PhoneAuctions from './pages/PhoneAuctions'
import PhoneTrollCourt from './pages/PhoneTrollCourt'
import PhoneStore from './pages/PhoneStore'
import PhoneProfile from './pages/PhoneProfile'
import PhonePodcast from './pages/PhonePodcast'
import PhoneHytroGameStreams from './pages/PhoneHytroGameStreams'
import PhoneViewerPage from './pages/PhoneViewerPage'
import PhoneWebPage from './pages/PhoneWebPage'
import MKeyInvitePopup from '../components/broadcast/mkey/MKeyInvitePopup'
import PhoneCoins from './pages/PhoneCoins'
import PhoneMaiPay from './pages/PhoneMaiPay'
import PhoneTreelz from './pages/PhoneTreelz'
import PhoneChat from './pages/PhoneChat'
import PhoneFollowing from './pages/PhoneFollowing'
import PhoneAdminDashboard from './pages/PhoneAdminDashboard'
import PhoneSecretary from './pages/PhoneSecretary'
import PhoneLeadOfficer from './pages/PhoneLeadOfficer'
import PhoneTrollOfficer from './pages/PhoneTrollOfficer'
import PhonePastor from './pages/PhonePastor'
import PhoneBattles from './pages/PhoneBattles'
import PhoneLiveNow from './pages/PhoneLiveNow'
import PhoneLeagues from './pages/PhoneLeagues'
import PhoneAcademy from './pages/PhoneAcademy'
import PhoneRecordLabel from './pages/PhoneRecordLabel'
import PhoneTCNN from './pages/PhoneTCNN'
import PhoneCommunityWall from './pages/PhoneCommunityWall'
import PhoneBlockedUsers from './pages/PhoneBlockedUsers'
import PhoneProfileDelete from './pages/PhoneProfileDelete'
import PhoneTreelzUpload from './pages/PhoneTreelzUpload'
import PhoneAdminUsers from './pages/PhoneAdminUsers'
import PhoneAdminPayouts from './pages/PhoneAdminPayouts'
import PhoneAdminReports from './pages/PhoneAdminReports'
import PhoneAdminModeration from './pages/PhoneAdminModeration'
import PhoneAdminSettings from './pages/PhoneAdminSettings'
import PhoneAdminMobile from './pages/PhoneAdminMobile'
import PhonePlaceholderPage from './pages/PhonePlaceholderPage'
import PhoneSupport from './pages/PhoneSupport'
import PhoneSafety from './pages/PhoneSafety'
import PhoneLegal from './pages/PhoneLegal'
import PhoneErrorBoundary from './PhoneErrorBoundary'

export default function PhoneApp() {
  return (
    <PhoneErrorBoundary>
      <div className="min-h-screen bg-black text-white">
        <Routes>
          <Route path="/phone" element={<Navigate to="/" replace />} />

          <Route path="/" element={<PhoneHomepage />} />
          <Route path="/auth" element={<PhoneAuth />} />
          <Route path="/login" element={<PhoneAuth />} />
          <Route path="/go-live" element={<PhoneGoLive />} />
          <Route path="/mai-piks" element={<PhoneMAIPiks />} />
          <Route path="/broadcast" element={<PhoneBroadcastPage />} />
          <Route path="/broadcast/setup" element={<PhoneGoLive />} />
          <Route path="/auctions" element={<PhoneAuctions />} />
          <Route path="/troll-court" element={<PhoneTrollCourt />} />
          <Route path="/store" element={<PhoneStore />} />
          <Route path="/coins" element={<PhoneCoins />} />
          <Route path="/wallet" element={<PhoneMaiPay />} />
          <Route path="/profile" element={<PhoneProfile />} />
          <Route path="/following" element={<PhoneFollowing />} />
          <Route path="/podcast" element={<PhonePodcast />} />
          <Route path="/hytro" element={<PhoneHytroGameStreams />} />
          <Route path="/viewer" element={<PhoneViewerPage />} />
          <Route path="/treelz" element={<PhoneTreelz />} />
          <Route path="/utromail" element={<PhoneChat />} />
          <Route path="/utromail/:threadId" element={<PhoneChat />} />
          <Route path="/admin" element={<PhoneAdminDashboard />} />
          <Route path="/admin-mobile" element={<PhoneAdminMobile />} />
          <Route path="/support" element={<PhoneSupport />} />
          <Route path="/safety" element={<PhoneSafety />} />
          <Route path="/legal" element={<PhoneLegal />} />
          <Route path="/phone-secretary" element={<PhoneSecretary />} />
          <Route path="/phone-lead-officer" element={<PhoneLeadOfficer />} />
          <Route path="/phone-troll-officer" element={<PhoneTrollOfficer />} />
          <Route path="/phone-pastor" element={<PhonePastor />} />
          <Route path="/home" element={<PhoneHomepage />} />
          <Route path="/battles" element={<PhoneBattles />} />
          <Route path="/live" element={<PhoneLiveNow />} />
          <Route path="/leagues" element={<PhoneLeagues />} />
          <Route path="/academy" element={<PhoneAcademy />} />
          <Route path="/mai-record-label" element={<PhoneRecordLabel />} />
          <Route path="/tcnn" element={<PhoneTCNN />} />
          <Route path="/community-wall" element={<PhoneCommunityWall />} />
          <Route path="/blocked-users" element={<PhoneBlockedUsers />} />
          <Route path="/profile/delete" element={<PhoneProfileDelete />} />
          <Route path="/treelz/upload" element={<PhoneTreelzUpload />} />
          <Route path="/admin/users" element={<PhoneAdminUsers />} />
          <Route path="/admin/payouts" element={<PhoneAdminPayouts />} />
          <Route path="/admin/reports" element={<PhoneAdminReports />} />
          <Route path="/admin/moderation" element={<PhoneAdminModeration />} />
          <Route path="/admin/settings" element={<PhoneAdminSettings />} />
          <Route path="/search" element={<PhonePlaceholderPage />} />
          <Route path="/profile/:username" element={<PhoneProfile />} />
          <Route path="/live/:id" element={<PhoneViewerPage />} />
          <Route path="/broadcast/:id" element={<PhoneBroadcastPage />} />
          <Route path="/watch/:id" element={<PhoneViewerPage />} />
          <Route path="/stream/:id" element={<PhoneViewerPage />} />
          <Route path="/podcast/:id" element={<PhonePodcast />} />
          <Route path="/troll-court/:id" element={<PhoneTrollCourt />} />
          <Route path="/court/:id" element={<PhoneTrollCourt />} />
          <Route path="/agency/:id" element={<PhonePlaceholderPage />} />
          <Route path="/agency-apply/:id" element={<PhonePlaceholderPage />} />
          <Route path="/music/:id" element={<PhoneRecordLabel />} />
          <Route path="/tromail" element={<PhoneChat />} />
          <Route path="/tromail/:threadId" element={<PhoneChat />} />
          <Route path="/academy/:id" element={<PhoneAcademy />} />
          <Route path="/academy/teacher/:id" element={<PhoneAcademy />} />
          <Route path="/academy/classroom/:id" element={<PhoneAcademy />} />
          <Route path="/family/:id" element={<PhonePlaceholderPage />} />
          <Route path="/government/:id" element={<PhonePlaceholderPage />} />
          <Route path="/president/:id" element={<PhonePlaceholderPage />} />
          <Route path="/secretary/:id" element={<PhoneSecretary />} />
          <Route path="/artist/:id" element={<PhonePlaceholderPage />} />
          <Route path="/ceo-*" element={<PhonePlaceholderPage />} />

          <Route path="*" element={<PhoneWebPage />} />
        </Routes>

        {/* 🔑 Live MKey invitations reach a viewer wherever they are — usually
            inside another broadcast — with a single JOIN LIVE deep link. */}
        <MKeyInvitePopup />
      </div>
    </PhoneErrorBoundary>
  )
}
