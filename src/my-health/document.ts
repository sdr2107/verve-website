/**
 * MyHealthDocument — everything the My health page needs for one person,
 * in one object, from one round trip: the SQL function my_health_document
 * (METTracker/supabase/migrations/20261009_my_health_document.sql).
 *
 * This file owns the shape. The function mirrors it; tools/check-document.mjs
 * asserts the live function against DOCUMENT_KEYS for the reviewer account.
 * A key is always present: an empty list is [], an absent object is null.
 * Row-level security decides the content, so a viewer without the heart
 * scope receives signals: [] and the page reads that as "not shared".
 */

export interface DocPerson { id: string; owner_id: string; account_id: string | null; name: string; born_year: number | null; created_at?: string }
export interface DocGrantToMe { id: string; person_id: string; scopes: string[] }
export interface DocProfile { name?: string | null; weekly_met_hours_goal: number | null; height_cm: number | null; sex: string | null; age: number | null }
export interface DocFile { id: string; name: string; created_at: string; updated_at: string; metadata: Record<string, unknown> | null }
export interface DocSharing { id: string; viewer_email: string; viewer_id: string | null; scopes: string[]; status: string; invited_at: string; accepted_at: string | null; last_viewed_at: string | null }

export interface MyHealthDocument {
  generated_at: string;
  me: { id: string; email: string; profile: DocProfile | null; role: "coach" | "clinician" | null };
  people: DocPerson[];
  grants_to_me: DocGrantToMe[];
  person: DocPerson | null;
  labs: any[];
  imaging: any[];
  reports: any[];
  files: DocFile[];
  weeks: any[];
  web_crf: any[];
  web_body: any[];
  app_labs: any[];
  activities: any[];
  app_crf: any[];
  waist: any[];
  profile: DocProfile | null;
  signals: any[];
  weights: any[];
  note: string | null;
  sharing: DocSharing[];
  sharing_pros: { email: string; role: string | null; title: string | null }[];
  invites: any[];
  asked: any[];
  requests: any[];
  ai: { summary: { summary: string; created_at: string; model: string | null } | null; consent: string | null };
}

/** Every key, with its kind: "list" must be an array, "object" an object or null, "string" a string. */
export const DOCUMENT_KEYS: Record<keyof MyHealthDocument, "list" | "object" | "string"> = {
  generated_at: "string", me: "object", people: "list", grants_to_me: "list", person: "object",
  labs: "list", imaging: "list", reports: "list", files: "list",
  weeks: "list", web_crf: "list", web_body: "list",
  app_labs: "list", activities: "list", app_crf: "list", waist: "list", profile: "object", signals: "list", weights: "list",
  note: "object", sharing: "list", sharing_pros: "list", invites: "list", asked: "list", requests: "list", ai: "object",
};
