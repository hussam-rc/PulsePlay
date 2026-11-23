// Typed wrappers for the workspace API. Every call runs as the signed-in user; the database enforces who may do what.
import { useEffect, useState } from 'react';
import { rpc, callFunction } from './controllers';
import { currentSession, onAuthChange, AuthSession } from './auth';
import { validateExperience, Experience } from '../engine/schema';

export type Role = 'owner' | 'admin' | 'creator' | 'facilitator';
export interface Me { userId: string; email: string; displayName: string | null; orgs: { id: string; name: string; role: Role }[] }
export interface LibraryItem { id: string; title: string; status: string; visibility: string; orgId: string | null; mine: boolean; updatedAt: string; latestVersion: number | null }
export interface ServerExperience { id: string; title: string; status: string; visibility: string; orgId: string | null; draft: unknown; canEdit: boolean; canPublish: boolean; versions: { version: number; publishedAt: string }[] }
export interface Member { userId: string; role: Role; name: string | null; email: string | null }
export interface SessionSummary { title: string; joined: number; completed: number; average: number | null; startedAt: string; endedAt: string }

const call = async <T,>(fn: string, args: Record<string, unknown> = {}) => (await rpc<T>(fn, args)).data;

export const api = {
  me: () => call<Me | null>('pp_me'),
  acceptInvites: () => call<number>('pp_accept_invites'),
  createOrg: (name: string) => call<{ id: string }>('pp_create_org', { p_name: name }),
  members: (org: string) => call<{ members: Member[]; invites: { email: string; role: Role; at: string }[] | null }>('pp_members', { p_org: org }),
  invite: (org: string, email: string, role: Role) => call<void>('pp_invite', { p_org: org, p_email: email, p_role: role }),
  setRole: (org: string, user: string, role: Role) => call<void>('pp_set_role', { p_org: org, p_user: user, p_role: role }),
  removeMember: (org: string, user: string) => call<void>('pp_remove_member', { p_org: org, p_user: user }),
  library: (org: string | null) => call<LibraryItem[]>('pp_library', { p_org: org }),
  copyTemplate: (slug: string, org: string | null) => call<{ id: string }>('pp_copy_template', { p_slug: slug, p_org: org }),
  published: (id: string) => call<{ version: number; content: unknown } | null>('pp_get_published', { p_id: id }),
  get: (id: string) => call<ServerExperience | null>('pp_get_experience', { p_id: id }),
  saveDraft: (id: string | null, org: string | null, title: string, draft: unknown) => call<{ id: string }>('pp_save_draft', { p_id: id, p_org: org, p_title: title, p_draft: draft }),
  sessions: (org: string | null) => call<SessionSummary[]>('pp_my_sessions', { p_org: org }),
  publish: (id: string, visibility: 'private' | 'org' | 'unlisted') => callFunction<{ ok: true; version: number; warnings: string[] }>('publish', { experienceId: id, visibility }),
};

export function useAuth(): AuthSession | null {
  const [s, setS] = useState(currentSession());
  useEffect(() => onAuthChange(() => setS(currentSession())), []);
  return s;
}

export const ROLE_INFO: Record<Role, string> = {
  owner: 'Everything, including roles of admins and owners',
  admin: 'Members, invites, publishing and all experiences',
  creator: 'Create, edit and publish experiences; host',
  facilitator: 'Host published experiences and see insights',
};

/** A server experience as an engine Experience (for host settings and practice preview), or the validation errors. */
export function asExperience(x: ServerExperience): { e?: Experience; errors: string[] } {
  const v = validateExperience({ ...(x.draft as object), status: 'published' });
  return v.ok ? { e: v.experience!, errors: [] } : { errors: v.errors };
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
