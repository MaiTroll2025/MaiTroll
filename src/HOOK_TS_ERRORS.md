# TypeScript Errors in Hook-Related Files

**Total Errors:** 125

---

## src/components/promo/PromoSlot.tsx

Errors in this file:

- `src/components/promo/PromoSlot.tsx(82,31): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`

---

## src/contexts/PageChannelContext.tsx

Errors in this file:

- `src/contexts/PageChannelContext.tsx(58,34): error TS2322: Type '{ currentPage: PageType; currentPageId: string; switchPage: (type: PageType, id?: string | null) => void; getPageStats: () => { totalPageChannels: number; channels: { name: string; refCount: number; status: ChannelStatus; subscribers: number; age: number; }[]; health: ChannelHealth; }; }' is not assignable to type 'PageChannelState'.`
- `src/contexts/PageChannelContext.tsx(85,46): error TS2345: Argument of type 'PageType' is not assignable to parameter of type 'PageChannelType'.`

---

## src/hooks/useAutoUpdate.ts

Errors in this file:

- `src/hooks/useAutoUpdate.ts(73,21): error TS2345: Argument of type '{ status: string; }' is not assignable to parameter of type 'SetStateAction<UpdateStatus>'.`

---

## src/hooks/useCityStatus.ts

Errors in this file:

- `src/hooks/useCityStatus.ts(46,8): error TS2339: Property 'catch' does not exist on type 'PromiseLike<void>'.`

---

## src/hooks/useCreatorSubscription.ts

Errors in this file:

- `src/hooks/useCreatorSubscription.ts(48,17): error TS2352: Conversion of type '{ id: any; name: any; color_hex: any; icon_name: any; sort_order: any; price_coins: any; benefits: any; sla_uptime_guarantee_pct: any; sla_quality_guarantee: any; sla_chat_priority: any; sla_support_response_secs: any; sla_features: any; }[]' to type 'SubscriptionTierInfo' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.`

---

## src/hooks/useIncomingMessagePopup.ts

Errors in this file:

- `src/hooks/useIncomingMessagePopup.ts(42,19): error TS2339: Property 'incoming_message_popups_enabled' does not exist on type 'UserProfile'.`
- `src/hooks/useIncomingMessagePopup.ts(42,63): error TS2339: Property 'incoming_message_popups_enabled' does not exist on type 'UserProfile'.`
- `src/hooks/useIncomingMessagePopup.ts(51,16): error TS2339: Property 'incoming_message_popups_enabled' does not exist on type 'UserProfile'.`
- `src/hooks/useIncomingMessagePopup.ts(69,22): error TS2554: Expected 2 arguments, but got 1.`

---

## src/hooks/useLeagueProgress.ts

Errors in this file:

- `src/hooks/useLeagueProgress.ts(104,39): error TS2304: Cannot find name 'lbl'.`
- `src/hooks/useLeagueProgress.ts(261,18): error TS2339: Property 'catch' does not exist on type 'void'.`
- `src/hooks/useLeagueProgress.ts(278,18): error TS2339: Property 'catch' does not exist on type 'void'.`
- `src/hooks/useLeagueProgress.ts(299,16): error TS2339: Property 'catch' does not exist on type 'void'.`

---

## src/hooks/useNavBadges.ts

Errors in this file:

- `src/hooks/useNavBadges.ts(56,7): error TS2741: Property 'careers' is missing in type '{ home: undefined[]; chats: undefined[]; coins: string[]; auctions: string[]; court: string[]; neighborhood: string[]; wallet: string[]; family: string[]; shop: string[]; inventory: string[]; alerts: undefined[]; }' but required in type 'Record<keyof NavBadges, string[]>'.`
- `src/hooks/useNavBadges.ts(328,22): error TS2345: Argument of type '{ home: number; chats: number; coins: number; auctions: number; court: number; neighborhood: number; wallet: number; family: number; shop: number; inventory: number; alerts: number; }' is not assignable to parameter of type 'SetStateAction<NavBadges>'.`

---

## src/hooks/useObsScenes.ts

Errors in this file:

- `src/hooks/useObsScenes.ts(47,23): error TS2345: Argument of type 'JsonValue' is not assignable to parameter of type 'SetStateAction<string>'.`
- `src/hooks/useObsScenes.ts(81,12): error TS2345: Argument of type '"CurrentSceneChanged"' is not assignable to parameter of type '"ConnectionOpened" | "ConnectionClosed" | "ConnectionError" | "Hello" | "Identified" | "CanvasCreated" | "CanvasRemoved" | "CanvasNameChanged" | "CurrentSceneCollectionChanging" | ... 55 more ... | "CustomEvent"'.`

