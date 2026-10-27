package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func TestValidPublicImageSignature(t *testing.T) {
	const secret = "test-public-image-secret"
	const fileID = "file_signature_test"
	expiresAt := strconv.FormatInt(time.Now().Add(time.Hour).Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(fileID + "|" + expiresAt))
	signature := hex.EncodeToString(mac.Sum(nil))

	handler := UploadHandler{PublicImageSecret: secret}
	valid := httptest.NewRequest("GET", "/api/media/public/"+fileID+"?exp="+expiresAt+"&sig="+signature, nil)
	if !handler.validPublicImageSignature(valid, fileID) {
		t.Fatal("expected signed public image URL to be accepted")
	}

	tampered := httptest.NewRequest("GET", "/api/media/public/"+fileID+"?exp="+expiresAt+"&sig=deadbeef", nil)
	if handler.validPublicImageSignature(tampered, fileID) {
		t.Fatal("tampered signature must be rejected")
	}

	expired := strconv.FormatInt(time.Now().Add(-time.Minute).Unix(), 10)
	mac = hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(fileID + "|" + expired))
	expiredReq := httptest.NewRequest("GET", "/api/media/public/"+fileID+"?exp="+expired+"&sig="+hex.EncodeToString(mac.Sum(nil)), nil)
	if handler.validPublicImageSignature(expiredReq, fileID) {
		t.Fatal("expired signature must be rejected")
	}
}
