"""add dataset_embeddings and pgvector

Revision ID: d2_semantic_search
Revises: 64ef3d4daafc
Create Date: 2026-09-29 10:28:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2_semantic_search'
down_revision: Union[str, Sequence[str], None] = '64ef3d4daafc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Attempt to enable pgvector extension if PostgreSQL is active
    try:
        bind = op.get_bind()
        if bind.dialect.name == "postgresql":
            op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    except Exception:
        pass

    op.create_table(
        'dataset_embeddings',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('dataset_id', sa.String(length=64), nullable=False),
        sa.Column('embedding', sa.JSON(), nullable=False),
        sa.Column('corpus_text', sa.Text(), nullable=True),
        sa.Column('model_name', sa.String(length=64), nullable=False, server_default='mistral-embed'),
        sa.Column('updated_at', sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('dataset_embeddings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dataset_embeddings_dataset_id'), ['dataset_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('dataset_embeddings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dataset_embeddings_dataset_id'))
    op.drop_table('dataset_embeddings')
