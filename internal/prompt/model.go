package prompt

import (
	"fmt"
	"strings"
)

// Prompt 定义了一个提示词模板
type Prompt struct {
	Name        string     `yaml:"name" json:"name"`
	Description string     `yaml:"description" json:"description"`
	Arguments   []Argument `yaml:"arguments" json:"arguments"`
	Messages    []Message  `yaml:"messages" json:"messages"`
}

// Argument 定义了提示词的参数
type Argument struct {
	Name        string `yaml:"name" json:"name"`
	Description string `yaml:"description" json:"description"`
	Type        string `yaml:"type" json:"type"`
	Required    bool   `yaml:"required" json:"required"`
}

// Message 定义了提示词的消息
type Message struct {
	Role    string  `yaml:"role" json:"role"`
	Content Content `yaml:"content" json:"content"`
}

// Content 定义了消息的内容
type Content struct {
	Type string `yaml:"type" json:"type"`
	Text string `yaml:"text" json:"text"`
}

// RenderMessages 处理提示词模板并替换参数占位符
func (p *Prompt) RenderMessages(args map[string]interface{}) []Message {
	// 创建副本以避免修改原始内容
	renderedMessages := make([]Message, len(p.Messages))
	for i, msg := range p.Messages {
		renderedContent := Content{
			Type: msg.Content.Type,
			Text: msg.Content.Text,
		}

		// 用参数值替换占位符
		for name, value := range args {
			placeholder := "{{" + name + "}}"
			renderedContent.Text = strings.ReplaceAll(renderedContent.Text, placeholder, fmt.Sprintf("%v", value))
		}

		renderedMessages[i] = Message{
			Role:    msg.Role,
			Content: renderedContent,
		}
	}

	return renderedMessages
}

// RenderMessages 处理提示词模板并替换参数占位符
func (p *Prompt) RenderPromptMessages(args map[string]string) []Message {
	// 创建副本以避免修改原始内容
	renderedMessages := make([]Message, len(p.Messages))
	for i, msg := range p.Messages {
		renderedContent := Content{
			Type: msg.Content.Type,
			Text: msg.Content.Text,
		}

		// 用参数值替换占位符
		for name, value := range args {
			placeholder := "{{" + name + "}}"
			renderedContent.Text = strings.ReplaceAll(renderedContent.Text, placeholder, fmt.Sprintf("%v", value))
		}

		renderedMessages[i] = Message{
			Role:    msg.Role,
			Content: renderedContent,
		}
	}

	return renderedMessages
}
