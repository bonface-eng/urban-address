-- =============================================================================
-- 03_rls_policies.sql
-- Urban Auto Express — Row Level Security Policies (Translated from firestore.rules)
-- Enables RLS on ALL 55 tables. Server-only tables have 0 client policies.
-- =============================================================================

BEGIN;

-- Enable RLS across every table in public schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- 1. public.admins
-- =============================================================================
DROP POLICY IF EXISTS "admins_select_own_or_super" ON public.admins;
CREATE POLICY "admins_select_own_or_super" ON public.admins
  FOR SELECT USING (
    (public.is_signed_in() AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "admins_write_super" ON public.admins;
CREATE POLICY "admins_write_super" ON public.admins
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- =============================================================================
-- 2. public.profiles (users/{userId})
-- =============================================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.owns_user(uid)
    OR (public.is_staff() AND NOT public.is_kitchen())
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    (id = auth.uid() AND role = 'CLIENT')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR public.owns_user(uid)
    OR public.is_admin()
  )
  WITH CHECK (
    id = auth.uid()
    OR public.owns_user(uid)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- =============================================================================
-- 3. User Subcollections: user_held_bills, user_fleet, user_ai_chats, user_memories
-- =============================================================================
DROP POLICY IF EXISTS "held_bills_all" ON public.user_held_bills;
CREATE POLICY "held_bills_all" ON public.user_held_bills
  FOR ALL USING (
    user_id = auth.uid()
    OR public.owns_user(cashier_uid)
    OR (public.is_staff() AND NOT public.is_kitchen())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.owns_user(cashier_uid)
    OR (public.is_staff() AND NOT public.is_kitchen())
  );

DROP POLICY IF EXISTS "fleet_all" ON public.user_fleet;
CREATE POLICY "fleet_all" ON public.user_fleet
  FOR ALL USING (
    user_id = auth.uid()
    OR public.owns_user(owner_uid)
    OR (public.is_staff() AND NOT public.is_kitchen())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.owns_user(owner_uid)
    OR (public.is_staff() AND NOT public.is_kitchen())
  );

DROP POLICY IF EXISTS "ai_chats_all" ON public.user_ai_chats;
CREATE POLICY "ai_chats_all" ON public.user_ai_chats
  FOR ALL USING (
    user_id = auth.uid()
    OR public.owns_user(owner_uid)
    OR public.is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.owns_user(owner_uid)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "memories_all" ON public.user_memories;
CREATE POLICY "memories_all" ON public.user_memories
  FOR ALL USING (
    user_id = auth.uid()
    OR public.owns_user(owner_uid)
    OR public.is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.owns_user(owner_uid)
    OR public.is_admin()
  );

-- =============================================================================
-- 4. public.digital_menus (digitalMenus/{menuId})
-- =============================================================================
DROP POLICY IF EXISTS "digital_menus_select" ON public.digital_menus;
CREATE POLICY "digital_menus_select" ON public.digital_menus
  FOR SELECT USING (
    (id = 'main' AND status = 'PUBLISHED')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "digital_menus_write" ON public.digital_menus;
CREATE POLICY "digital_menus_write" ON public.digital_menus
  FOR ALL USING (public.is_admin() AND id = 'main')
  WITH CHECK (public.is_admin() AND id = 'main' AND status IN ('DRAFT', 'PUBLISHED'));

-- =============================================================================
-- 5. public.inventory & public.inventory_backups
-- =============================================================================
DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "inventory_insert" ON public.inventory;
CREATE POLICY "inventory_insert" ON public.inventory
  FOR INSERT WITH CHECK (public.is_staff() AND NOT public.is_kitchen() AND public.is_admin());

DROP POLICY IF EXISTS "inventory_update" ON public.inventory;
CREATE POLICY "inventory_update" ON public.inventory
  FOR UPDATE USING (public.is_staff() AND NOT public.is_kitchen())
  WITH CHECK (public.is_staff() AND NOT public.is_kitchen());

DROP POLICY IF EXISTS "inventory_delete" ON public.inventory;
CREATE POLICY "inventory_delete" ON public.inventory
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "inventory_backups_admin" ON public.inventory_backups;
CREATE POLICY "inventory_backups_admin" ON public.inventory_backups
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- 6. public.orders & public.order_items
-- =============================================================================
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT USING (
    public.is_staff()
    OR (public.is_signed_in() AND public.owns_user(cashier_id))
    OR (public.is_signed_in() AND public.owns_user(customer_id))
  );

DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT WITH CHECK (
    (public.is_staff() AND NOT public.is_kitchen())
    OR (
      public.is_signed_in()
      AND public.owns_user(customer_id)
      AND status IN ('PENDING', 'UNPAID', 'AWAITING_PAYMENT')
      AND total >= 0
    )
  );

DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE USING (
    public.is_admin()
    OR (public.is_staff() AND NOT public.is_kitchen())
    OR public.is_kitchen()
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND NOT public.is_kitchen())
    OR public.is_kitchen()
  );

DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public.is_staff()
          OR public.owns_user(o.cashier_id)
          OR public.owns_user(o.customer_id)
        )
    )
  );

