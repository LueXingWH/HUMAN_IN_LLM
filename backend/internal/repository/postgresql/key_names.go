package postgresql

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/zyf2007/ChatAPI/internal/repository/common"
)

func (s *Store) renameOwned(ctx context.Context, query, id, userID, name string) error {
	tag, err := s.pool.Exec(ctx, query, name, id, userID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return common.ErrNameConflict
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return common.ErrNotFound
	}
	return nil
}

func (s *Store) RenameAppAPIKey(ctx context.Context, id, userID, name string) error {
	return s.renameOwned(ctx, `UPDATE user_app_api_keys SET name = $1 WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL`, id, userID, name)
}

func (s *Store) RenameModelAPIKey(ctx context.Context, id, userID, name string) error {
	return s.renameOwned(ctx, `UPDATE user_api_keys SET name = $1 WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL`, id, userID, name)
}

func (s *Store) RenameVirtualModel(ctx context.Context, id, userID, name string) error {
	return s.renameOwned(ctx, `UPDATE user_virtual_models SET name = $1 WHERE id = $2 AND user_id = $3`, id, userID, name)
}
