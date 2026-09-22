"""Collaboration and Workspace management router: multi-tenancy, RBAC, invitations, and activity feed."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/workspaces", tags=["Collaboration"])

# In-memory storage for workspaces, members, invitations, permission overrides, and activity logs
_workspaces_db: Dict[str, Dict[str, Any]] = {
    "ws_default": {
        "id": "ws_default",
        "name": "Acme Data Science Lab",
        "slug": "acme-ds-lab",
        "description": "Production workspace for enterprise customer churn models and financial analytics.",
        "plan": "Pro Team",
        "created_at": "2026-08-01T10:00:00Z",
        "owner_id": "user_james",
    },
    "ws_sandbox": {
        "id": "ws_sandbox",
        "name": "Personal Sandbox",
        "slug": "personal-sandbox",
        "description": "Private staging environment for ad-hoc exploration and AutoML benchmarking.",
        "plan": "Community Free",
        "created_at": "2026-08-15T14:30:00Z",
        "owner_id": "user_james",
    },
}

_members_db: Dict[str, List[Dict[str, Any]]] = {
    "ws_default": [
        {
            "id": "mem_1",
            "user_id": "user_james",
            "name": "James Uchechi",
            "email": "james@company.com",
            "role": "Owner",
            "joined_at": "2026-08-01T10:00:00Z",
            "avatar": "JU",
        },
        {
            "id": "mem_2",
            "user_id": "user_sarah",
            "name": "Dr. Sarah Chen",
            "email": "sarah.chen@company.com",
            "role": "Admin",
            "joined_at": "2026-08-05T11:20:00Z",
            "avatar": "SC",
        },
        {
            "id": "mem_3",
            "user_id": "user_marcus",
            "name": "Marcus Vance",
            "email": "m.vance@company.com",
            "role": "Editor",
            "joined_at": "2026-08-12T09:15:00Z",
            "avatar": "MV",
        },
        {
            "id": "mem_4",
            "user_id": "user_elena",
            "name": "Elena Rostova",
            "email": "elena.r@company.com",
            "role": "Analyst",
            "joined_at": "2026-08-20T16:45:00Z",
            "avatar": "ER",
        },
        {
            "id": "mem_5",
            "user_id": "user_alex",
            "name": "Alex Mercer",
            "email": "alex.m@partner.org",
            "role": "Viewer",
            "joined_at": "2026-09-01T13:10:00Z",
            "avatar": "AM",
        },
    ],
    "ws_sandbox": [
        {
            "id": "mem_s1",
            "user_id": "user_james",
            "name": "James Uchechi",
            "email": "james@company.com",
            "role": "Owner",
            "joined_at": "2026-08-15T14:30:00Z",
            "avatar": "JU",
        },
    ],
}

_invitations_db: Dict[str, List[Dict[str, Any]]] = {
    "ws_default": [
        {
            "id": "inv_1",
            "email": "r.feynman@institute.edu",
            "role": "Analyst",
            "invite_token": "inv_sec_89234f9a",
            "created_at": "2026-09-20T09:30:00Z",
            "status": "pending",
        }
    ]
}

_dataset_permissions_db: Dict[str, Dict[str, str]] = {
    "ws_default": {
        "churn_demo": "Editor",
        "finance_demo": "Admin",
        "genomic_demo": "Viewer",
    }
}

_activity_feed_db: List[Dict[str, Any]] = [
    {
        "id": "act_1",
        "workspace_id": "ws_default",
        "dataset_name": "customer_churn.csv",
        "actor_name": "James Uchechi",
        "action": "commit",
        "details": "Committed version v1.2.0: Cleaned outliers & imputed missing tenure",
        "timestamp": "10 minutes ago",
        "badge_color": "emerald",
    },
    {
        "id": "act_2",
        "workspace_id": "ws_default",
        "dataset_name": "financial_projections.xlsx",
        "actor_name": "Dr. Sarah Chen",
        "action": "tag",
        "details": "Tagged version hash 7f3b89a as 'prod-release'",
        "timestamp": "45 minutes ago",
        "badge_color": "blue",
    },
    {
        "id": "act_3",
        "workspace_id": "ws_default",
        "dataset_name": "customer_churn.csv",
        "actor_name": "Marcus Vance",
        "action": "automl",
        "details": "Trained LightGBM Classifier (AUC: 0.941) with SHAP explanations",
        "timestamp": "2 hours ago",
        "badge_color": "purple",
    },
    {
        "id": "act_4",
        "workspace_id": "ws_default",
        "dataset_name": "genomic_variants.parquet",
        "actor_name": "Elena Rostova",
        "action": "ingest",
        "details": "Ingested 20,400 variant loci with clinical significance annotations",
        "timestamp": "1 day ago",
        "badge_color": "amber",
    },
]


def log_activity(
    workspace_id: str,
    actor_name: str,
    action: str,
    details: str,
    dataset_name: Optional[str] = None,
    badge_color: str = "blue",
):
    """Log an event into the immutable activity feed."""
    _activity_feed_db.insert(0, {
        "id": f"act_{len(_activity_feed_db) + 1}",
        "workspace_id": workspace_id,
        "dataset_name": dataset_name or "General",
        "actor_name": actor_name,
        "action": action,
        "details": details,
        "timestamp": "Just now",
        "badge_color": badge_color,
    })


# Models
class CreateWorkspaceRequest(BaseModel):
    name: str
    description: Optional[str] = None


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "Analyst"  # "Admin", "Editor", "Analyst", "Viewer"


class UpdateDatasetPermissionRequest(BaseModel):
    dataset_id: str
    min_role: str  # "Viewer", "Analyst", "Editor", "Admin"


class UpdateRoleRequest(BaseModel):
    role: str


# Endpoints
@router.get("")
async def list_workspaces():
    """List all available workspaces for current user."""
    return list(_workspaces_db.values())


@router.post("")
async def create_workspace(req: CreateWorkspaceRequest):
    """Create a new team workspace."""
    ws_id = f"ws_{uuid.uuid4().hex[:8]}"
    slug = req.name.lower().replace(" ", "-")
    ws = {
        "id": ws_id,
        "name": req.name,
        "slug": slug,
        "description": req.description or "",
        "plan": "Community Free",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "owner_id": "user_james",
    }
    _workspaces_db[ws_id] = ws
    _members_db[ws_id] = [
        {
            "id": f"mem_{uuid.uuid4().hex[:6]}",
            "user_id": "user_james",
            "name": "James Uchechi",
            "email": "james@company.com",
            "role": "Owner",
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "avatar": "JU",
        }
    ]
    log_activity(ws_id, "James Uchechi", "workspace_created", f"Created workspace '{req.name}'")
    return ws


@router.get("/{workspace_id}/members")
async def list_members(workspace_id: str):
    """List all members and invitations for a workspace."""
    members = _members_db.get(workspace_id, [])
    invites = _invitations_db.get(workspace_id, [])
    return {"members": members, "pending_invites": invites}


@router.post("/{workspace_id}/invites")
async def invite_member(workspace_id: str, req: InviteMemberRequest):
    """Send an invitation email or generate magic invite link with specified role."""
    valid_roles = {"Admin", "Editor", "Analyst", "Viewer"}
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {valid_roles}")

    invite = {
        "id": f"inv_{uuid.uuid4().hex[:6]}",
        "email": req.email,
        "role": req.role,
        "invite_token": f"inv_{uuid.uuid4().hex[:12]}",
        "invite_url": f"/join?token={uuid.uuid4().hex[:12]}&workspace={workspace_id}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    }
    _invitations_db.setdefault(workspace_id, []).append(invite)
    log_activity(workspace_id, "James Uchechi", "invite", f"Invited {req.email} as {req.role}", badge_color="purple")
    return {"message": f"Invitation sent to {req.email}", "invitation": invite}


@router.delete("/{workspace_id}/members/{member_id}")
async def remove_member(workspace_id: str, member_id: str):
    """Remove a member from the workspace."""
    members = _members_db.get(workspace_id, [])
    for m in list(members):
        if m["id"] == member_id:
            if m["role"] == "Owner":
                raise HTTPException(status_code=400, detail="Cannot remove workspace Owner")
            members.remove(m)
            log_activity(workspace_id, "James Uchechi", "remove_member", f"Removed member {m['name']}", badge_color="rose")
            return {"message": "Member removed"}
    raise HTTPException(status_code=404, detail="Member not found")


@router.put("/{workspace_id}/members/{member_id}/role")
async def update_member_role(workspace_id: str, member_id: str, req: UpdateRoleRequest):
    """Change member role in workspace (Admin, Editor, Analyst, Viewer)."""
    members = _members_db.get(workspace_id, [])
    for m in members:
        if m["id"] == member_id:
            if m["role"] == "Owner":
                raise HTTPException(status_code=400, detail="Cannot modify Owner role")
            m["role"] = req.role
            log_activity(workspace_id, "James Uchechi", "role_update", f"Updated {m['name']} to {req.role}")
            return {"message": f"Role updated to {req.role}", "member": m}
    raise HTTPException(status_code=404, detail="Member not found")


@router.get("/{workspace_id}/activity")
async def get_workspace_activity(workspace_id: str):
    """Retrieve audit activity feed for workspace."""
    feed = [a for a in _activity_feed_db if a["workspace_id"] == workspace_id or workspace_id == "all"]
    return feed


@router.get("/{workspace_id}/permissions")
async def get_dataset_permissions(workspace_id: str):
    """Retrieve dataset permission overrides."""
    return _dataset_permissions_db.get(workspace_id, {})


@router.put("/{workspace_id}/permissions")
async def set_dataset_permission(workspace_id: str, req: UpdateDatasetPermissionRequest):
    """Override min role required to modify a dataset in this workspace."""
    overrides = _dataset_permissions_db.setdefault(workspace_id, {})
    overrides[req.dataset_id] = req.min_role
    log_activity(workspace_id, "James Uchechi", "permission_override", f"Set {req.dataset_id} minimum role to {req.min_role}")
    return {"message": f"Permission updated for {req.dataset_id}", "permissions": overrides}