-- =============================================================================
-- 7. public.carwash_jobs & public.vehicles
-- =============================================================================
DROP POLICY IF EXISTS "carwash_jobs_select" ON public.carwash_jobs;
CREATE POLICY "carwash_jobs_select" ON public.carwash_jobs
  FOR SELECT USING (
    public.is_signed_in() AND (public.is_staff() OR public.owns_user(customer_id))
  );

DROP POLICY IF EXISTS "carwash_jobs_insert" ON public.carwash_jobs;
CREATE POLICY "carwash_jobs_insert" ON public.carwash_jobs
  FOR INSERT WITH CHECK (
    public.is_staff()
    OR (public.is_signed_in() AND public.owns_user(customer_id))
  );

DROP POLICY IF EXISTS "carwash_jobs_update" ON public.carwash_jobs;
CREATE POLICY "carwash_jobs_update" ON public.carwash_jobs
  FOR UPDATE USING (public.is_staff() AND NOT public.is_kitchen())
  WITH CHECK (public.is_staff() AND NOT public.is_kitchen());

DROP POLICY IF EXISTS "carwash_jobs_delete" ON public.carwash_jobs;
CREATE POLICY "carwash_jobs_delete" ON public.carwash_jobs
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "vehicles_write" ON public.vehicles;
CREATE POLICY "vehicles_write" ON public.vehicles
  FOR ALL USING (public.is_staff() AND NOT public.is_kitchen())
  WITH CHECK (public.is_staff() AND NOT public.is_kitchen());

-- =============================================================================
-- 8. public.system_incidents & public.audit_logs
-- =============================================================================
DROP POLICY IF EXISTS "system_incidents_insert" ON public.system_incidents;
CREATE POLICY "system_incidents_insert" ON public.system_incidents
  FOR INSERT WITH CHECK (
    public.is_signed_in()
    AND public.owns_user(user_id)
    AND status = 'OPEN'
    AND category IN ('CLIENT_ERROR', 'UNHANDLED_REJECTION', 'FIRESTORE_PERMISSION', 'SUPABASE_PERMISSION')
  );

DROP POLICY IF EXISTS "system_incidents_select" ON public.system_incidents;
CREATE POLICY "system_incidents_select" ON public.system_incidents
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "system_incidents_update" ON public.system_incidents;
CREATE POLICY "system_incidents_update" ON public.system_incidents
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin() AND status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED'));

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_staff() AND NOT public.is_kitchen());

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- =============================================================================
-- 9. Finance, Terminals, Sessions & Suppliers
-- =============================================================================
DROP POLICY IF EXISTS "suppliers_admin" ON public.suppliers;
CREATE POLICY "suppliers_admin" ON public.suppliers
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "petty_cash_select_insert" ON public.petty_cash;
CREATE POLICY "petty_cash_select_insert" ON public.petty_cash
  FOR SELECT USING (public.is_staff() AND NOT public.is_kitchen());

DROP POLICY IF EXISTS "petty_cash_insert" ON public.petty_cash;
CREATE POLICY "petty_cash_insert" ON public.petty_cash
  FOR INSERT WITH CHECK (public.is_staff() AND NOT public.is_kitchen());

