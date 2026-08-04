-- Enable realtime for storage tracking tables so the broadcast StorageIndicator can update live

ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_storage_usage;
