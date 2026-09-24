"""Database persistence manager for Strata.

Provides synchronous and asynchronous database CRUD helpers to ensure all
datasets, commits, branches, audit logs, models, pipelines, workspaces, and
showcase items are persistently stored in Postgres / SQLite.
"""

import json
from typing import Any, Dict, List, Optional
from sqlalchemy import create_engine, select, delete
from sqlalchemy.orm import sessionmaker

from strata_api.config import settings
from strata_api.core.database import Base
from strata_api.models.dataset import DatasetModel, VersionModel, ShareLinkModel
from strata_api.models.security import AuditTrailModel
from strata_api.models.integration import WebhookConfigModel, IntegrationEventModel
from strata_api.models.collaboration import (
    WorkspaceModel,
    WorkspaceMemberModel,
    WorkspaceInvitationModel,
    DatasetPermissionModel,
    ActivityLogModel,
    DatasetCommentModel,
    ReviewRequestModel,
)
from strata_api.models.discovery import UserFavoriteModel, UserRecentModel
from strata_api.models.lineage import MLModelModel
from strata_api.models.pipeline import PipelineModel, PipelineRunModel, DeadLetterJobModel
from strata_api.models.versioning import CommitModel, BranchModel
from strata_api.models.showcase import ShowcaseItemModel, UserStarredShowcaseModel


def get_sync_db_url() -> str:
    url = settings.DATABASE_URL
    if "+aiosqlite" in url:
        return url.replace("+aiosqlite", "")
    if "+asyncpg" in url:
        return url.replace("+asyncpg", "")
    return url


# Thread-safe sync engine for persistence operations
_sync_engine = create_engine(get_sync_db_url(), echo=False)
SyncSessionLocal = sessionmaker(bind=_sync_engine, expire_on_commit=False)


def save_dataset_to_db(record: Dict[str, Any]) -> None:
    """Upsert dataset record into database."""
    with SyncSessionLocal() as session:
        existing = session.get(DatasetModel, record["id"])
        if existing:
            for k, v in record.items():
                if hasattr(existing, k) and k != "versions":
                    setattr(existing, k, v)
        else:
            model = DatasetModel(
                id=record["id"],
                owner_id=record.get("owner_id"),
                workspace_id=record.get("workspace_id"),
                name=record.get("name", "Untitled"),
                filename=record.get("filename", "data.csv"),
                file_path=record.get("file_path", ""),
                description=record.get("description"),
                tags=record.get("tags", []),
                format=record.get("format", "unknown"),
                content_hash=record.get("content_hash", ""),
                view_name=record.get("view_name", f"view_{record['id']}"),
                total_rows=record.get("total_rows", 0),
                total_columns=record.get("total_columns", 0),
                size_bytes=record.get("size_bytes", 0),
                created_at=str(record.get("created_at")),
                quality_score=float(record.get("quality_score", 90.0) or 90.0),
                latest_version=record.get("latest_version", "v1.0.0"),
                version_count=record.get("version_count", 1),
                schema_fields=record.get("schema_fields", []),
                preview_rows=record.get("preview_rows", []),
                sheets=record.get("sheets"),
                active_sheet=record.get("active_sheet"),
                column_stats=record.get("column_stats", []),
                pii_flags=record.get("pii_flags", {}),
                full_quality=record.get("full_quality"),
            )
            session.add(model)
        session.commit()


def delete_dataset_from_db(dataset_id: str) -> None:
    """Delete dataset record from database."""
    with SyncSessionLocal() as session:
        existing = session.get(DatasetModel, dataset_id)
        if existing:
            session.delete(existing)
            session.commit()


def save_share_link_to_db(token: str, dataset_id: str, created_at: str) -> None:
    """Save public share token to database."""
    with SyncSessionLocal() as session:
        existing = session.get(ShareLinkModel, token)
        if not existing:
            session.add(ShareLinkModel(token=token, dataset_id=dataset_id, created_at=created_at))
            session.commit()


def save_audit_event_to_db(event: Dict[str, Any]) -> None:
    """Save immutable audit log event to database."""
    with SyncSessionLocal() as session:
        existing = session.get(AuditTrailModel, event["id"])
        if not existing:
            session.add(AuditTrailModel(
                id=event["id"],
                actor=event["actor"],
                action=event["action"],
                target=event["target"],
                ip_address=event.get("ip_address", "127.0.0.1"),
                timestamp=event["timestamp"],
                details=event.get("details", {}),
                prev_hash=event["prev_hash"],
                hash=event["hash"],
            ))
            session.commit()


