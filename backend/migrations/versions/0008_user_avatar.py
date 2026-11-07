"""Store optional profile pictures as bounded base64 image data URLs."""
from alembic import op
import sqlalchemy as sa

revision = '0008_user_avatar'
down_revision = '0007_learning_progress'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('avatar_base64', sa.Text(), nullable=True))
    op.create_check_constraint('avatar_size_limit', 'users',
                               'avatar_base64 IS NULL OR length(avatar_base64) <= 2796244')


def downgrade():
    op.drop_constraint('avatar_size_limit', 'users', type_='check')
    op.drop_column('users', 'avatar_base64')
