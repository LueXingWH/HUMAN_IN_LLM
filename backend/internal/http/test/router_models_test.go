package httpapi_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/zyf2007/ChatAPI/internal/config"
	"github.com/zyf2007/ChatAPI/internal/ops/observability/logging"
	"github.com/zyf2007/ChatAPI/internal/repository/common"
	"github.com/zyf2007/ChatAPI/internal/repository/migrations"
	sqlitestore "github.com/zyf2007/ChatAPI/internal/repository/sqlite"
	modelkey "github.com/zyf2007/ChatAPI/internal/service/auth/authz/modelkey"
	httpapp "github.com/zyf2007/ChatAPI/internal/testutil/httpapp"
)

func TestProtocolListModels(t *testing.T) {
	st, err := sqlitestore.Open(filepath.Join(t.TempDir(), "chatapi.sqlite3"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	defer st.Close()
	if err := migrations.Bootstrap(context.Background(), st.DB()); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	if _, err := st.CreateUser(context.Background(), common.CreateUserInput{
		ID:       "user_models",
		Username: "models",
		Email:    "models@example.com",
		Role:     "user",
		IsActive: true,
	}); err != nil {
		t.Fatalf("create user: %v", err)
	}

	logFactory, err := logging.NewFactory(logging.Config{Level: "debug", Format: "json"})
	if err != nil {
		t.Fatalf("logger: %v", err)
	}
	st.Logger = logFactory.Layer(logging.LayerRepository)

	modelKeyService := modelkey.NewService(st, "test-master-key")
	_, rawKey, err := modelKeyService.CreateKey(context.Background(), "user_models", "model-a", "gpt-debug-a")
	if err != nil {
		t.Fatalf("create model key a: %v", err)
	}
	if _, _, err := modelKeyService.CreateKey(context.Background(), "user_models", "model-b", "gpt-debug-b"); err != nil {
		t.Fatalf("create model key b: %v", err)
	}
	if _, _, err := modelKeyService.CreateKey(context.Background(), "user_models", "model-a-dup", "gpt-debug-a"); err != nil {
		t.Fatalf("create duplicate model key: %v", err)
	}

	cfg := config.Default(config.ModeServe, "/tmp/chatapi-test")
	server := httptest.NewServer(httpapp.MustNewRouter(httpapp.Input{
		Config:         cfg,
		MediaProcessor: testMediaProcessor(),
		ChatRepo:       st,
		AuthRepo:       st,
		ConfigRepo:     st,
		StorageRepo:    st,
		AuditRepo:      st,
		PlatformRepo:   st,
		ModelAPIKeys:   modelKeyService,
		LoggerFactory:  logFactory,
	}))
	defer server.Close()

	resp := getJSONWithHeaders(t, server.URL+"/v1/models", map[string]string{
		"Authorization": "Bearer " + rawKey,
	}, http.StatusOK)
	if resp["object"] != "list" {
		t.Fatalf("unexpected models response: %#v", resp)
	}
	items := resp["data"].([]any)
	if len(items) != 3 {
		t.Fatalf("unexpected models list length: %#v", resp)
	}
	if items[0].(map[string]any)["id"] != "human-assistant" {
		t.Fatalf("default model missing: %#v", resp)
	}
	// A newly created Key works without registering any virtual model.
	if _, err := st.CreateUser(context.Background(), common.CreateUserInput{ID: "user_direct", Username: "direct", Email: "direct@example.com", Role: "user", IsActive: true}); err != nil {
		t.Fatal(err)
	}
	_, directKey, err := modelKeyService.CreateKeyWithRaw(context.Background(), "user_direct", "direct", "")
	if err != nil {
		t.Fatal(err)
	}
	directModels := getJSONWithHeaders(t, server.URL+"/v1/models", map[string]string{"Authorization": "Bearer " + directKey}, http.StatusOK)
	directItems := directModels["data"].([]any)
	if len(directItems) != 1 || directItems[0].(map[string]any)["id"] != "human-assistant" {
		t.Fatalf("direct Key has no default model: %#v", directModels)
	}
	registered, err := st.ListVirtualModelsByUser(context.Background(), "user_direct")
	if err != nil || len(registered) != 0 {
		t.Fatalf("direct Key unexpectedly registered a model: %#v %v", registered, err)
	}
	for _, method := range []string{"GET", "POST", "PATCH", "DELETE"} {
		path := "/api/user/virtual-models"
		if method == "PATCH" || method == "DELETE" {
			path += "/unused"
		}
		req, _ := http.NewRequest(method, server.URL+path, nil)
		removed, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		removed.Body.Close()
		if removed.StatusCode != http.StatusNotFound {
			t.Fatalf("removed %s endpoint returned %d", method, removed.StatusCode)
		}
	}
}