def save_webhook_config_to_db(config: Dict[str, Any]) -> None:
    """Upsert webhook config to database."""
    with SyncSessionLocal() as session:
        existing = session.get(WebhookConfigModel, config["id"])
        if existing:
            existing.service = config.get("service", existing.service)
            existing.name = config.get("name", existing.name)
            existing.url = config.get("url", existing.url)
            existing.events = config.get("events", existing.events)
            existing.is_active = config.get("is_active", existing.is_active)
        else:
            session.add(WebhookConfigModel(
                id=config["id"],
                service=config["service"],
                name=config["name"],
                url=config["url"],
                events=config.get("events", []),
                is_active=config.get("is_active", True),
            ))
        session.commit()


def save_integration_event_to_db(event: Dict[str, Any]) -> None:
    """Save integration event to database."""
    with SyncSessionLocal() as session:
        session.add(IntegrationEventModel(
            id=event["id"],
            webhook_id=event.get("webhook_id"),
            event_type=event["event_type"],
            payload=event.get("payload", {}),
            status=event.get("status", "delivered"),
            status_code=event.get("status_code", 200),
            response_body=event.get("response_body"),
            timestamp=event["timestamp"],
        ))
        session.commit()


def save_workspace_to_db(ws: Dict[str, Any]) -> None:
    """Upsert workspace to database."""
    with SyncSessionLocal() as session:
        existing = session.get(WorkspaceModel, ws["id"])
        if existing:
            existing.name = ws.get("name", existing.name)
            existing.slug = ws.get("slug", existing.slug)
            existing.description = ws.get("description", existing.description)
            existing.plan = ws.get("plan", existing.plan)
            existing.owner_id = ws.get("owner_id", existing.owner_id)
        else:
            session.add(WorkspaceModel(
                id=ws["id"],
                name=ws["name"],
                slug=ws["slug"],
                description=ws.get("description"),
                plan=ws.get("plan", "Pro Team"),
                created_at=ws.get("created_at", ""),
                owner_id=ws.get("owner_id"),
            ))
        session.commit()


def save_workspace_member_to_db(member: Dict[str, Any], workspace_id: str) -> None:
    """Upsert workspace member to database."""
    with SyncSessionLocal() as session:
        existing = session.get(WorkspaceMemberModel, member["id"])
        if existing:
            existing.role = member.get("role", existing.role)
        else:
            session.add(WorkspaceMemberModel(
                id=member["id"],
                workspace_id=workspace_id,
                user_id=member["user_id"],
                name=member["name"],
                email=member["email"],
                role=member.get("role", "Analyst"),
                joined_at=member.get("joined_at", ""),
                avatar=member.get("avatar", "US"),
            ))
        session.commit()


def save_invitation_to_db(invite: Dict[str, Any], workspace_id: str) -> None:
    """Save invitation to database."""
    with SyncSessionLocal() as session:
        session.add(WorkspaceInvitationModel(
            id=invite["id"],
            workspace_id=workspace_id,
            email=invite["email"],
            role=invite.get("role", "Analyst"),
            created_at=invite.get("created_at", ""),
            status=invite.get("status", "pending"),
        ))
        session.commit()


def save_dataset_permission_to_db(workspace_id: str, dataset_id: str, min_role: str) -> None:
    """Upsert dataset permission to database."""
    perm_id = f"{workspace_id}:{dataset_id}"
    with SyncSessionLocal() as session:
        existing = session.get(DatasetPermissionModel, perm_id)
        if existing:
            existing.min_role = min_role
        else:
            session.add(DatasetPermissionModel(
                id=perm_id,
                workspace_id=workspace_id,
                dataset_id=dataset_id,
                min_role=min_role,
            ))
        session.commit()


def save_activity_log_to_db(act: Dict[str, Any]) -> None:
    """Save activity log to database."""
    with SyncSessionLocal() as session:
        session.add(ActivityLogModel(
            id=act["id"],
            workspace_id=act["workspace_id"],
            dataset_name=act.get("dataset_name", "General"),
            actor_name=act["actor_name"],
            action=act["action"],
            details=act["details"],
            timestamp=act["timestamp"],
            badge_color=act.get("badge_color", "blue"),
        ))
        session.commit()


