"""Collaboration and Workspace management router: multi-tenancy, RBAC, invitations, and activity feed."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user
from strata_api.routers.datasets import _datasets_db, check_dataset_access, find_dataset_by_name_or_id
from strata_api.core.persistence import (
    save_workspace_to_db,
    save_workspace_member_to_db,
    save_invitation_to_db,
    save_dataset_permission_to_db,
    save_activity_log_to_db,
    save_dataset_comment_to_db,
    save_review_request_to_db,
    save_dataset_to_db,
)

router = APIRouter(prefix="/workspaces", tags=["Collaboration"])


# In-memory storage for workspaces, members, invitations, permission overrides, and activity logs
_workspaces_db: Dict[str, Dict[str, Any]] = {
    "ws_primary": {
        "id": "ws_primary",
        "name": "My Workspace",
        "slug": "my-workspace",
        "description": "Primary workspace for dataset engineering and analytics.",
        "plan": "Pro Team",
        "created_at": "2026-09-01T10:00:00Z",
        "owner_id": "user_owner",
    },
}

_members_db: Dict[str, List[Dict[str, Any]]] = {
    "ws_primary": [
        {
            "id": "mem_1",
            "user_id": "user_owner",
            "name": "Workspace Owner",
            "email": "owner@strata.ai",
            "role": "Owner",
            "joined_at": "2026-09-01T10:00:00Z",
            "avatar": "WO",
        },
    ],
}

_invitations_db: Dict[str, List[Dict[str, Any]]] = {}
_dataset_permissions_db: Dict[str, Dict[str, str]] = {}
_activity_feed_db: List[Dict[str, Any]] = []


def check_workspace_access(workspace_id: str, user_id: str, user_email: Optional[str] = None) -> Dict[str, Any]:
    """Verify that user has access to this workspace."""
    ws = _workspaces_db.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    members = _members_db.get(workspace_id, [])
    is_owner = ws.get("owner_id") == user_id
    is_member = any(m.get("user_id") == user_id or (user_email and m.get("email") == user_email) for m in members)
    if not (is_owner or is_member):
        if ws.get("owner_id") and ws["owner_id"] not in ("user_owner", None):
            raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this workspace.")
    return ws


def log_activity(
    workspace_id: str,
    actor_name: str,
    action: str,
    details: str,
    dataset_name: Optional[str] = None,
    badge_color: str = "blue",
):
    """Log an event into the immutable activity feed."""
    entry = {
        "id": f"act_{len(_activity_feed_db) + 1}",
        "workspace_id": workspace_id,
        "dataset_name": dataset_name or "General",
        "actor_name": actor_name,
        "action": action,
        "details": details,
        "timestamp": "Just now",
        "badge_color": badge_color,
    }
    _activity_feed_db.insert(0, entry)
    save_activity_log_to_db(entry)


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
async def list_workspaces(current_user: UserModel = Depends(get_current_user)):
    """List all available workspaces for current user."""
    workspaces = []
    for ws_id, ws in _workspaces_db.items():
        members = _members_db.get(ws_id, [])
        is_owner = ws.get("owner_id") == current_user.id
        is_member = any(m.get("user_id") == current_user.id or m.get("email") == current_user.email for m in members)
        if is_owner or is_member or ws.get("owner_id") in ("user_owner", None):
            workspaces.append(ws)
    return workspaces


@router.post("")
async def create_workspace(
    req: CreateWorkspaceRequest,
    current_user: UserModel = Depends(get_current_user),
):
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
        "owner_id": current_user.id,
    }
    _workspaces_db[ws_id] = ws
    member_record = {
        "id": f"mem_{uuid.uuid4().hex[:6]}",
        "user_id": current_user.id,
        "name": current_user.full_name,
        "email": current_user.email,
        "role": "Owner",
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "avatar": current_user.full_name[:2].upper() if current_user.full_name else "US",
    }
    _members_db[ws_id] = [member_record]
    save_workspace_to_db(ws)
    save_workspace_member_to_db(member_record, ws_id)
    log_activity(ws_id, current_user.full_name, "workspace_created", f"Created workspace '{req.name}'")
    return ws


@router.get("/{workspace_id}/members")
async def list_members(workspace_id: str, current_user: UserModel = Depends(get_current_user)):
    """List all members and invitations for a workspace."""
    check_workspace_access(workspace_id, current_user.id, current_user.email)
    members = _members_db.get(workspace_id, [])
    invites = _invitations_db.get(workspace_id, [])
    return {"members": members, "pending_invites": invites}


@router.post("/{workspace_id}/invites")
async def invite_member(
    workspace_id: str,
    req: InviteMemberRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Send an invitation email or generate magic invite link with specified role."""
    check_workspace_access(workspace_id, current_user.id, current_user.email)
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
    save_invitation_to_db(invite, workspace_id)
    log_activity(workspace_id, current_user.full_name, "invite", f"Invited {req.email} as {req.role}", badge_color="purple")
    return {"message": f"Invitation sent to {req.email}", "invitation": invite}


