package sqlite

import (
	"context"
	"errors"

	"github.com/zyf2007/ChatAPI/internal/repository/common"
)

func (s *Store) renameOwned(ctx context.Context, query, id, userID, name string) error {
	result, err := s.db.ExecContext(ctx, query, name, id, userID)
	if err != nil {
		var coded interface{ Code() int }
		if errors.As(err, &coded) && coded.Code() == 2067 {
			return common.ErrNameConflict
		}
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return common.ErrNotFound
	}
	return nil
}

func (s *Store) RenameAppAPIKey(ctx context.Context, id, userID, name string) error {
	return s.renameOwned(ctx, `UPDATE user_app_api_keys SET name = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`, id, userID, name)
}

func (s *Store) RenameModelAPIKey(ctx context.Context, id, userID, name string) error {
	return s.renameOwned(ctx, `UPDATE user_api_keys SET name = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`, id, userID, name)
}

func (s *Store) RenameVirtualModel(ctx context.Context, id, userID, name string) error {
	return s.renameOwned(ctx, `UPDATE user_virtual_models SET name = ? WHERE id = ? AND user_id = ?`, id, userID, name)
}
