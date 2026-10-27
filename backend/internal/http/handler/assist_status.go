package handler

import (
	"github.com/zyf2007/ChatAPI/internal/http/httpx"
	"net/http"
)

func (h ChatAPIHandler) AssistStatus(w http.ResponseWriter, r *http.Request) {
	enabled := h.DeepSeek != nil && h.DeepSeek.Enabled()
	model := ""
	if h.DeepSeek != nil {
		model = h.DeepSeek.Model()
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"enabled": enabled, "model": model})
}