---

## src/hooks/usePerformanceBenchmark.ts

Errors in this file:

- `src/hooks/usePerformanceBenchmark.ts(193,3): error TS2322: Type '(callback: TimerHandler, delay?: number, ...args: any[]) => number' is not assignable to type '{ (handler: TimerHandler, timeout?: number, ...arguments: any[]): number; (handler: TimerHandler, timeout?: number, ...arguments: any[]): number; } & { (handler: TimerHandler, timeout?: number, ...arguments: any[]): number; (handler: TimerHandler, timeout?: number, ...arguments: any[]): number; <TArgs extends any[]>...'.`

---

## src/hooks/usePresidentSystem.ts

Errors in this file:

- `src/hooks/usePresidentSystem.ts(29,3): error TS2411: Property 'vote_count' of type 'number' is not assignable to 'string' index type 'string'.`
- `src/hooks/usePresidentSystem.ts(30,3): error TS2411: Property 'score' of type 'number' is not assignable to 'string' index type 'string'.`
- `src/hooks/usePresidentSystem.ts(32,3): error TS2411: Property 'is_approved' of type 'boolean' is not assignable to 'string' index type 'string'.`

---

## src/hooks/userIds.tsx

Errors in this file:

- `src/hooks/userIds.tsx(3,51): error TS2307: Cannot find module './SEOLayout' or its corresponding type declarations.`

---

## src/hooks/useRoom.ts

Errors in this file:

- `src/hooks/useRoom.ts(137,51): error TS2345: Argument of type '(track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => void' is not assignable to parameter of type '(track: RemoteTrack<Kind>, publication: RemoteTrackPublication, participant: RemoteParticipant) => void'.`
- `src/hooks/useRoom.ts(138,53): error TS2345: Argument of type '(track: RemoteVideoTrack | RemoteAudioTrack, participant: RemoteParticipant) => void' is not assignable to parameter of type '(track: RemoteTrack<Kind>, publication: RemoteTrackPublication, participant: RemoteParticipant) => void'.`
- `src/hooks/useRoom.ts(150,11): error TS2353: Object literal may only specify known properties, and 'name' does not exist in type 'Partial<InternalRoomConnectOptions>'.`

---

## src/hooks/useRTCAdminMonitor.ts

Errors in this file:

- `src/hooks/useRTCAdminMonitor.ts(190,42): error TS18047: 'r.data' is possibly 'null'.`

---

## src/hooks/useScreenShare.ts

Errors in this file:

- `src/hooks/useScreenShare.ts(42,5): error TS2353: Object literal may only specify known properties, and 'name' does not exist in type 'MediaTrackConstraints'.`
- `src/hooks/useScreenShare.ts(91,9): error TS2353: Object literal may only specify known properties, and 'name' does not exist in type 'MediaTrackConstraints'.`

---

## src/hooks/useSlaStatus.ts

Errors in this file:

- `src/hooks/useSlaStatus.ts(175,39): error TS2339: Property 'ok' does not exist on type 'unknown'.`
- `src/hooks/useSlaStatus.ts(212,39): error TS2339: Property 'ok' does not exist on type 'unknown'.`
- `src/hooks/useSlaStatus.ts(249,39): error TS2339: Property 'ok' does not exist on type 'unknown'.`
- `src/hooks/useSlaStatus.ts(286,39): error TS2339: Property 'ok' does not exist on type 'unknown'.`

---

## src/hooks/useStaffWalkieTalkie.ts

Errors in this file:

- `src/hooks/useStaffWalkieTalkie.ts(177,38): error TS2769: No overload matches this call.`
- `src/hooks/useStaffWalkieTalkie.ts(182,40): error TS2554: Expected 0 arguments, but got 1.`
- `src/hooks/useStaffWalkieTalkie.ts(331,27): error TS2554: Expected 2 arguments, but got 1.`
- `src/hooks/useStaffWalkieTalkie.ts(332,27): error TS2554: Expected 2 arguments, but got 1.`
- `src/hooks/useStaffWalkieTalkie.ts(333,27): error TS2554: Expected 2 arguments, but got 1.`
- `src/hooks/useStaffWalkieTalkie.ts(334,27): error TS2554: Expected 2 arguments, but got 1.`
- `src/hooks/useStaffWalkieTalkie.ts(335,27): error TS2554: Expected 2 arguments, but got 1.`

---