DROP POLICY IF EXISTS "petty_cash_update_delete" ON public.petty_cash;
CREATE POLICY "petty_cash_update_delete" ON public.petty_cash
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "petty_cash_delete" ON public.petty_cash;
CREATE POLICY "petty_cash_delete" ON public.petty_cash
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "reconciliations_admin" ON public.reconciliations;
CREATE POLICY "reconciliations_admin" ON public.reconciliations
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "salary_advances_select" ON public.salary_advances;
CREATE POLICY "salary_advances_select" ON public.salary_advances
  FOR SELECT USING (public.is_staff() AND NOT public.is_kitchen());

DROP POLICY IF EXISTS "salary_advances_write" ON public.salary_advances;
CREATE POLICY "salary_advances_write" ON public.salary_advances
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "pos_terminals_select" ON public.pos_terminals;
CREATE POLICY "pos_terminals_select" ON public.pos_terminals
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "pos_terminals_insert" ON public.pos_terminals;
CREATE POLICY "pos_terminals_insert" ON public.pos_terminals
  FOR INSERT WITH CHECK (
    public.is_staff() AND NOT public.is_kitchen()
    AND disabled = false AND locked = false
  );

DROP POLICY IF EXISTS "pos_terminals_update" ON public.pos_terminals;
CREATE POLICY "pos_terminals_update" ON public.pos_terminals
  FOR UPDATE USING (public.is_staff() AND NOT public.is_kitchen())
  WITH CHECK (public.is_staff() AND NOT public.is_kitchen());

DROP POLICY IF EXISTS "pos_terminals_delete" ON public.pos_terminals;
CREATE POLICY "pos_terminals_delete" ON public.pos_terminals
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "register_sessions_all" ON public.register_sessions;
CREATE POLICY "register_sessions_all" ON public.register_sessions
  FOR ALL USING (public.is_staff() AND NOT public.is_kitchen())
  WITH CHECK (public.is_staff() AND NOT public.is_kitchen());

-- =============================================================================
-- 10. Branches, System, Settings, Support, Notifications, Reviews, Releases
-- =============================================================================
DROP POLICY IF EXISTS "branches_select" ON public.branches;
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT USING (public.is_signed_in());

DROP POLICY IF EXISTS "branches_insert" ON public.branches;
CREATE POLICY "branches_insert" ON public.branches
  FOR INSERT WITH CHECK (public.is_super_admin() AND business_id = 'urban-address');

DROP POLICY IF EXISTS "branches_update" ON public.branches;
CREATE POLICY "branches_update" ON public.branches
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin() AND business_id = 'urban-address');

DROP POLICY IF EXISTS "system_config_select" ON public.system_config;
CREATE POLICY "system_config_select" ON public.system_config
  FOR SELECT USING (
    public.is_super_admin()
    OR (public.is_signed_in() AND id = 'permissions')
    OR id = 'config'
  );

DROP POLICY IF EXISTS "system_config_write" ON public.system_config;
CREATE POLICY "system_config_write" ON public.system_config
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "settings_select" ON public.settings;
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "settings_write" ON public.settings;
CREATE POLICY "settings_write" ON public.settings
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "support_queries_insert" ON public.support_queries;
CREATE POLICY "support_queries_insert" ON public.support_queries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "support_queries_admin" ON public.support_queries;
CREATE POLICY "support_queries_admin" ON public.support_queries
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "account_deletion_insert" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_insert" ON public.account_deletion_requests
  FOR INSERT WITH CHECK (
    public.is_signed_in()
    AND public.owns_user(user_id)
    AND status = 'PENDING'
    AND source = 'CUSTOMER_PROFILE'
  );

DROP POLICY IF EXISTS "account_deletion_select" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_select" ON public.account_deletion_requests
  FOR SELECT USING (
    public.is_admin()
    OR (public.is_signed_in() AND public.owns_user(user_id))
  );

DROP POLICY IF EXISTS "account_deletion_update" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_update" ON public.account_deletion_requests
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (
    public.is_signed_in() AND (public.owns_user(user_id) OR public.is_admin())
  );

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    public.is_signed_in()
    AND (public.owns_user(user_id) OR public.is_admin())
    AND read = false
  );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (
    public.is_signed_in() AND (public.owns_user(user_id) OR public.is_admin())
  )
  WITH CHECK (
    public.is_signed_in() AND (public.owns_user(user_id) OR public.is_admin())
  );

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert" ON public.reviews
  FOR INSERT WITH CHECK (public.is_signed_in() AND public.owns_user(user_id));

