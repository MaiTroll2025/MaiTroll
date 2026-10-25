
BEGIN;

-- Ensure exact terms cannot be duplicated.
-- If this fails, inspect existing duplicate terms first.
CREATE UNIQUE INDEX IF NOT EXISTS moderation_keywords_term_uidx
ON public.moderation_keywords (term);

-- Add additional terms from the expanded moderation policy.
INSERT INTO public.moderation_keywords (term, category, severity)
VALUES
    -- Racial hate and targeted identity attacks
    ('nigger', 'hate', 5),
    ('niggers', 'hate', 5),
    ('nigga', 'hate', 5),
    ('niggas', 'hate', 5),
    ('cracker', 'hate', 3),
    ('crackers', 'hate', 3),
    ('kill all racial groups', 'hate', 5),
    ('racial inferiority', 'hate', 5),
    ('racial dehumanization', 'hate', 5),
    ('ethnic cleansing', 'hate', 5),
    ('lynch them', 'hate', 5),
    ('go back to your country', 'hate', 4),
    ('race-based threats', 'hate', 5),

    -- Sexuality and gender-based hate
    ('faggot', 'hate', 5),
    ('fag', 'hate', 5),
    ('dyke', 'hate', 5),
    ('tranny', 'hate', 5),
    ('kill all gays', 'hate', 5),
    ('attack LGBTQ people', 'hate', 5),
    ('anti-gay violence', 'hate', 5),
    ('anti-trans violence', 'hate', 5),
    ('homophobic threat', 'hate', 5),
    ('transphobic threat', 'hate', 5),

    -- Religious hate and incitement
    ('kill all Muslims', 'hate', 5),
    ('kill all Christians', 'hate', 5),
    ('kill all Jews', 'hate', 5),
    ('kill all Hindus', 'hate', 5),
    ('kill all Sikhs', 'hate', 5),
    ('burn their mosque', 'hate', 5),
    ('burn their church', 'hate', 5),
    ('burn their synagogue', 'hate', 5),
    ('attack their place of worship', 'hate', 5),
    ('religious dehumanization', 'hate', 5),

    -- Threats and violent intimidation
    ('kill you', 'threat', 5),
    ('I will kill you', 'threat', 5),
    ('I''ll kill you', 'threat', 5),
    ('I know where you live', 'threat', 5),
    ('hurt your family', 'threat', 5),
    ('send someone to kill you', 'threat', 5),
    ('school shooting threat', 'threat', 5),
    ('mass shooting threat', 'threat', 5),
    ('kidnap you', 'threat', 5),
    ('burn your house', 'threat', 5),

    -- Self-harm encouragement
    ('kill yourself', 'selfharm', 5),
    ('kys', 'selfharm', 5),
    ('go die', 'selfharm', 4),
    ('commit suicide', 'selfharm', 5),
    ('end your life', 'selfharm', 5),
    ('you deserve to die', 'selfharm', 5),
    ('nobody would miss you', 'selfharm', 4),
    ('go hang yourself', 'selfharm', 5),
    ('jump off a bridge', 'selfharm', 5),
    ('make them self-harm', 'selfharm', 5),

    -- Doxxing and private information
    ('post their home address', 'doxxing', 5),
    ('leak their phone number', 'doxxing', 5),
    ('publish their private email', 'doxxing', 5),
    ('leak their passwords', 'doxxing', 5),
    ('publish private medical records', 'doxxing', 5),
    ('share their live location', 'doxxing', 5),
    ('publish government ID numbers', 'doxxing', 5),
    ('swat this person', 'doxxing', 5),

    -- Drugs and dangerous substances
    ('sell fentanyl', 'drugs', 5),
    ('buy heroin', 'drugs', 5),
    ('sell cocaine', 'drugs', 5),
    ('buy methamphetamine', 'drugs', 5),
    ('poison someone', 'drugs', 5),
    ('drug someone without consent', 'drugs', 5),
    ('date-rape drug instructions', 'drugs', 5),

    -- Fraud, scams, and account abuse
    ('steal someone''s identity', 'fraud', 5),
    ('credit card fraud', 'fraud', 5),
    ('bank account takeover', 'fraud', 5),
    ('phishing login credentials', 'fraud', 5),
    ('sell stolen passwords', 'fraud', 5),
    ('fake payment receipt', 'fraud', 4),
    ('blackmail for money', 'fraud', 5),
    ('hire a hitman', 'fraud', 5),

    -- Spam and impersonation
    ('free coins generator', 'spam', 3),
    ('guaranteed cashout hack', 'spam', 4),
    ('fake giveaway link', 'spam', 3),
    ('send me your verification code', 'spam', 4),
    ('DM me your password', 'spam', 5),
    ('pretend to be Mai Troll support', 'spam', 5),
    ('evade moderation filter', 'spam', 4),

    -- Sexual harassment and exploitation
    ('send me nudes', 'sexual', 4),
    ('sexual blackmail threat', 'sexual', 5),
    ('demand intimate photos', 'sexual', 4),
    ('sexual stalking', 'sexual', 5),
    ('coerce intimate content', 'sexual', 5),
    ('nonconsensual intimate images', 'sexual', 5),
    ('minor sexual solicitation', 'sexual', 5),
    ('grooming a minor', 'sexual', 5),
    ('sharing intimate images without consent', 'sexual', 5),

    -- General targeted harassment
    ('nobody wants you', 'harassment', 3),
    ('you should disappear', 'harassment', 3),
    ('worthless loser', 'harassment', 3),
    ('everyone attack this user', 'harassment', 5),
    ('dogpile this person', 'harassment', 5),
    ('publish their secrets', 'harassment', 5)

ON CONFLICT (term) DO NOTHING;

COMMIT;

-- Verify seeded terms by category.
SELECT category, severity, COUNT(*) AS keyword_count
FROM public.moderation_keywords
GROUP BY category, severity
ORDER BY category, severity DESC;
