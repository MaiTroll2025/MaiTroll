// Quick script to apply the voucher migration
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 54322,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // 1. Create user_vouchers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_vouchers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          voucher_type TEXT NOT NULL DEFAULT 'vehicle',
          item_id TEXT NOT NULL,
          item_name TEXT,
          description TEXT,
          is_claimed BOOLEAN DEFAULT false,
          claimed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          expires_at TIMESTAMPTZ,
          CONSTRAINT user_vouchers_one_per_user_type UNIQUE (user_id, voucher_type, item_id)
      );
    `);
    console.log('Created user_vouchers table');

    // Enable RLS and create policies
    await client.query(`ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;`);
    console.log('Enabled RLS on user_vouchers');

    // 2. Update handle_new_user_credit to give voucher instead of car
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user_credit()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, extensions
      AS $$
      BEGIN
          INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
          VALUES (NEW.id, 400, 'Building', 0, NOW())
          ON CONFLICT (user_id) DO NOTHING;

          INSERT INTO public.user_vouchers (user_id, voucher_type, item_id, item_name, description)
          VALUES (
              NEW.id,
              'vehicle',
              'ac8121bd-0320-45eb-8b3c-7d9b445c7b38',
              'Free Starter Vehicle',
              'Welcome voucher for a free starter vehicle. Claim it from your inventory!'
          )
          ON CONFLICT (user_id, voucher_type, item_id) DO NOTHING;

          RETURN NEW;
      EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Error in handle_new_user_credit for %: %', NEW.id, SQLERRM;
          RETURN NEW;
      END;
      $$;
    `);
    console.log('Updated handle_new_user_credit function');

    // 3. Update handle_user_signup to also give voucher
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_user_signup()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, extensions
      AS $$
      DECLARE
        v_username text;
        v_avatar_url text;
        v_email text;
        v_role text;
      BEGIN
        v_username := COALESCE(
          NEW.raw_user_meta_data->>'username',
          'user' || substr(replace(NEW.id::text, '-', ''), 1, 8)
        );
        
        v_avatar_url := COALESCE(
          NEW.raw_user_meta_data->>'avatar_url',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
        );
        
        v_email := COALESCE(NEW.email, '');
        
        IF v_email = 'Mai Troll2025@gmail.com' THEN
          v_role := 'admin';
        ELSE
          v_role := 'user';
        END IF;

        INSERT INTO public.user_profiles (
          id, user_id, username, avatar_url, bio, role, tier,
          paid_coins, troll_coins, total_earned_coins, total_spent_coins,
          email, terms_accepted, created_at, updated_at
        ) VALUES (
          NEW.id, NEW.id, v_username, v_avatar_url, 'New troll in the city!', v_role, 'Bronze',
          0, 100, 100, 0, v_email, false, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_vouchers (user_id, voucher_type, item_id, item_name, description)
        VALUES (
          NEW.id, 'vehicle', 'ac8121bd-0320-45eb-8b3c-7d9b445c7b38',
          'Free Starter Vehicle',
          'Welcome voucher for a free starter vehicle. Claim it from your inventory!'
        )
        ON CONFLICT (user_id, voucher_type, item_id) DO NOTHING;

        INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
        VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
        ON CONFLICT DO NOTHING;

        RETURN NEW;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_user_signup for %: %', NEW.id, SQLERRM;
        RETURN NEW;
      END;
      $$;
    `);
    console.log('Updated handle_user_signup function');

    // 4. Update existing user_profiles with NULL user_id
    await client.query(`
      UPDATE public.user_profiles
      SET user_id = id
      WHERE user_id IS NULL;
    `);
    console.log('Updated existing user_profiles with NULL user_id');

    console.log('\n✅ Migration completed successfully!');
    console.log('New users will now receive a voucher for a free car instead of a starter car.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