DROP POLICY IF EXISTS "reviews_update" ON public.reviews;
CREATE POLICY "reviews_update" ON public.reviews
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reviews_delete" ON public.reviews;
CREATE POLICY "reviews_delete" ON public.reviews
  FOR DELETE USING (
    public.is_admin()
    OR (public.is_signed_in() AND public.owns_user(user_id))
  );

DROP POLICY IF EXISTS "app_releases_select" ON public.app_releases;
CREATE POLICY "app_releases_select" ON public.app_releases
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_releases_write" ON public.app_releases;
CREATE POLICY "app_releases_write" ON public.app_releases
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- 11. Live Audio Sessions & WebRTC Candidates
-- =============================================================================
DROP POLICY IF EXISTS "live_audio_sessions_insert" ON public.live_audio_sessions;
CREATE POLICY "live_audio_sessions_insert" ON public.live_audio_sessions
  FOR INSERT WITH CHECK (
    public.is_audio_admin()
    AND public.owns_user(requested_by)
    AND status = 'REQUESTED'
  );

DROP POLICY IF EXISTS "live_audio_sessions_select" ON public.live_audio_sessions;
CREATE POLICY "live_audio_sessions_select" ON public.live_audio_sessions
  FOR SELECT USING (
    public.is_audio_admin()
    OR (public.is_signed_in() AND public.owns_user(cashier_id))
  );

DROP POLICY IF EXISTS "live_audio_sessions_update" ON public.live_audio_sessions;
CREATE POLICY "live_audio_sessions_update" ON public.live_audio_sessions
  FOR UPDATE USING (
    public.is_audio_admin()
    OR (public.is_signed_in() AND public.owns_user(cashier_id))
  )
  WITH CHECK (
    public.is_audio_admin()
    OR (
      public.is_signed_in()
      AND public.owns_user(cashier_id)
      AND status IN ('ACCEPTED', 'DECLINED', 'ENDED')
    )
  );

DROP POLICY IF EXISTS "live_audio_candidates_select" ON public.live_audio_candidates;
CREATE POLICY "live_audio_candidates_select" ON public.live_audio_candidates
  FOR SELECT USING (
    (sender_role = 'STAFF' AND public.is_audio_admin())
    OR (
      sender_role = 'ADMIN'
      AND public.is_signed_in()
      AND EXISTS (
        SELECT 1 FROM public.live_audio_sessions s
        WHERE s.id = live_audio_candidates.session_id
          AND public.owns_user(s.cashier_id)
      )
    )
    OR public.is_audio_admin()
  );

DROP POLICY IF EXISTS "live_audio_candidates_insert" ON public.live_audio_candidates;
CREATE POLICY "live_audio_candidates_insert" ON public.live_audio_candidates
  FOR INSERT WITH CHECK (
    (
      sender_role = 'STAFF'
      AND public.is_signed_in()
      AND EXISTS (
        SELECT 1 FROM public.live_audio_sessions s
        WHERE s.id = live_audio_candidates.session_id
          AND public.owns_user(s.cashier_id)
          AND s.status = 'ACCEPTED'
      )
    )
    OR (
      sender_role = 'ADMIN'
      AND public.is_audio_admin()
      AND EXISTS (
        SELECT 1 FROM public.live_audio_sessions s
        WHERE s.id = live_audio_candidates.session_id
          AND s.status = 'ACCEPTED'
      )
    )
  );

-- Note: All 30 Server-Only tables (terminal_devices, terminal_device_staff,
-- terminal_pin_attempts, terminal_pin_reset_otps, terminal_sessions,
-- email_verification_otps, admin_daily_otps, email_rate_limits, email_preferences,
-- email_outbox, email_campaigns, email_messages, email_replies, resend_webhook_events,
-- privacy_consent, maps_geocode_cache, loyalty_reconciliations, refund_requests,
-- stock_adjustment_requests, staff_navigation_state, staff_navigation_logs,
-- system_audit_logs, telegram_*) have RLS enabled and ZERO client policies,
-- restricting all access exclusively to the server-side SUPABASE_SERVICE_ROLE_KEY.

COMMIT;
