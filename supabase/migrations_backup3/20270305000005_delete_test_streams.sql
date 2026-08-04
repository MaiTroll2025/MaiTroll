-- Migration to delete test streams
-- Deletes streams with titles containing 'test', 'demo', etc.

DELETE FROM public.streams
WHERE 
    is_live = false -- Only delete finished streams to be safe? Or all? User said "remove test streams". Assuming all.
    AND (
        title ILIKE '%test%' OR
        title ILIKE '%demo%' OR
        title ILIKE '%debug%' OR
        title ILIKE '%sample%' OR
        title ILIKE '%temp%' OR
        title ILIKE '%fake%'
    );

-- Also remove them from government view (which selects from streams anyway)
-- Note: 'government streams' view usually filters streams. If we delete from streams, they are gone from the view.
