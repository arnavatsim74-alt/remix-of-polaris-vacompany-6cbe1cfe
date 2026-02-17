import { supabase } from "@/integrations/supabase/client";

interface NotificationPayload {
  recipientPilotId: string;
  title: string;
  message: string;
  type: string;
  relatedEntity?: string;
  relatedId?: string;
}

export async function sendNotification(payload: NotificationPayload) {
  const { error } = await supabase.from("notifications").insert({
    recipient_pilot_id: payload.recipientPilotId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    related_entity: payload.relatedEntity || null,
    related_id: payload.relatedId || null,
  } as any);

  if (error) throw error;
}

export async function notifyAdmins(title: string, message: string, type = "admin_alert", relatedEntity?: string, relatedId?: string) {
  const { data: adminRoles, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  if (error) throw error;
  if (!adminRoles?.length) return;

  const adminUserIds = adminRoles.map((r) => r.user_id);
  const { data: adminPilots } = await supabase.from("pilots").select("id").in("user_id", adminUserIds);
  if (!adminPilots?.length) return;

  const rows = adminPilots.map((p) => ({
    recipient_pilot_id: p.id,
    title,
    message,
    type,
    related_entity: relatedEntity || null,
    related_id: relatedId || null,
  }));

  await supabase.from("notifications").insert(rows as any);
}