@router.delete("/{workspace_id}/members/{member_id}")
async def remove_member(workspace_id: str, member_id: str, current_user: UserModel = Depends(get_current_user)):
    """Remove a member from the workspace."""
    check_workspace_access(workspace_id, current_user.id, current_user.email)
    members = _members_db.get(workspace_id, [])
    for m in list(members):
        if m["id"] == member_id:
            if m["role"] == "Owner":
                raise HTTPException(status_code=400, detail="Cannot remove workspace Owner")
            members.remove(m)
            log_activity(workspace_id, current_user.full_name, "remove_member", f"Removed member {m['name']}", badge_color="rose")
            return {"message": "Member removed"}
    raise HTTPException(status_code=404, detail="Member not found")


@router.put("/{workspace_id}/members/{member_id}/role")
async def update_member_role(
    workspace_id: str,
    member_id: str,
    req: UpdateRoleRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Change member role in workspace (Admin, Editor, Analyst, Viewer)."""
    check_workspace_access(workspace_id, current_user.id, current_user.email)
    members = _members_db.get(workspace_id, [])
    for m in members:
        if m["id"] == member_id:
            if m["role"] == "Owner":
                raise HTTPException(status_code=400, detail="Cannot modify Owner role")
            m["role"] = req.role
            save_workspace_member_to_db(m, workspace_id)
            log_activity(workspace_id, current_user.full_name, "role_update", f"Updated {m['name']} to {req.role}")
            return {"message": f"Role updated to {req.role}", "member": m}
    raise HTTPException(status_code=404, detail="Member not found")


@router.get("/{workspace_id}/activity")
async def get_workspace_activity(workspace_id: str, current_user: UserModel = Depends(get_current_user)):
    """Retrieve audit activity feed for workspace."""
    if workspace_id != "all":
        check_workspace_access(workspace_id, current_user.id, current_user.email)
    feed = [a for a in _activity_feed_db if a["workspace_id"] == workspace_id or workspace_id == "all"]
    return feed


@router.get("/{workspace_id}/permissions")
async def get_dataset_permissions(workspace_id: str, current_user: UserModel = Depends(get_current_user)):
    """Retrieve dataset permission overrides."""
    check_workspace_access(workspace_id, current_user.id, current_user.email)
    return _dataset_permissions_db.get(workspace_id, {})


@router.put("/{workspace_id}/permissions")
async def set_dataset_permission(
    workspace_id: str,
    req: UpdateDatasetPermissionRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Override min role required to modify a dataset in this workspace."""
    check_workspace_access(workspace_id, current_user.id, current_user.email)
    ds = find_dataset_by_name_or_id(req.dataset_id)
    if ds:
        check_dataset_access(ds, current_user.id)
    overrides = _dataset_permissions_db.setdefault(workspace_id, {})
    overrides[req.dataset_id] = req.min_role
    save_dataset_permission_to_db(workspace_id, req.dataset_id, req.min_role)
    log_activity(workspace_id, current_user.full_name, "permission_override", f"Set {req.dataset_id} minimum role to {req.min_role}")
    return {"message": f"Permission updated for {req.dataset_id}", "permissions": overrides}


# ---------------------------------------------------------------------------
# Advanced Collaboration: Cell/Row Comments & Review Approvals (Pillars 9.6, 9.7, 9.10)
# ---------------------------------------------------------------------------

_dataset_comments_db: Dict[str, List[Dict[str, Any]]] = {}
_review_requests_db: List[Dict[str, Any]] = []


class DatasetCommentRequest(BaseModel):
    row_index: Optional[int] = None
    column_name: Optional[str] = None
    comment: str
    author_name: str = "James Uchechi"
    author_role: str = "Owner"


class CreateReviewRequest(BaseModel):
    dataset_name: str
    source_branch: str
    target_branch: str = "main"
    title: str
    author: str = "James Uchechi"


class AssetTransferRequest(BaseModel):
    dataset_id: str
    from_workspace_id: str
    to_workspace_id: str
    new_owner_email: Optional[str] = None


@router.get("/comments/{dataset_id}")
async def get_dataset_comments(dataset_id: str, current_user: UserModel = Depends(get_current_user)):
    """List cell and row comments on a dataset (Pillar 9.6)."""
    ds = find_dataset_by_name_or_id(dataset_id)
    if ds:
        check_dataset_access(ds, current_user.id)
    return {"comments": _dataset_comments_db.get(dataset_id, [])}


@router.post("/comments/{dataset_id}")
async def add_dataset_comment(
    dataset_id: str,
    req: DatasetCommentRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Add cell-level or row-level comment (Pillar 9.6)."""
    ds = find_dataset_by_name_or_id(dataset_id)
    if ds:
        check_dataset_access(ds, current_user.id)
    comment_id = f"comment_{uuid.uuid4().hex[:8]}"
    item = {
        "id": comment_id,
        "dataset_id": dataset_id,
        "row_index": req.row_index,
        "column_name": req.column_name,
        "author_name": req.author_name or current_user.full_name,
        "author_role": req.author_role,
        "comment": req.comment,
        "resolved": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _dataset_comments_db.setdefault(dataset_id, []).append(item)
    save_dataset_comment_to_db(item)
    return {"status": "created", "comment": item}


@router.post("/comments/{dataset_id}/{comment_id}/resolve")
async def resolve_dataset_comment(
    dataset_id: str,
    comment_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Mark a cell/row comment thread as resolved (Pillar 9.6)."""
    ds = find_dataset_by_name_or_id(dataset_id)
    if ds:
        check_dataset_access(ds, current_user.id)
    comments = _dataset_comments_db.get(dataset_id, [])
    for c in comments:
        if c["id"] == comment_id:
            c["resolved"] = True
            save_dataset_comment_to_db(c)
            return {"status": "resolved", "comment": c}
    raise HTTPException(status_code=404, detail="Comment not found")


@router.get("/reviews")
async def list_review_requests(
    dataset_name: Optional[str] = None,
    current_user: UserModel = Depends(get_current_user),
):
    """List branch merge and dataset release review requests (Pillar 9.7)."""
    if dataset_name:
        ds = find_dataset_by_name_or_id(dataset_name)
        if ds:
            check_dataset_access(ds, current_user.id)
    reviews = list(_review_requests_db)
    if dataset_name:
        reviews = [r for r in reviews if r["dataset_name"] == dataset_name]
    return {"reviews": reviews, "total": len(reviews)}


@router.post("/reviews")
async def create_review_request(
    req: CreateReviewRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Open a dataset version review / pull request before merging (Pillar 9.7)."""
    ds = find_dataset_by_name_or_id(req.dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    rev_id = f"rev_{uuid.uuid4().hex[:8]}"
    rev = {
        "id": rev_id,
        "dataset_name": req.dataset_name,
        "source_branch": req.source_branch,
        "target_branch": req.target_branch,
        "title": req.title,
        "author": req.author or current_user.full_name,
        "status": "pending_review",
        "approvals": [],
        "min_approvals_required": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _review_requests_db.append(rev)
    save_review_request_to_db(rev)
    return {"status": "created", "review": rev}


@router.post("/reviews/{review_id}/approve")
async def approve_review_request(
    review_id: str,
    approver_name: str = "James Uchechi",
    current_user: UserModel = Depends(get_current_user),
):
    """Approve a dataset version pull request (Pillar 9.7)."""
    rev = next((r for r in _review_requests_db if r["id"] == review_id), None)
    if not rev:
        raise HTTPException(status_code=404, detail="Review request not found")

    ds = find_dataset_by_name_or_id(rev["dataset_name"])
    if ds:
        check_dataset_access(ds, current_user.id)

    name = approver_name or current_user.full_name
    if name not in rev["approvals"]:
        rev["approvals"].append(name)
    if len(rev["approvals"]) >= rev["min_approvals_required"]:
        rev["status"] = "approved"

    save_review_request_to_db(rev)
    return {"status": "approved", "review": rev}


@router.post("/transfer-asset")
async def transfer_workspace_asset(
    req: AssetTransferRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Transfer dataset ownership from one workspace to another (Pillar 9.10)."""
    from strata_api.routers.datasets import _datasets_db
    dataset = _datasets_db.get(req.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    check_dataset_access(dataset, current_user.id)
    from_ws = check_workspace_access(req.from_workspace_id, current_user.id, current_user.email)
    to_ws = check_workspace_access(req.to_workspace_id, current_user.id, current_user.email)

    dataset["workspace_id"] = req.to_workspace_id
    if req.new_owner_email:
        dataset["owner"] = req.new_owner_email
    save_dataset_to_db(dataset)

    log_activity(
        req.to_workspace_id,
        current_user.full_name,
        "asset_transfer",
        f"Transferred '{dataset['name']}' from '{from_ws['name']}' to '{to_ws['name']}'",
        badge_color="indigo",
    )

    return {
        "status": "transferred",
        "dataset_id": req.dataset_id,
        "from_workspace": from_ws["name"],
        "to_workspace": to_ws["name"],
    }

