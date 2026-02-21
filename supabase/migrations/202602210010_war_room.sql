-- S6: War Room — decisions + notifications
-- Applied to Supabase 2026-02-21

CREATE TABLE IF NOT EXISTS dd_war_room_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  contingency_id UUID REFERENCES dd_contingencies(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES dd_negotiation_alerts(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('accept_risk','mitigate','transfer','reject','defer','escalate')),
  title TEXT NOT NULL,
  rationale TEXT,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ DEFAULT now(),
  client_visible BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wr_decisions_project ON dd_war_room_decisions(project_id);
CREATE INDEX idx_wr_decisions_type ON dd_war_room_decisions(decision_type);

CREATE TABLE IF NOT EXISTS dd_war_room_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES dd_projects(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('severity_change','new_blocker','request_overdue','decision_required','red_flag_new')),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
  source_type TEXT,
  source_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_by UUID REFERENCES auth.users(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wr_notif_project ON dd_war_room_notifications(project_id);
CREATE INDEX idx_wr_notif_unread ON dd_war_room_notifications(project_id, is_read) WHERE NOT is_read;

ALTER TABLE dd_war_room_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_war_room_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_wr_decisions" ON dd_war_room_decisions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_wr_notif" ON dd_war_room_notifications FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "select_wr_decisions" ON dd_war_room_decisions FOR SELECT USING (public.user_has_project_role(project_id));
CREATE POLICY "insert_wr_decisions" ON dd_war_room_decisions FOR INSERT WITH CHECK (public.user_has_permission(project_id, 'manage_contingencies'));
CREATE POLICY "select_wr_notif" ON dd_war_room_notifications FOR SELECT USING (public.user_has_project_role(project_id));
CREATE POLICY "update_wr_notif" ON dd_war_room_notifications FOR UPDATE USING (public.user_has_project_role(project_id));
