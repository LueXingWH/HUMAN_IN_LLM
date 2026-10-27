package deepseek

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGLMCompletion(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/paas/v4/chat/completions" || r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("wrong endpoint or authorization")
		}
		var request chatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if request.Model != "glm-4.7-flash" || request.Thinking["type"] != "disabled" || request.Stream {
			t.Errorf("unexpected GLM request: %#v", request)
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":" 草稿 "}}]}`))
	}))
	defer server.Close()
	text, err := New(server.URL+"/api/paas/v4", "test-key", "glm-4.7-flash").Complete(context.Background(), []Message{{Role: "user", Content: "你好"}})
	if err != nil || text != "草稿" {
		t.Fatalf("text=%q err=%v", text, err)
	}
}

func TestProviderErrorDoesNotExposeBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_, _ = w.Write([]byte("sensitive upstream response"))
	}))
	defer server.Close()
	_, err := New(server.URL, "test-key", "").Complete(context.Background(), nil)
	if err == nil || strings.Contains(err.Error(), "sensitive") || strings.Contains(err.Error(), "test-key") {
		t.Fatalf("unsafe error: %v", err)
	}
}
