-- ============================================================================
-- Migration: repair_storage_buckets
-- Creates all storage buckets referenced by the frontend
-- Applied: 2026-07-30
-- ============================================================================

-- Storage buckets for frontend pages
-- These were initially created via API but are tracked here for migration history

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('replays', 'replays', true, 2147483648, ARRAY['video/webm', 'video/mp4', 'video/x-msvideo'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('auction-items', 'auction-items', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('family-banners', 'family-banners', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('podcast-covers', 'podcast-covers', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('podcast-audio', 'podcast-audio', false, 52428800, ARRAY['audio/mp3', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('academy-files', 'academy-files', false, 104857600, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assignment-submissions', 'assignment-submissions', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', false, 5242880, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence-files', 'evidence-files', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4', 'audio/mp3'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('court-documents', 'court-documents', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- Additional buckets used by frontend
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ad-assets', 'ad-assets', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audio', 'audio', false, 52428800, ARRAY['audio/mp3', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-attachments', 'feedback-attachments', false, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ma-city-assets', 'ma-city-assets', true, 104857600, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-files', 'org-files', false, 104857600, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-images', 'post-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('verification_docs', 'verification_docs', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('xtrollz-documents', 'xtrollz-documents', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;
