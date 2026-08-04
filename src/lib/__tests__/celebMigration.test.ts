import * as fs from 'fs'
import * as path from 'path'

const MIGRATION_FILE = '20260815000001_create_celeb_system.sql'

function loadMigration(): string {
  const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations')
  const filePath = path.join(migrationsDir, MIGRATION_FILE)
  return fs.readFileSync(filePath, 'utf8')
}

describe('Celeb migration SQL', () => {
  let sql: string

  beforeAll(() => {
    sql = loadMigration()
  })

  describe('user_profiles celeb_role column', () => {
    it('adds celeb_role column to user_profiles', () => {
      expect(sql).toMatch(/ADD COLUMN.*celeb_role.*text/s)
    })

    it('uses IF NOT EXISTS guard for idempotency', () => {
      expect(sql).toMatch(/DO \$\$ BEGIN[\s\S]*?IF NOT EXISTS[\s\S]*?celeb_role/)
    })

    it('documents the celeb_role column', () => {
      expect(sql).toMatch(/COMMENT ON COLUMN.*celeb_role/s)
    })
  })

  describe('streams stream_type extension', () => {
    it('extends the CHECK constraint to include celeb_stream', () => {
      expect(sql).toMatch(/CHECK \(stream_type IN \('standard', 'gaming', 'hytro', 'podcast', 'talk', 'music', 'celeb_stream'\)/)
    })

    it('drops the old constraint before re-adding', () => {
      expect(sql).toMatch(/DROP CONSTRAINT.*stream_type_check/)
    })

    it('creates index for celeb streams', () => {
      expect(sql).toMatch(/idx_streams_celeb.*stream_type.*celeb_stream/s)
    })
  })

  describe('celeb_applications table', () => {
    it('creates the table with required columns', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_applications/)
      expect(sql).toMatch(/user_id uuid NOT NULL REFERENCES public\.user_profiles/)
      expect(sql).toMatch(/full_name text/)
      expect(sql).toMatch(/phone_number text/)
      expect(sql).toMatch(/email text/)
      expect(sql).toMatch(/social_media jsonb/)
    })

    it('has valid status CHECK constraint', () => {
      expect(sql).toMatch(/CHECK \(status IN \('pending', 'in_review', 'approved', 'denied'\)/)
    })

    it('has unique constraint on user_id', () => {
      expect(sql).toMatch(/CONSTRAINT uc_celeb_applications_user UNIQUE \(user_id\)/)
    })

    it('enables FORCE ROW LEVEL SECURITY', () => {
      expect(sql).toMatch(/FORCE ROW LEVEL SECURITY.*celeb_applications/s)
    })

    it('has admin read policy', () => {
      expect(sql).toMatch(/Admins can read all celeb applications/)
    })

    it('has admin review/update policy', () => {
      expect(sql).toMatch(/Admins can review celeb applications/)
    })
  })

  describe('celeb_verification_documents table', () => {
    it('creates table with document_type CHECK', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_verification_documents/)
      expect(sql).toMatch(/CHECK \(document_type IN \('id_document', 'selfie', 'other'\)/)
    })

    it('has unique constraint on user_id + document_type', () => {
      expect(sql).toMatch(/CONSTRAINT uc_celeb_documents_user_type UNIQUE \(user_id, document_type\)/)
    })

    it('has admin read policy', () => {
      expect(sql).toMatch(/Admins can read all celeb documents/)
    })
  })

  describe('celeb_profiles table', () => {
    it('creates with payout_percentage CHECK constraint', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_profiles/)
      expect(sql).toMatch(/CHECK \(payout_percentage >= 0 AND payout_percentage <= 100\)/)
    })

    it('has is_live_allowed flag', () => {
      expect(sql).toMatch(/is_live_allowed boolean DEFAULT false/)
    })
  })

  describe('celeb_external_links table', () => {
    it('creates with platform and url columns', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_external_links/)
      expect(sql).toMatch(/platform text NOT NULL/)
      expect(sql).toMatch(/url text NOT NULL/)
    })
  })

  describe('celeb_products table', () => {
    it('creates with price_coins CHECK (positive)', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_products/)
      expect(sql).toMatch(/CHECK \(price_coins > 0\)/)
    })

    it('has is_active column defaulting to true', () => {
      expect(sql).toMatch(/is_active boolean DEFAULT true/)
    })
  })

  describe('celeb_paid_chat_settings table', () => {
    it('creates with enabled and price_coins columns', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_paid_chat_settings/)
      expect(sql).toMatch(/enabled boolean DEFAULT false/)
      expect(sql).toMatch(/price_coins integer DEFAULT 0 CHECK \(price_coins >= 0\)/)
    })

    it('has whitelist JSON column', () => {
      expect(sql).toMatch(/whitelist jsonb DEFAULT '\[\]'::jsonb/)
    })
  })

  describe('celeb_cashout_tiers table', () => {
    it('creates with min_earned_usd CHECK', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_cashout_tiers/)
      expect(sql).toMatch(/CHECK \(min_earned_usd > 0\)/)
    })

    it('has fee_percent CHECK (0-100)', () => {
      expect(sql).toMatch(/CHECK \(fee_percent >= 0 AND fee_percent <= 100\)/)
    })

    it('has admin-only management policy', () => {
      expect(sql).toMatch(/Admins can manage celeb cashout tiers/)
    })
  })

  describe('celeb_cashout_requests table', () => {
    it('creates with valid status CHECK', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_cashout_requests/)
      expect(sql).toMatch(/CHECK \(status IN \('pending', 'processing', 'paid', 'rejected'\)/)
    })

    it('references celeb_cashout_tiers', () => {
      expect(sql).toMatch(/tier_id uuid NOT NULL REFERENCES public\.celeb_cashout_tiers/)
    })
  })

  describe('celeb_stream_moderation table', () => {
    it('creates with action CHECK constraint', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_stream_moderation/)
      expect(sql).toMatch(/CHECK \(action IN \('mute', 'ban', 'kick', 'timeout', 'pin_message'\)/)
    })

    it('restricts insert to stream owner of celeb streams', () => {
      expect(sql).toMatch(/Celeb stream owner can perform moderation actions/)
    })
  })

  describe('celeb_battle_queue table', () => {
    it('creates with status CHECK', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_battle_queue/)
      expect(sql).toMatch(/CHECK \(status IN \('open', 'matched', 'expired', 'cancelled'\)/)
    })

    it('has unique constraint on stream_id', () => {
      expect(sql).toMatch(/CONSTRAINT uc_celeb_battle_queue_stream UNIQUE \(stream_id\)/)
    })
  })

  describe('celeb_audit_logs table', () => {
    it('creates with action and entity_type columns', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.celeb_audit_logs/)
      expect(sql).toMatch(/action text NOT NULL/)
      expect(sql).toMatch(/entity_type text NOT NULL/)
      expect(sql).toMatch(/entity_id uuid/)
      expect(sql).toMatch(/ip_address inet/)
    })

    it('only allows users to read their own logs', () => {
      expect(sql).toMatch(/Only the user can read their own audit logs/)
    })

    it('allows admins to read all logs', () => {
      expect(sql).toMatch(/Admins can read all celeb audit logs/)
    })
  })

  describe('private storage bucket', () => {
    it('creates private celeb-documents bucket', () => {
      expect(sql).toMatch(/INSERT INTO storage\.buckets/)
      expect(sql).toMatch(/celeb-documents/)
    })

    it('ensures bucket is not public', () => {
       expect(sql).toMatch(/public\s*=\s*false/)
    })

    it('denies anon access to celeb-documents bucket', () => {
      expect(sql).toMatch(/celeb documents: deny anon access/)
    })
  })

  describe('join_seat_atomic RPC', () => {
    it('rejects seat joins on celeb_stream', () => {
      expect(sql).toMatch(/Seats are not available in Celeb Streams/)
    })

    it('checks stream_type before allowing seat join', () => {
      expect(sql).toMatch(/v_stream_type/)
      expect(sql).toMatch(/v_stream_type = 'celeb_stream'/)
    })
  })

  describe('create_celeb_cashout_request RPC', () => {
    it('validates the user is an approved celeb', () => {
      expect(sql).toMatch(/not_an_approved_celeb/)
    })

    it('computes fee and payout server-side', () => {
      expect(sql).toMatch(/v_fee/)
      expect(sql).toMatch(/v_payout/)
    })

    it('rejects identity mismatch', () => {
      expect(sql).toMatch(/identity_mismatch/)
    })
  })

  describe('get_celeb_dashboard_data RPC', () => {
    it('returns available_usd computed from earnings minus pending', () => {
      expect(sql).toMatch(/v_available_usd/)
      expect(sql).toMatch(/monthly_earning_usd/)
      expect(sql).toMatch(/pending_cashout/)
    })

    it('returns is_verified_celeb boolean', () => {
      expect(sql).toMatch(/is_verified_celeb/)
      expect(sql).toMatch(/celeb_role = 'approved'/)
    })
  })

  describe('get_celeb_streams RPC', () => {
    it('only returns approved celeb streams', () => {
      expect(sql).toMatch(/stream_type = 'celeb_stream'/)
      expect(sql).toMatch(/celeb_role = 'approved'/)
    })
  })

  describe('send_celeb_notification RPC', () => {
    it('only allows admins or self to send notifications', () => {
      expect(sql).toMatch(/Not authorized to send notification/)
    })

    it('uses notifications table for delivery', () => {
      expect(sql).toMatch(/INSERT INTO notifications/)
    })
  })

  describe('seed data', () => {
    it('seeds default cashout tiers', () => {
      expect(sql).toMatch(/INSERT INTO public\.celeb_cashout_tiers/)
      expect(sql).toMatch(/Standard/)
      expect(sql).toMatch(/Express/)
      expect(sql).toMatch(/Instant/)
    })
  })
})