## src/hooks/useSupportGoalReminder.ts

Errors in this file:

- `src/hooks/useSupportGoalReminder.ts(143,11): error TS18004: No value exists in scope for the shorthand property 'current_balance'. Either declare one or provide an initializer.`
- `src/hooks/useSupportGoalReminder.ts(145,11): error TS18004: No value exists in scope for the shorthand property 'coins_needed'. Either declare one or provide an initializer.`

---

## src/hooks/useTCNNArticles.ts

Errors in this file:

- `src/hooks/useTCNNArticles.ts(8,23): error TS2724: '"@/types/tcnn"' has no exported member named 'TCNNArticleInput'. Did you mean 'TCNNArticle'?`

---

## src/hooks/useUserFrame.ts

Errors in this file:

- `src/hooks/useUserFrame.ts(107,51): error TS2552: Cannot find name 'notifyListeners'. Did you mean 'notifyFrameListeners'?`

---

## src/hooks/useUserLeagues.ts

Errors in this file:

- `src/hooks/useUserLeagues.ts(207,45): error TS2367: This comparison appears to be unintentional because the types 'UserRole' and '""' have no overlap.`

---

## src/hooks/useUtromailMessagePopup.ts

Errors in this file:

- `src/hooks/useUtromailMessagePopup.ts(81,22): error TS2554: Expected 2 arguments, but got 1.`

---

## src/lib/adExemption.ts

Errors in this file:

- `src/lib/adExemption.ts(56,13): error TS2339: Property 'is_owner' does not exist on type 'UserProfile'.`

---

## src/lib/batchWrites.ts

Errors in this file:

- `src/lib/batchWrites.ts(93,37): error TS2345: Argument of type 'boolean' is not assignable to parameter of type 'number'.`
- `src/lib/batchWrites.ts(104,37): error TS2345: Argument of type 'boolean' is not assignable to parameter of type 'number'.`

---

## src/lib/formatNumber.tsx

Errors in this file:

- `src/lib/formatNumber.tsx(3,70): error TS2307: Cannot find module './SEOLayout' or its corresponding type declarations.`

---

## src/lib/formatViewers.tsx

Errors in this file:

- `src/lib/formatViewers.tsx(3,51): error TS2307: Cannot find module './SEOLayout' or its corresponding type declarations.`

---

## src/lib/formatVotes.tsx

Errors in this file:

- `src/lib/formatVotes.tsx(3,70): error TS2307: Cannot find module './SEOLayout' or its corresponding type declarations.`

---

## src/lib/game/engines/TrollopolyEngine.ts

Errors in this file:

- `src/lib/game/engines/TrollopolyEngine.ts(46,61): error TS2344: Type 'TrollopolyGameState' does not satisfy the constraint 'InternetGameState'.`

---

## src/lib/game/GameEngine.ts

Errors in this file:

- `src/lib/game/GameEngine.ts(16,11): error TS2322: Type '{ id: string; username: string; score: number; isHost: false; reactionTime: any; hasReacted: false; }[]' is not assignable to type 'ReactionSpeedPlayerState[]'.`
- `src/lib/game/GameEngine.ts(149,7): error TS2322: Type '"placeholder"' is not assignable to type 'GameType'.`

---

## src/lib/game/InternetGameEngineFactory.ts

Errors in this file:

- `src/lib/game/InternetGameEngineFactory.ts(12,7): error TS2322: Type 'TrollopolyEngine' is not assignable to type 'InternetGameEngine<InternetGameState>'.`

---

## src/lib/game/InternetGameTypes.ts

Errors in this file:

- `src/lib/game/InternetGameTypes.ts(154,18): error TS2430: Interface 'PacmanGameState' incorrectly extends interface 'BaseGameState'.`

---

## src/lib/grantNavCoins.ts

Errors in this file:

- `src/lib/grantNavCoins.ts(29,85): error TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder<any, any, any, any, "add_troll_coins", null, "RPC">'. Did you mean 'match'?`

---

## src/lib/handleMouseMove.tsx

Errors in this file:

- `src/lib/handleMouseMove.tsx(83,3): error TS2339: Property 'onStartPreview' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(84,3): error TS2339: Property 'onStopPreview' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(87,3): error TS2339: Property 'isPreviewing' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(116,3): error TS2339: Property 'cameraStream' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(117,3): error TS2339: Property 'micStream' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(118,3): error TS2339: Property 'hasCameraTrack' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(119,3): error TS2339: Property 'isCameraEnabled' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(120,3): error TS2339: Property 'onToggleCamera' does not exist on type 'GamingSetupProps'.`
- `src/lib/handleMouseMove.tsx(121,1): error TS2339: Property 'streamId' does not exist on type 'GamingSetupProps'.`