def save_dataset_comment_to_db(comment: Dict[str, Any]) -> None:
    """Save dataset comment to database."""
    with SyncSessionLocal() as session:
        existing = session.get(DatasetCommentModel, comment["id"])
        if existing:
            existing.resolved = comment.get("resolved", existing.resolved)
        else:
            session.add(DatasetCommentModel(
                id=comment["id"],
                dataset_id=comment["dataset_id"],
                row_index=comment.get("row_index"),
                column_name=comment.get("column_name"),
                author_name=comment["author_name"],
                author_role=comment.get("author_role", "Owner"),
                comment=comment["comment"],
                resolved=comment.get("resolved", False),
                created_at=comment.get("created_at", ""),
            ))
        session.commit()


def save_review_request_to_db(req: Dict[str, Any]) -> None:
    """Save review request to database."""
    with SyncSessionLocal() as session:
        existing = session.get(ReviewRequestModel, req["id"])
        if existing:
            existing.status = req.get("status", existing.status)
        else:
            session.add(ReviewRequestModel(
                id=req["id"],
                dataset_name=req["dataset_name"],
                source_branch=req["source_branch"],
                target_branch=req.get("target_branch", "main"),
                title=req["title"],
                author=req["author"],
                status=req.get("status", "open"),
                created_at=req.get("created_at", ""),
            ))
        session.commit()


def save_user_favorite_to_db(user_id: str, dataset_id: str) -> None:
    """Save user favorite to database."""
    fav_id = f"{user_id}:{dataset_id}"
    with SyncSessionLocal() as session:
        existing = session.get(UserFavoriteModel, fav_id)
        if not existing:
            from datetime import datetime, timezone
            session.add(UserFavoriteModel(
                id=fav_id,
                user_id=user_id,
                dataset_id=dataset_id,
                created_at=datetime.now(timezone.utc).isoformat(),
            ))
            session.commit()


def delete_user_favorite_from_db(user_id: str, dataset_id: str) -> None:
    """Delete user favorite from database."""
    fav_id = f"{user_id}:{dataset_id}"
    with SyncSessionLocal() as session:
        existing = session.get(UserFavoriteModel, fav_id)
        if existing:
            session.delete(existing)
            session.commit()


def save_user_recent_to_db(user_id: str, dataset_id: str, viewed_at: str) -> None:
    """Upsert user recent item into database."""
    rec_id = f"{user_id}:{dataset_id}"
    with SyncSessionLocal() as session:
        existing = session.get(UserRecentModel, rec_id)
        if existing:
            existing.viewed_at = viewed_at
        else:
            session.add(UserRecentModel(
                id=rec_id,
                user_id=user_id,
                dataset_id=dataset_id,
                viewed_at=viewed_at,
            ))
        session.commit()


def save_ml_model_to_db(model: Dict[str, Any]) -> None:
    """Upsert registered ML model checkpoint to database."""
    with SyncSessionLocal() as session:
        existing = session.get(MLModelModel, model["id"])
        if existing:
            for k, v in model.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            session.add(MLModelModel(
                id=model["id"],
                owner_id=model.get("owner_id"),
                name=model["name"],
                framework=model["framework"],
                algorithm=model.get("algorithm", "Classifier"),
                version=model.get("version", "v1.0.0"),
                dataset_name=model["dataset_name"],
                dataset_version_hash=model["dataset_version_hash"],
                experiment_tracker=model.get("experiment_tracker", "MLflow"),
                run_id=model.get("run_id"),
                metrics=model.get("metrics", {}),
                hyperparameters=model.get("hyperparameters", {}),
                artifact_uri=model.get("artifact_uri"),
                author=model.get("author", "Owner"),
                status=model.get("status", "staging"),
                created_at=model.get("created_at", ""),
            ))
        session.commit()


def save_pipeline_to_db(pipeline: Dict[str, Any]) -> None:
    """Upsert pipeline definition to database."""
    with SyncSessionLocal() as session:
        existing = session.get(PipelineModel, pipeline["id"])
        if existing:
            for k, v in pipeline.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            session.add(PipelineModel(
                id=pipeline["id"],
                owner_id=pipeline.get("owner_id"),
                name=pipeline["name"],
                description=pipeline.get("description"),
                target_dataset_id=pipeline["target_dataset_id"],
                steps=pipeline.get("steps", []),
                schedule=pipeline.get("schedule", "0 2 * * *"),
                trigger=pipeline.get("trigger", "cron"),
                is_active=pipeline.get("is_active", True),
                timeout_seconds=pipeline.get("timeout_seconds", 60),
                max_memory_mb=pipeline.get("max_memory_mb", 512),
                created_at=pipeline.get("created_at", ""),
                last_run_at=pipeline.get("last_run_at"),
                last_status=pipeline.get("last_status", "never_run"),
            ))
        session.commit()


