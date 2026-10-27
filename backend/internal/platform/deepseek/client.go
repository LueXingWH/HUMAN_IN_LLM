package deepseek

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Message is a single message for an OpenAI-compatible completion endpoint.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Client is a minimal completion client; the legacy package name is retained.
type Client struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

// New returns a completion client, defaulting to GLM Flash.
func New(baseURL string, apiKey string, model string) *Client {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		baseURL = "https://open.bigmodel.cn/api/paas/v4"
	}
	if strings.TrimSpace(model) == "" {
		model = "glm-4.7-flash"
	}
	return &Client{
		baseURL:    baseURL,
		apiKey:     strings.TrimSpace(apiKey),
		model:      strings.TrimSpace(model),
		httpClient: &http.Client{Timeout: 180 * time.Second},
	}
}

type chatCompletionRequest struct {
	Model    string            `json:"model"`
	Messages []Message         `json:"messages"`
	Stream   bool              `json:"stream"`
	Thinking map[string]string `json:"thinking,omitempty"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Enabled reports whether the client has an API key configured.
func (c *Client) Enabled() bool {
	return c != nil && c.apiKey != ""
}

func (c *Client) Model() string { return c.model }

// Complete performs a single non-streaming chat completion and returns the assistant text.
func (c *Client) Complete(ctx context.Context, messages []Message) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("辅助模型尚未配置密钥")
	}
	input := chatCompletionRequest{Model: c.model, Messages: messages, Stream: false}
	if strings.HasPrefix(strings.ToLower(c.model), "glm-") {
		input.Thinking = map[string]string{"type": "disabled"}
	}
	payload, err := json.Marshal(input)
	if err != nil {
		return "", fmt.Errorf("marshal assist request: %w", err)
	}
	endpoint := c.baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("build assist request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("辅助模型连接失败: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("辅助模型请求失败（HTTP %d），请检查服务端密钥、模型权限或调用额度", resp.StatusCode)
	}
	var parsed chatCompletionResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("decode assist response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("辅助模型没有返回结果")
	}
	text := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if text == "" {
		return "", fmt.Errorf("辅助模型没有返回正文，请重试")
	}
	return text, nil
}
