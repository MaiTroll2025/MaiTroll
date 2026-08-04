-- President Mansion Broadcast Theme
-- Seeds the president_mansion theme into broadcast_background_themes
-- so it appears in the theme selector for all users

INSERT INTO public.broadcast_background_themes (
    slug,
    name,
    description,
    price_coins,
    image_url,
    background_css,
    is_active,
    sort_order,
    is_exclusive,
    is_system_locked
) VALUES (
    'president_mansion',
    'President Mansion',
    'Official Mai Troll Presidential Residence broadcast theme. Purple and gold executive luxury with mansion background.',
    0,
    '/assets/backgrounds/presidentmansion.png',
    'background: url("/assets/backgrounds/presidentmansion.png") center/cover no-repeat; filter: brightness(1.0) contrast(1.0);',
    true,
    100,
    false,
    false
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    background_css = EXCLUDED.background_css,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;