def save_pipeline_run_to_db(run: Dict[str, Any]) -> None:
    """Save pipeline execution run to database."""
    r_id = run.get("id") or run.get("run_id")
    with SyncSessionLocal() as session:
        existing = session.get(PipelineRunModel, r_id)
        if existing:
            existing.status = run.get("status", existing.status)
            existing.completed_at = run.get("completed_at", existing.completed_at)
            existing.duration_seconds = run.get("duration_seconds") or run.get("duration_ms", 0.0) / 1000.0 or existing.duration_seconds
            existing.rows_processed = run.get("rows_processed") or run.get("output_rows", existing.rows_processed)
            existing.logs = run.get("logs", existing.logs)
            existing.error = run.get("error", existing.error)
        else:
            session.add(PipelineRunModel(
                id=r_id,
                pipeline_id=run["pipeline_id"],
                status=run.get("status", "running"),
                started_at=run["started_at"],
                completed_at=run.get("completed_at"),
                duration_seconds=run.get("duration_seconds") or (run.get("duration_ms", 0.0) / 1000.0 if run.get("duration_ms") else 0.0),
                rows_processed=run.get("rows_processed") or run.get("output_rows", 0),
                logs=run.get("logs", []),
                error=run.get("error"),
                triggered_by=run.get("triggered_by", "manual"),
            ))
        session.commit()


def save_dead_letter_job_to_db(job: Dict[str, Any]) -> None:
    """Save dead-letter job to database."""
    job_id = job.get("id") or job.get("job_id") or job.get("dlq_id")
    with SyncSessionLocal() as session:
        existing = session.get(DeadLetterJobModel, job_id)
        status = "resolved" if job.get("resolved") else job.get("status", "quarantined")
        if existing:
            existing.retry_count = job.get("retry_count", existing.retry_count)
            existing.status = status
        else:
            session.add(DeadLetterJobModel(
                id=job_id,
                job_id=job_id,
                pipeline_id=job["pipeline_id"],
                failed_at=job.get("failed_at") or job.get("timestamp", ""),
                error_type=job.get("error_type", "ExecutionError"),
                error_message=job.get("error_message") or job.get("error", ""),
                retry_count=job.get("retry_count", 0),
                max_retries=job.get("max_retries", 3),
                payload=job.get("payload", {}),
                status=status,
            ))
        session.commit()



def save_commit_to_db(commit: Dict[str, Any]) -> None:
    """Save version commit to database."""
    with SyncSessionLocal() as session:
        existing = session.get(CommitModel, commit["id"])
        if existing:
            for k, v in commit.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            session.add(CommitModel(
                id=commit["id"],
                hash=commit["hash"],
                full_hash=commit["full_hash"],
                dataset_name=commit["dataset_name"],
                parent_hash=commit.get("parent_hash"),
                version_tag=commit.get("version_tag") or commit.get("version", "v1.0.0"),
                message=commit.get("message", "Commit"),
                author=commit.get("author", "User"),
                timestamp=commit.get("timestamp") or commit.get("date", ""),
                delta_rows=commit.get("delta_rows") or commit.get("deltaRows", "+0 rows"),
                delta_columns=commit.get("delta_columns") or commit.get("deltaColumns", "+0 cols"),
                added_cols=commit.get("added_cols") or commit.get("diffSummary", {}).get("addedCols", []),
                removed_cols=commit.get("removed_cols") or commit.get("diffSummary", {}).get("removedCols", []),
                modified_cols=commit.get("modified_cols") or commit.get("diffSummary", {}).get("modifiedCols", []),
                tags=commit.get("tags", []),
                is_pinned=commit.get("is_pinned", False),
                access_level=commit.get("access_level", "workspace"),

                custom_metadata=commit.get("custom_metadata", {}),
                owner_id=commit.get("owner_id"),
            ))
        session.commit()


