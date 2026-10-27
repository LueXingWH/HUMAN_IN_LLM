package turn

import (
	"context"
	"strings"
	"testing"

	"github.com/zyf2007/ChatAPI/internal/repository/chat"
	"github.com/zyf2007/ChatAPI/internal/repository/common"
	"github.com/zyf2007/ChatAPI/internal/service/chat/outputasset"
)

type imageReplyFakePending struct {
	pendingRegistryLike
}

func (imageReplyFakePending) GetByConversationID(string) (*PendingTurn, bool) {
	return &PendingTurn{OwnerID: "owner_1", RequestID: "req_1"}, true
}

type imageReplyFakeStore struct {
	chat.Store
	eventInput common.AppendConversationEventWithAssetInput
}

func (s *imageReplyFakeStore) AppendConversationEventWithAsset(_ context.Context, input common.AppendConversationEventWithAssetInput) (common.ConversationEvent, error) {
	s.eventInput = input
	return common.ConversationEvent{ID: "evt_reply_image", Type: input.Event.Type}, nil
}

type imageReplyFakeAssets struct {
	OutputAssetService
}

func (imageReplyFakeAssets) Consume(_ context.Context, ownerID string, conversationID string, requestID string, assetID string, persist func(outputasset.Resolved) error) (outputasset.Resolved, error) {
	resolved := outputasset.Resolved{
		Asset: common.MediaAsset{ID: assetID, FileID: "file_reply", MediaType: "image/avif", Width: 640, Height: 480},
		URL:   "/api/media/assets/file_reply",
	}
	if err := persist(resolved); err != nil {
		return outputasset.Resolved{}, err
	}
	return resolved, nil
}

func TestConsumeReplyImageReferencesAssetAndBuildsLink(t *testing.T) {
	store := &imageReplyFakeStore{}
	service := &Service{
		Pending:      imageReplyFakePending{},
		Store:        store,
		OutputAssets: imageReplyFakeAssets{},
		BaseURL:      "https://chat.example/",
	}

	image, err := service.consumeReplyImage(context.Background(), "conv_1", "asset_reply")
	if err != nil {
		t.Fatalf("consumeReplyImage: %v", err)
	}
	if image.URL != "/api/media/assets/file_reply" || image.MediaType != "image/avif" || image.Width != 640 {
		t.Fatalf("unexpected reply image: %#v", image)
	}
	if store.eventInput.Event.Type != "assistant_image" || store.eventInput.AssetID != "asset_reply" ||
		store.eventInput.Purpose != "assistant_reply_image" {
		t.Fatalf("unexpected asset reference event: %#v", store.eventInput)
	}
	if got, want := service.replyImageMarkdown(image), "![图片](https://chat.example/api/media/assets/file_reply)"; got != want {
		t.Fatalf("unexpected markdown link: got %q want %q", got, want)
	}
	service.PublicImageSecret = "reply-image-secret"
	signed := service.replyImageMarkdown(image)
	if !strings.Contains(signed, "/api/media/public/file_reply?exp=") || !strings.Contains(signed, "&sig=") {
		t.Fatalf("expected signed public image link, got %q", signed)
	}
	if got, want := appendReplyImageLink("hello", "![图片](x)"), "hello\n\n![图片](x)"; got != want {
		t.Fatalf("unexpected appended link: %q", got)
	}
}
