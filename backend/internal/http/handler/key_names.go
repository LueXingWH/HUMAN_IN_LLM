package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/zyf2007/ChatAPI/internal/http/httpx"
	"github.com/zyf2007/ChatAPI/internal/repository/common"
	"github.com/zyf2007/ChatAPI/internal/service/auth/authz/session"
)

func (h UserHandler) RenameAppKey(w http.ResponseWriter, r *http.Request) {
	h.renameOwned(w, r, "api-keys", "keyID")
}
func (h UserHandler) RenameModelKey(w http.ResponseWriter, r *http.Request) {
	h.renameOwned(w, r, "model-keys", "keyID")
}

func (h UserHandler) renameOwned(w http.ResponseWriter, r *http.Request, kind, param string) {
	pr, ok := session.PrincipalFromContext(r.Context())
	if !ok {
		httpx.WriteJSON(w, 401, map[string]any{"error": "请先登录"})
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		httpx.WriteJSON(w, 400, map[string]any{"error": "请求格式错误"})
		return
	}
	if err := h.UserControl.Keys.Rename(r.Context(), pr.UserID, kind, chi.URLParam(r, param), body.Name); err != nil {
		status, message := http.StatusInternalServerError, "改名失败，请重试"
		switch {
		case errors.Is(err, common.ErrInvalidName):
			status, message = 400, err.Error()
		case errors.Is(err, common.ErrNotFound):
			status, message = 404, "记录不存在"
		case errors.Is(err, common.ErrNameConflict):
			status, message = 409, err.Error()
		}
		httpx.WriteJSON(w, status, map[string]any{"error": message})
		return
	}
	httpx.WriteJSON(w, 200, map[string]any{"ok": true, "name": strings.TrimSpace(body.Name)})
}