def save_branch_to_db(branch: Dict[str, Any], dataset_name: str, is_active: bool = False) -> None:
    """Upsert branch to database."""
    branch_id = f"{dataset_name.strip().lower()}:{branch['name']}"
    with SyncSessionLocal() as session:
        existing = session.get(BranchModel, branch_id)
        if existing:
            existing.head_commit_id = branch.get("head_commit_id", existing.head_commit_id)
            existing.head_hash = branch.get("head_hash", existing.head_hash)
            existing.ahead_count = branch.get("ahead_count", existing.ahead_count)
            existing.behind_count = branch.get("behind_count", existing.behind_count)
            existing.is_active = is_active
        else:
            session.add(BranchModel(
                id=branch_id,
                dataset_name=dataset_name,
                name=branch["name"],
                head_commit_id=branch["head_commit_id"],
                head_hash=branch["head_hash"],
                is_default=branch.get("is_default", False),
                protected=branch.get("protected", False),
                created_at=branch.get("created_at", ""),
                created_by=branch.get("created_by", "System"),
                description=branch.get("description"),
                ahead_count=branch.get("ahead_count", 0),
                behind_count=branch.get("behind_count", 0),
                is_active=is_active,
            ))
        session.commit()


def delete_branch_from_db(dataset_name: str, branch_name: str) -> None:
    """Delete branch from database."""
    branch_id = f"{dataset_name.strip().lower()}:{branch_name}"
    with SyncSessionLocal() as session:
        existing = session.get(BranchModel, branch_id)
        if existing:
            session.delete(existing)
            session.commit()



def save_showcase_item_to_db(item: Dict[str, Any]) -> None:
    """Upsert showcase dataset card to database."""
    with SyncSessionLocal() as session:
        existing = session.get(ShowcaseItemModel, item["id"])
        if existing:
            for k, v in item.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            session.add(ShowcaseItemModel(
                id=item["id"],
                title=item["title"],
                slug=item["slug"],
                domain=item["domain"],
                description=item["description"],
                author=item["author"],
                author_avatar=item.get("author_avatar"),
                author_verified=item.get("author_verified", False),
                format=item.get("format", "parquet"),
                license=item.get("license", "CC-BY-4.0"),
                doi=item.get("doi"),
                tags=item.get("tags", []),
                total_rows=item.get("total_rows", 0),
                total_columns=item.get("total_columns", 0),
                size_bytes=item.get("size_bytes", 0),
                quality_score=float(item.get("quality_score", 95.0) or 95.0),
                stars=item.get("stars", 0),
                downloads=item.get("downloads", 0),
                forks=item.get("forks", 0),
                updated_at=item.get("updated_at", ""),
                schema_fields=item.get("schema_fields", []),
                sample_rows=item.get("sample_rows", []),
                sample_query=item.get("sample_query"),
            ))
        session.commit()


def save_user_starred_showcase_to_db(user_id: str, showcase_id: str) -> None:
    """Save user star on showcase dataset to database."""
    star_id = f"{user_id}:{showcase_id}"
    with SyncSessionLocal() as session:
        existing = session.get(UserStarredShowcaseModel, star_id)
        if not existing:
            from datetime import datetime, timezone
            session.add(UserStarredShowcaseModel(
                id=star_id,
                user_id=user_id,
                showcase_id=showcase_id,
                starred_at=datetime.now(timezone.utc).isoformat(),
            ))
            session.commit()


def delete_user_starred_showcase_from_db(user_id: str, showcase_id: str) -> None:
    """Remove user star on showcase dataset from database."""
    star_id = f"{user_id}:{showcase_id}"
    with SyncSessionLocal() as session:
        existing = session.get(UserStarredShowcaseModel, star_id)
        if existing:
            session.delete(existing)
            session.commit()


