package workspace

import (
	"context"
	"encoding/json"
	"testing"

	controlsvc "github.com/zyf2007/ChatAPI/internal/service/chat/control"
)

type captureTurnExecutor struct {
	command controlsvc.Command
}

func (c *captureTurnExecutor) Execute(_ context.Context, command controlsvc.Command) (controlsvc.Result, error) {
	c.command = command
	return controlsvc.Result{Body: map[string]any{}}, nil
}

func TestExecuteCommandPreservesToolCallArguments(t *testing.T) {
	// This is what the tool-call composer stores: a JSON object whose command
	// string contains escaped newlines. A previous implementation rewrote the
	// \n escapes into real newlines, producing invalid JSON for the caller.
	raw := `{"command":"start \"\" \"https://example.com?win=1\"\nsleep 1\nstart \"\" \"https://example.com?win=2\"","description":"Open pages"}`
	if !json.Valid([]byte(raw)) {
		t.Fatalf("fixture is not valid JSON: %q", raw)
	}

	turn := &captureTurnExecutor{}
	service := New(nil, nil, turn)
	if _, err := service.ExecuteCommand(context.Background(), "owner", Command{
		ID:             "cmd_1",
		Kind:           "stream_complete",
		ConversationID: "conv_1",
		RequestID:      "req_1",
		Text:           raw,
		Mode:           "tool_call",
		ToolName:       "Bash",
		ToolCallID:     "call_1",
	}); err != nil {
		t.Fatalf("ExecuteCommand: %v", err)
	}

	if got := turn.command.Action.OutputText; got != raw {
		t.Fatalf("tool call arguments were rewritten:\nwant %q\ngot  %q", raw, got)
	}
}

func TestExecuteCommandPreservesToolResultPayload(t *testing.T) {
	raw := `line one\nline two`

	turn := &captureTurnExecutor{}
	service := New(nil, nil, turn)
	if _, err := service.ExecuteCommand(context.Background(), "owner", Command{
		ID:             "cmd_2",
		Kind:           "stream_complete",
		ConversationID: "conv_1",
		RequestID:      "req_1",
		Text:           raw,
		Mode:           "tool_result",
		ToolName:       "Bash",
		ToolCallID:     "call_1",
	}); err != nil {
		t.Fatalf("ExecuteCommand: %v", err)
	}

	if got := turn.command.Action.OutputText; got != raw {
		t.Fatalf("tool result was rewritten:\nwant %q\ngot  %q", raw, got)
	}
}

func TestExecuteCommandForwardsOutputImageAssetID(t *testing.T) {
	turn := &captureTurnExecutor{}
	service := New(nil, nil, turn)
	if _, err := service.ExecuteCommand(context.Background(), "owner", Command{
		ID:                 "cmd_4",
		Kind:               "stream_complete",
		ConversationID:     "conv_1",
		RequestID:          "req_1",
		Text:               "hello",
		Mode:               "assistant_message",
		OutputImageAssetID: "asset_reply",
	}); err != nil {
		t.Fatalf("ExecuteCommand: %v", err)
	}

	if got := turn.command.Action.OutputImageAssetID; got != "asset_reply" {
		t.Fatalf("output image asset id was not forwarded: got %q", got)
	}
}

func TestExecuteCommandUnescapesAssistantNewlines(t *testing.T) {
	turn := &captureTurnExecutor{}
	service := New(nil, nil, turn)
	if _, err := service.ExecuteCommand(context.Background(), "owner", Command{
		ID:             "cmd_3",
		Kind:           "stream_complete",
		ConversationID: "conv_1",
		RequestID:      "req_1",
		Text:           `line one\nline two`,
		Mode:           "assistant_message",
	}); err != nil {
		t.Fatalf("ExecuteCommand: %v", err)
	}

	if want, got := "line one\nline two", turn.command.Action.OutputText; got != want {
		t.Fatalf("assistant newlines were not unescaped:\nwant %q\ngot  %q", want, got)
	}
}
