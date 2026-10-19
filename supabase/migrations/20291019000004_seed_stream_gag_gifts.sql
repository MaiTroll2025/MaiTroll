
UPDATE public.gift_items
SET is_active = false,
    status = 'inactive'
WHERE LOWER(COALESCE(animation_type, '')) LIKE 'ar\_%' ESCAPE '\'
   OR LOWER(COALESCE(category, '')) LIKE 'ar\_%' ESCAPE '\';

INSERT INTO public.gift_items (
  gift_slug, name, coin_cost, icon, category, currency, description,
  animation_type, animation_key, rarity, status, is_active, animation_duration_ms
)
SELECT
  gift_slug, name, coin_cost, icon, category, 'troll_coins', description,
  'emoji', replace(gift_slug, '-', '_'), rarity, 'active', true, 2000
FROM (
  VALUES
    ('the-panic-button', 'The Panic Button', 175, '🚨', 'general', 'Hit the panic button and unleash instant chaos.', 'rare'),
    ('swat-that-troll', 'Swat That Troll', 125, '🪰', 'funny', 'Swat a troll right out of the chat.', 'rare'),
    ('tnt-trouble', 'TNT Trouble', 350, '🧨', 'general', 'A little TNT for a very loud reaction.', 'epic'),
    ('bonk-hammer', 'Bonk Hammer', 150, '🔨', 'funny', 'Deliver a well-timed bonk.', 'rare'),
    ('pop-out-punch', 'Pop-Out Punch', 250, '🥊', 'general', 'A surprise punch straight into the moment.', 'rare'),
    ('trollnado', 'Trollnado', 750, '🌪️', 'general', 'Spin the whole broadcast into a trollnado.', 'epic'),
    ('crown-the-creator', 'Crown the Creator', 500, '👑', 'luxury', 'Crown the creator with the recognition they deserve.', 'epic'),
    ('the-vault', 'The Vault', 1000, '🏦', 'luxury', 'Lock in a vault-sized show of support.', 'legendary'),
    ('pull-up-in-style', 'Pull Up in Style', 1500, '🚘', 'luxury', 'Make a grand entrance in style.', 'legendary'),
    ('iced-out', 'Iced Out', 800, '💎', 'luxury', 'Bring the diamond-level shine.', 'epic'),
    ('the-throne', 'The Throne', 2000, '🪑', 'luxury', 'Claim the throne for a true VIP.', 'legendary'),
    ('main-character', 'Main Character', 650, '🌟', 'luxury', 'Give the main character their spotlight.', 'epic'),
    ('expose-the-evidence', 'Expose the Evidence', 200, '🕵️', 'general', 'Put the evidence on display.', 'rare'),
    ('spin-the-chaos-wheel', 'Spin the Chaos Wheel', 500, '🎡', 'general', 'Spin the wheel and let chaos decide.', 'epic'),
    ('chat-decides', 'Chat Decides', 300, '🗳️', 'general', 'Let chat make the call.', 'rare'),
    ('put-me-on-the-spot', 'Put Me on the Spot', 225, '🎯', 'funny', 'Put the creator right on the spot.', 'rare'),
    ('the-golden-buzzer', 'The Golden Buzzer', 600, '🔔', 'luxury', 'Give that moment the golden-buzzer treatment.', 'epic'),
    ('plot-twist', 'Plot Twist', 400, '🔀', 'general', 'Flip the story with a plot twist.', 'epic'),
    ('meteor-strike', 'Meteor Strike', 1250, '☄️', 'general', 'Drop a meteor-sized reaction into the room.', 'legendary'),
    ('alien-abduction', 'Alien Abduction', 900, '🛸', 'general', 'Beam the moment up with an alien abduction.', 'epic'),
    ('zeus-mode', 'Zeus Mode', 1000, '⚡', 'luxury', 'Call down the full power of Zeus.', 'legendary'),
    ('portal-jump', 'Portal Jump', 700, '🌀', 'general', 'Jump through a portal into the next moment.', 'epic'),
    ('the-prophecy', 'The Prophecy', 450, '📜', 'general', 'Reveal what the prophecy foretold.', 'epic'),
    ('sky-explosion', 'Sky Explosion', 1100, '🎆', 'general', 'Light up the sky with an explosion of color.', 'legendary')
) AS gifts(gift_slug, name, coin_cost, icon, category, description, rarity)
ON CONFLICT (gift_slug) WHERE gift_slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  coin_cost = EXCLUDED.coin_cost,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  currency = EXCLUDED.currency,
  description = EXCLUDED.description,
  animation_type = EXCLUDED.animation_type,
  animation_key = EXCLUDED.animation_key,
  rarity = EXCLUDED.rarity,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  animation_duration_ms = EXCLUDED.animation_duration_ms;