---

## src/lib/handlePlay.tsx

Errors in this file:

- `src/lib/handlePlay.tsx(3,51): error TS2307: Cannot find module './SEOLayout' or its corresponding type declarations.`

---

## src/lib/hooks/useBank.ts

Errors in this file:

- `src/lib/hooks/useBank.ts(19,19): error TS2339: Property 'stmt_apr_percent' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(23,29): error TS2339: Property 'stmt_statement_date' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(24,23): error TS2339: Property 'stmt_due_date' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(25,27): error TS2339: Property 'stmt_balance' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(26,30): error TS2339: Property 'stmt_minimum_payment' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(27,23): error TS2339: Property 'stmt_past_due' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(28,31): error TS2339: Property 'stmt_late_fees_accrued' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(29,31): error TS2339: Property 'stmt_interest_accrued' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(30,30): error TS2339: Property 'stmt_on_time_payments' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useBank.ts(31,28): error TS2339: Property 'stmt_late_payments' does not exist on type 'UserProfile'.`

---

## src/lib/hooks/useGiftSystem.ts

Errors in this file:

- `src/lib/hooks/useGiftSystem.ts(105,9): error TS2769: No overload matches this call.`

---

## src/lib/hooks/useInsurance.ts

Errors in this file:

- `src/lib/hooks/useInsurance.ts(4,101): error TS2307: Cannot find module './insuranceSystem' or its corresponding type declarations.`

---

## src/lib/hooks/useLazyAPI.ts

Errors in this file:

- `src/lib/hooks/useLazyAPI.ts(2,34): error TS2307: Cannot find module '../components/TabSwitchHandler' or its corresponding type declarations.`
- `src/lib/hooks/useLazyAPI.ts(166,36): error TS2345: Argument of type '((prev: T) => T) | (T & Function)' is not assignable to parameter of type '(prev: T) => T'.`

---

## src/lib/hooks/useNeighborhood.ts

Errors in this file:

- `src/lib/hooks/useNeighborhood.ts(129,21): error TS2339: Property 'credit_score' does not exist on type 'UserProfile'.`
- `src/lib/hooks/useNeighborhood.ts(203,26): error TS2339: Property 'credit_score' does not exist on type 'UserProfile'.`

---

## src/lib/hooks/useVehicleAssets.ts

Errors in this file:

- `src/lib/hooks/useVehicleAssets.ts(21,8): error TS2307: Cannot find module '../types/vehicleAssets' or its corresponding type declarations.`

---

## src/lib/hooks/useVisibilityOptimized.ts

Errors in this file:

- `src/lib/hooks/useVisibilityOptimized.ts(2,34): error TS2307: Cannot find module '../components/TabSwitchHandler' or its corresponding type declarations.`

---

## src/lib/isActive.tsx

Errors in this file:

- `src/lib/isActive.tsx(53,29): error TS2307: Cannot find module './CourtEntryModal' or its corresponding type declarations.`
- `src/lib/isActive.tsx(54,31): error TS2307: Cannot find module './sidebar/UserProfileWidget' or its corresponding type declarations.`

---

## src/lib/performanceMode.ts

Errors in this file:

- `src/lib/performanceMode.ts(40,10): error TS2367: This comparison appears to be unintentional because the types '"reduced" | "ultra"' and '"normal"' have no overlap.`

---

## src/lib/profileCache.ts

Errors in this file:

- `src/lib/profileCache.ts(45,34): error TS2345: Argument of type 'PromiseLike<any[] | Profile[]>' is not assignable to parameter of type 'Promise<Profile[]>'.`

---

## src/lib/securityRisk.ts

Errors in this file:

- `src/lib/securityRisk.ts(25,60): error TS2304: Cannot find name 'supabase'.`
- `src/lib/securityRisk.ts(40,42): error TS2304: Cannot find name 'supabase'.`
- `src/lib/securityRisk.ts(68,29): error TS2304: Cannot find name 'supabase'.`
- `src/lib/securityRisk.ts(95,35): error TS2304: Cannot find name 'supabase'.`

---

## src/lib/supabaseWrapper.ts

Errors in this file:

- `src/lib/supabaseWrapper.ts(1,20): error TS2305: Module '"./supabase"' has no exported member 'PostgrestError'.`
- `src/lib/supabaseWrapper.ts(1,36): error TS2305: Module '"./supabase"' has no exported member 'PostgrestResponse'.`

