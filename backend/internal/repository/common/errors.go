package common

import "errors"

var ErrTurnConflict = errors.New("turn state conflict")
var ErrNotFound = errors.New("record not found")
var ErrNameConflict = errors.New("该模型名称已存在")
var ErrInvalidName = errors.New("名称须为 1–100 个字符")
var ErrPendingDisconnected = errors.New("pending request disconnected")
var ErrConversationPending = errors.New("pending conversation cannot be deleted")
