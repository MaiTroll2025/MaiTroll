-- Set icon URLs for all badge catalog entries
with icons(slug, icon_url) as (
  values
    ('first-gift', '/badges/first-gift.svg'),
    ('generous-gifter', '/badges/generous-gifter.svg'),
    ('big-spender', '/badges/big-spender.svg'),
    ('community-supporter', '/badges/community-supporter.svg'),
    ('first-loan-repaid', '/badges/first-loan-repaid.svg'),
    ('on-time-payer', '/badges/on-time-payer.svg'),
    ('debt-free', '/badges/debt-free.svg'),
    ('trusted-borrower', '/badges/trusted-borrower.svg'),
    ('elite-reliability', '/badges/elite-reliability.svg'),
    ('first-checkin', '/badges/first-checkin.svg'),
    ('streak-7', '/badges/streak-7.svg'),
    ('streak-30', '/badges/streak-30.svg'),
    ('first-stream', '/badges/first-stream.svg'),
    ('regular-streamer', '/badges/regular-streamer.svg'),
    ('marathon-stream', '/badges/marathon-stream.svg'),
    ('first-reaction', '/badges/first-reaction.svg'),
    ('popular', '/badges/popular.svg'),
    ('first-win', '/badges/first-win.svg'),
    ('court-champion', '/badges/court-champion.svg'),
    ('clean-record', '/badges/clean-record.svg')
)
update badge_catalog bc
set icon_url = i.icon_url
from icons i
where bc.slug = i.slug;
