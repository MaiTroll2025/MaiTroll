import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  X,
  Sparkles,
  Megaphone,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PhoneAdProps {
  noAds?: boolean
  duration?: number
  placement?: string
}

interface PromoAd {
  id: string
  username?: string | null
  title?: string | null
  description?: string | null
  imageUrl?: string | null
  ctaUrl?: string | null
  ctaText?: string | null
  label?: string | null
  isUserAd: boolean
}

const DEFAULT_DURATION = 20

export default function PhoneAd({
  noAds = false,
  duration = DEFAULT_DURATION,
  placement = 'phone',
}: PhoneAdProps) {
  const [ads, setAds] = useState<PromoAd[]>([])
  const [loading, setLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(duration)
  const [visible, setVisible] = useState(true)
  const [selectedAd, setSelectedAd] = useState<PromoAd | null>(null)

  /*
   * ------------------------------------------------------------------------
   * FETCH REAL PROMOS
   * ------------------------------------------------------------------------
   */

  const fetchPromos = useCallback(async () => {
    try {
      setLoading(true)

      const now = new Date().toISOString()

      /*
       * Official/admin promos
       */
      const { data: officialAds, error: officialError } = await supabase
        .from('city_ads')
        .select('*')
        .eq('is_active', true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order('priority', {
          ascending: false,
        })
        .order('display_order', {
          ascending: true,
        })

      if (officialError) {
        console.error(
          '[PhoneAd] Official promo fetch failed:',
          officialError,
        )
      }

      /*
       * Paid user promos
       */
      const { data: userAds, error: userError } = await supabase
        .from('user_advertisements')
        .select('*')
        .eq('status', 'active')
        .or(
          `placement.is.null,placement.eq.${placement},placement.eq.any`,
        )
        .order('slot_start_time', {
          ascending: true,
        })

      if (userError) {
        console.error(
          '[PhoneAd] User promo fetch failed:',
          userError,
        )
      }

      /*
       * Normalize official promos.
       */
      const normalizedOfficial: PromoAd[] = (
        officialAds || []
      ).map((ad: any) => ({
        id: String(ad.id),

        username:
          ad.username ||
          ad.advertiser_name ||
          ad.business_name ||
          'MaiTroll',

        title:
          ad.title ||
          ad.name ||
          'Featured on MaiTroll',

        description:
          ad.description ||
          ad.body ||
          null,

        imageUrl:
          ad.image_url ||
          ad.imageUrl ||
          ad.image ||
          ad.banner_url ||
          ad.banner_image ||
          null,

        ctaUrl:
          ad.cta_link ||
          ad.link_url ||
          ad.target_url ||
          ad.url ||
          null,

        ctaText:
          ad.cta_text ||
          ad.button_text ||
          'Learn More',

        label:
          ad.label ||
          'Sponsored',

        isUserAd: false,
      }))

      /*
       * Normalize paid user promos.
       */
      const normalizedUser: PromoAd[] = (
        userAds || []
      ).map((ad: any) => ({
        id: String(ad.id),

        username:
          ad.username ||
          ad.display_name ||
          ad.advertiser_name ||
          'MaiTroll User',

        title:
          ad.title ||
          ad.name ||
          'Promoted on MaiTroll',

        description:
          ad.description ||
          ad.ad_description ||
          null,

        imageUrl:
          ad.image_url ||
          ad.imageUrl ||
          ad.image ||
          ad.banner_url ||
          ad.banner_image ||
          null,

        /*
         * This matches your existing PromoSlot:
         *
         * cta_link: ad.link_url
         */
        ctaUrl:
          ad.link_url ||
          ad.cta_link ||
          ad.target_url ||
          null,

        ctaText:
          ad.cta_text ||
          ad.button_text ||
          'Learn More',

        label: 'Sponsored',

        isUserAd: true,
      }))

      /*
       * Official promos first, paid promos second.
       */
      const combined = [
        ...normalizedOfficial,
        ...normalizedUser,
      ].filter((ad) => {
        return Boolean(
          ad.imageUrl ||
            ad.title ||
            ad.description ||
            ad.ctaUrl,
        )
      })

      setAds(combined)

      if (combined.length > 0) {
        setSecondsLeft(duration)
        setVisible(true)
      }
    } catch (error) {
      console.error(
        '[PhoneAd] Failed to load promos:',
        error,
      )

      setAds([])
    } finally {
      setLoading(false)
    }
  }, [duration, placement])

  /*
   * ------------------------------------------------------------------------
   * INITIAL FETCH
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    if (noAds) {
      setVisible(false)
      return
    }

    fetchPromos()
  }, [fetchPromos, noAds])

  /*
   * ------------------------------------------------------------------------
   * SELECT A PROMO
   * ------------------------------------------------------------------------
   */

  const currentAd = useMemo(() => {
    if (!ads.length) {
      return null
    }

    /*
     * Randomize the promo shown on each homepage load.
     */
    const randomIndex = Math.floor(
      Math.random() * ads.length,
    )

    return ads[randomIndex]
  }, [ads])

  /*
   * ------------------------------------------------------------------------
   * 20 SECOND TIMER
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !visible ||
      noAds ||
      !currentAd
    ) {
      return
    }

    if (secondsLeft <= 0) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) =>
        Math.max(0, current - 1),
      )
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    currentAd,
    noAds,
    secondsLeft,
    visible,
  ])

  /*
   * ------------------------------------------------------------------------
   * TRACK IMPRESSION
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    if (!currentAd) {
      return
    }

    if (!currentAd.isUserAd) {
      return
    }

    supabase
      .rpc(
        'increment_user_ad_impressions',
        {
          ad_id: currentAd.id,
        },
      )
      .then(({ error }) => {
        if (error) {
          console.error(
            '[PhoneAd] Impression tracking failed:',
            error,
          )
        }
      })
  }, [currentAd])

  /*
   * ------------------------------------------------------------------------
   * CLOSE
   * ------------------------------------------------------------------------
   */

  const closeBanner = () => {
    setVisible(false)
  }

  /*
   * ------------------------------------------------------------------------
   * OPEN LARGE PROMO
   * ------------------------------------------------------------------------
   */

  const openPromo = () => {
    if (!currentAd) {
      return
    }

    setSelectedAd(currentAd)
  }

  /*
   * ------------------------------------------------------------------------
   * OPEN CTA
   * ------------------------------------------------------------------------
   */

  const openCTA = () => {
    if (!selectedAd?.ctaUrl) {
      return
    }

    window.open(
      selectedAd.ctaUrl,
      '_blank',
      'noopener,noreferrer',
    )
  }

  /*
   * ------------------------------------------------------------------------
   * HIDDEN
   * ------------------------------------------------------------------------
   */

  if (
    noAds ||
    !visible ||
    loading ||
    !currentAd
  ) {
    return null
  }

  const progress =
    duration > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (secondsLeft / duration) * 100,
          ),
        )
      : 0

  return (
    <>
      {/* ================================================================ */}
      {/* PHONE BANNER                                                     */}
      {/* ================================================================ */}

      <div
        className="
          pointer-events-none
          fixed
          bottom-[76px]
          left-0
          right-0
          z-[140]
          px-3
          pb-[calc(env(safe-area-inset-bottom)+4px)]
        "
      >
        <div
          className="
            pointer-events-auto
            mx-auto
            w-full
            max-w-md
            overflow-hidden
            rounded-[22px]
            border
            border-[#00BFFF]/25
            bg-[#05050d]/95
            shadow-[0_0_35px_rgba(0,191,255,0.16),0_0_55px_rgba(191,0,255,0.10)]
            backdrop-blur-2xl
          "
        >
          {/* Progress */}

          <div className="h-[2px] w-full bg-white/5">
            <div
              className="
                h-full
                bg-gradient-to-r
                from-[#00BFFF]
                via-[#1E90FF]
                to-[#BF00FF]
                shadow-[0_0_10px_#00BFFF]
                transition-[width]
                duration-1000
                ease-linear
              "
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          {/* Header */}

          <div className="flex items-center justify-between px-3 pt-2">
            <div className="flex items-center gap-1.5">
              <Megaphone
                size={10}
                className="text-[#00BFFF]"
              />

              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[#00BFFF]">
                {currentAd.label || 'Sponsored'}
              </span>

              <span className="text-[7px] text-zinc-700">
                •
              </span>

              <span className="text-[7px] font-bold text-zinc-600">
                {secondsLeft}s
              </span>
            </div>

            <button
              type="button"
              onClick={closeBanner}
              aria-label="Close advertisement"
              className="
                grid
                h-7
                w-7
                place-items-center
                rounded-full
                border
                border-white/10
                bg-white/[0.035]
                text-zinc-500
                transition
                active:scale-90
              "
            >
              <X size={13} />
            </button>
          </div>

          {/* Promo */}

          <button
            type="button"
            onClick={openPromo}
            className="
              group
              block
              w-full
              text-left
            "
          >
            <div className="p-3">
              <div
                className="
                  relative
                  overflow-hidden
                  rounded-[17px]
                  border
                  border-white/10
                  bg-[#080811]
                "
              >
                {/* Actual promo image */}

                {currentAd.imageUrl ? (
                  <img
                    src={currentAd.imageUrl}
                    alt={
                      currentAd.title ||
                      'Sponsored promotion'
                    }
                    className="
                      h-[150px]
                      w-full
                      object-cover
                      transition
                      duration-500
                      group-active:scale-[0.98]
                    "
                  />
                ) : (
                  <div
                    className="
                      flex
                      h-[150px]
                      w-full
                      items-center
                      justify-center
                      bg-gradient-to-br
                      from-[#00BFFF]/20
                      via-[#080811]
                      to-[#BF00FF]/20
                    "
                  >
                    <Sparkles
                      size={30}
                      className="
                        text-[#00BFFF]
                        drop-shadow-[0_0_15px_#00BFFF]
                      "
                    />
                  </div>
                )}

                {/* Neon overlay */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-black/80
                    via-black/10
                    to-transparent
                  "
                />

                {/* Open indicator */}

                <div
                  className="
                    absolute
                    right-2
                    top-2
                    flex
                    items-center
                    gap-1
                    rounded-full
                    border
                    border-white/15
                    bg-black/55
                    px-2
                    py-1
                    text-[7px]
                    font-black
                    uppercase
                    tracking-wider
                    text-white
                    backdrop-blur
                  "
                >
                  Tap to view
                  <ChevronRight
                    size={9}
                    className="text-[#00BFFF]"
                  />
                </div>

                {/* Promo text */}

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  {currentAd.username && (
                    <p className="text-[8px] font-bold text-[#00BFFF]">
                      @{currentAd.username}
                    </p>
                  )}

                  {currentAd.title && (
                    <p className="mt-0.5 line-clamp-1 text-sm font-black text-white">
                      {currentAd.title}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* LARGE PROMO VIEW                                                 */}
      {/* ================================================================ */}

      {selectedAd && (
        <div
          className="
            fixed
            inset-0
            z-[300]
            flex
            items-center
            justify-center
            bg-black/85
            px-4
            py-6
            backdrop-blur-xl
          "
          onClick={() => setSelectedAd(null)}
        >
          <div
            className="
              relative
              w-full
              max-w-md
              overflow-hidden
              rounded-[28px]
              border
              border-[#00BFFF]/25
              bg-[#05050d]
              shadow-[0_0_50px_rgba(0,191,255,0.18),0_0_80px_rgba(191,0,255,0.12)]
            "
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* Close */}

            <button
              type="button"
              onClick={() => setSelectedAd(null)}
              aria-label="Close promotion"
              className="
                absolute
                right-3
                top-3
                z-20
                grid
                h-9
                w-9
                place-items-center
                rounded-full
                border
                border-white/15
                bg-black/60
                text-white
                backdrop-blur
                transition
                active:scale-90
              "
            >
              <X size={17} />
            </button>

            {/* Image */}

            {selectedAd.imageUrl ? (
              <img
                src={selectedAd.imageUrl}
                alt={
                  selectedAd.title ||
                  'Sponsored promotion'
                }
                className="
                  max-h-[55vh]
                  w-full
                  object-cover
                "
              />
            ) : (
              <div
                className="
                  flex
                  h-[260px]
                  items-center
                  justify-center
                  bg-gradient-to-br
                  from-[#00BFFF]/20
                  via-[#080811]
                  to-[#BF00FF]/20
                "
              >
                <Sparkles
                  size={48}
                  className="text-[#00BFFF]"
                />
              </div>
            )}

            {/* Details */}

            <div className="p-5">
              <div className="flex items-center gap-2">
                <Megaphone
                  size={13}
                  className="text-[#00BFFF]"
                />

                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00BFFF]">
                  {selectedAd.label || 'Sponsored'}
                </span>
              </div>

              {selectedAd.username && (
                <p className="mt-3 text-xs font-bold text-[#00BFFF]">
                  @{selectedAd.username}
                </p>
              )}

              {selectedAd.title && (
                <h2 className="mt-1 text-xl font-black text-white">
                  {selectedAd.title}
                </h2>
              )}

              {selectedAd.description && (
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {selectedAd.description}
                </p>
              )}

              {/* CTA */}

              {selectedAd.ctaUrl && (
                <button
                  type="button"
                  onClick={openCTA}
                  className="
                    mt-5
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    border
                    border-[#00BFFF]/30
                    bg-gradient-to-r
                    from-[#00BFFF]/20
                    to-[#BF00FF]/20
                    py-3.5
                    text-sm
                    font-black
                    text-white
                    shadow-[0_0_25px_rgba(0,191,255,0.12)]
                    transition
                    active:scale-[0.98]
                  "
                >
                  {selectedAd.ctaText || 'Learn More'}

                  <ExternalLink
                    size={15}
                    className="text-[#00BFFF]"
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}