def load_all_from_db() -> None:
    """Load all persisted entities from SQLite / Postgres into runtime state."""
    # Import router modules that hold state
    from strata_api.routers import datasets, security, integrations, collaboration, discovery, lineage, pipelines, showcase
    from strata_api.versioning import branches, registry

    with SyncSessionLocal() as session:
        # 1. Datasets
        duckdb_engine = None
        try:
            import os
            from strata_api.core.duckdb_engine import get_duckdb_engine
            duckdb_engine = get_duckdb_engine()
        except Exception:
            pass

        for d in session.scalars(select(DatasetModel)).all():
            datasets._datasets_db[d.id] = d.to_dict()
            if duckdb_engine and d.file_path and d.view_name and os.path.exists(d.file_path):
                try:
                    duckdb_engine.register_file(d.view_name, d.file_path)
                except Exception:
                    pass

        # 2. Share Links

        for s in session.scalars(select(ShareLinkModel)).all():
            datasets._shared_links[s.token] = s.to_dict()

        # 3. Audit Trail
        audit_events = session.scalars(select(AuditTrailModel).order_by(AuditTrailModel.timestamp)).all()
        if audit_events:
            security._audit_trail.clear()
            for a in audit_events:
                security._audit_trail.append(a.to_dict())

        # 4. Webhooks & Events
        for w in session.scalars(select(WebhookConfigModel)).all():
            integrations._webhook_configs[w.id] = w.to_dict()
        for e in session.scalars(select(IntegrationEventModel)).all():
            if not any(ev["id"] == e.id for ev in integrations._integration_events):
                integrations._integration_events.append(e.to_dict())

        # 5. Workspaces & Collaboration
        for ws in session.scalars(select(WorkspaceModel)).all():
            collaboration._workspaces_db[ws.id] = ws.to_dict()
        for mem in session.scalars(select(WorkspaceMemberModel)).all():
            collaboration._members_db.setdefault(mem.workspace_id, [])
            if not any(m["id"] == mem.id for m in collaboration._members_db[mem.workspace_id]):
                collaboration._members_db[mem.workspace_id].append(mem.to_dict())
        for inv in session.scalars(select(WorkspaceInvitationModel)).all():
            collaboration._invitations_db.setdefault(inv.workspace_id, [])
            if not any(i["id"] == inv.id for i in collaboration._invitations_db[inv.workspace_id]):
                collaboration._invitations_db[inv.workspace_id].append(inv.to_dict())
        for perm in session.scalars(select(DatasetPermissionModel)).all():
            collaboration._dataset_permissions_db.setdefault(perm.workspace_id, {})[perm.dataset_id] = perm.min_role
        for act in session.scalars(select(ActivityLogModel)).all():
            if not any(a["id"] == act.id for a in collaboration._activity_feed_db):
                collaboration._activity_feed_db.append(act.to_dict())
        for com in session.scalars(select(DatasetCommentModel)).all():
            collaboration._dataset_comments_db.setdefault(com.dataset_id, [])
            if not any(c["id"] == com.id for c in collaboration._dataset_comments_db[com.dataset_id]):
                collaboration._dataset_comments_db[com.dataset_id].append(com.to_dict())
        for rev in session.scalars(select(ReviewRequestModel)).all():
            if not any(r["id"] == rev.id for r in collaboration._review_requests_db):
                collaboration._review_requests_db.append(rev.to_dict())

        # 6. Discovery (Favorites & Recents)
        for fav in session.scalars(select(UserFavoriteModel)).all():
            discovery._user_favorites[fav.user_id].add(fav.dataset_id)
        for rec in session.scalars(select(UserRecentModel)).all():
            user_list = discovery._user_recents[rec.user_id]
            if not any(r.get("dataset_id") == rec.dataset_id for r in user_list):
                user_list.append({"dataset_id": rec.dataset_id, "viewed_at": rec.viewed_at})

        # 7. Lineage ML Models
        for mod in session.scalars(select(MLModelModel)).all():
            if not any(m["id"] == mod.id for m in lineage._models_db):
                lineage._models_db.append(mod.to_dict())

        # 8. Pipelines
        for pipe in session.scalars(select(PipelineModel)).all():
            pipelines._pipelines_db[pipe.id] = pipe.to_dict()
        for run in session.scalars(select(PipelineRunModel)).all():
            pipelines._pipeline_runs[run.id] = run.to_dict()
        for job in session.scalars(select(DeadLetterJobModel)).all():
            if not any((j.get("job_id") or j.get("dlq_id") or j.get("id")) == job.job_id for j in pipelines._dead_letter_queue):
                pipelines._dead_letter_queue.append(job.to_dict())


        # 9. Versioning (Commits & Branches)
        for c in session.scalars(select(CommitModel)).all():
            c_dict = c.to_dict()
            if not any(item["id"] == c.id for item in registry._commits):
                registry._commits.append(c_dict)
                registry._graph.add_version(
                    version_hash=c_dict.get("full_hash") or c_dict.get("hash") or c.id,
                    dataset_name=c_dict.get("dataset_name", ""),
                    parent_hash=c_dict.get("parent_hash"),
                    message=c_dict.get("message", ""),
                    metadata=c_dict,
                )
        for br in session.scalars(select(BranchModel)).all():

            key = br.dataset_name.strip().lower()
            branches._branches_db.setdefault(key, {})[br.name] = br.to_dict()
            if br.is_active:
                branches._active_branch_db[key] = br.name

        # 10. Showcase
        for sh in session.scalars(select(ShowcaseItemModel)).all():
            showcase._showcase_registry[sh.id] = sh.to_dict()
        for st in session.scalars(select(UserStarredShowcaseModel)).all():
            showcase._user_starred_showcase[st.user_id].add(st.showcase_id)