---

## src/lib/update.tsx

Errors in this file:

- `src/lib/update.tsx(470,7): error TS2322: Type '{ streamTitle: string; onStreamTitleChange: Dispatch<SetStateAction<string>>; rtmpUrl: string; streamKey: string; agoraChannel: string; gameTitle: string; ... 25 more ...; cameraPreview: undefined; }' is not assignable to type 'IntrinsicAttributes & GamingSetupProps'.`

---

## src/lib/updateMeta.tsx

Errors in this file:

- `src/lib/updateMeta.tsx(87,36): error TS2551: Property 'author_id' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(199,28): error TS2345: Argument of type '{ id: any; headline: any; featured_image_url: any; published_at: any; author: { username: any; avatar_url: any; }[]; }[]' is not assignable to parameter of type 'SetStateAction<RelatedArticle[]>'.`
- `src/lib/updateMeta.tsx(234,34): error TS2551: Property 'author_id' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(243,60): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(243,88): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(377,48): error TS2551: Property 'published_at' does not exist on type 'TCNNArticle'. Did you mean 'publishedAt'?`
- `src/lib/updateMeta.tsx(377,72): error TS2551: Property 'created_at' does not exist on type 'TCNNArticle'. Did you mean 'createdAt'?`
- `src/lib/updateMeta.tsx(381,28): error TS2551: Property 'view_count' does not exist on type 'TCNNArticle'. Did you mean 'viewCount'?`
- `src/lib/updateMeta.tsx(387,22): error TS2551: Property 'featured_image_url' does not exist on type 'TCNNArticle'. Did you mean 'featuredImageUrl'?`
- `src/lib/updateMeta.tsx(390,32): error TS2551: Property 'featured_image_url' does not exist on type 'TCNNArticle'. Did you mean 'featuredImageUrl'?`
- `src/lib/updateMeta.tsx(401,28): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(403,36): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(404,36): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(414,75): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(414,103): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(415,32): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(427,59): error TS2551: Property 'author_id' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(476,57): error TS2551: Property 'author_id' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(552,28): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`
- `src/lib/updateMeta.tsx(552,56): error TS2551: Property 'author' does not exist on type 'TCNNArticle'. Did you mean 'authorId'?`

---

## src/phone/pages/PhoneAuth.tsx

Errors in this file:

- `src/phone/pages/PhoneAuth.tsx(631,85): error TS2339: Property 'MSStream' does not exist on type 'Window & typeof globalThis'.`

---

## src/phone/pages/PhoneCommunityWall.tsx

Errors in this file:

- `src/phone/pages/PhoneCommunityWall.tsx(379,20): error TS2339: Property 'is_og_user' does not exist on type 'UserProfile'.`

---

## src/phone/pages/PhoneMaiPiks.tsx

Errors in this file:

- `src/phone/pages/PhoneMaiPiks.tsx(1560,10): error TS2304: Cannot find name 'Loader2'.`

---

## src/phone/pages/PhoneProfile.tsx

Errors in this file:

- `src/phone/pages/PhoneProfile.tsx(225,73): error TS2339: Property 'username' does not exist on type 'User'.`

---

## src/phone/usePhoneRoleAccess.ts

Errors in this file:

- `src/phone/usePhoneRoleAccess.ts(19,3): error TS2411: Property 'role' of type 'string' is not assignable to 'string' index type 'boolean'.`
- `src/phone/usePhoneRoleAccess.ts(20,3): error TS2411: Property 'trollRole' of type 'string' is not assignable to 'string' index type 'boolean'.`
- `src/phone/usePhoneRoleAccess.ts(51,7): error TS2322: Type '{ role: string; trollRole: string; isAdmin: false; isCEO: false; isCEOAssistant: false; isNoahAssistant: false; isNoahAdmin: false; isLead: false; isOfficer: false; isSecretary: false; isStaff: false; ... 19 more ...; canAccessRtcAdminMonitor: false; }' is not assignable to type 'PhoneRoleAccess'.`
- `src/phone/usePhoneRoleAccess.ts(329,3): error TS2322: Type '{ role: string; trollRole: string; isAdmin: boolean; isCEO: boolean; isCEOAssistant: boolean; isNoahAssistant: boolean; isNoahAdmin: boolean; isLead: boolean; isOfficer: boolean; isSecretary: boolean; ... 19 more ...; canAccessRtcAdminMonitor: boolean; }' is not assignable to type 'PhoneRoleAccess'.`

---

