package prompt

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kataras/golog"
	"gopkg.in/yaml.v3"
)

// LoadFromDirectory 从目录加载所有提示词模板
func LoadFromDirectory(dir string) ([]*Prompt, error) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	var prompts []*Prompt

	for _, file := range files {
		// 跳过目录和非yaml/json文件
		if file.IsDir() || !(strings.HasSuffix(file.Name(), ".yaml") ||
			strings.HasSuffix(file.Name(), ".yml") ||
			strings.HasSuffix(file.Name(), ".json")) {
			continue
		}

		fullPath := filepath.Join(dir, file.Name())
		prompt, err := LoadFromFile(fullPath)
		if err != nil {
			golog.Errorf("error loading prompt from %s: %v\n", fullPath, err)
			continue
		}

		prompts = append(prompts, prompt)
	}

	return prompts, nil
}

// LoadFromFile 从文件加载提示词模板
func LoadFromFile(path string) (*Prompt, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var prompt Prompt

	if strings.HasSuffix(path, ".json") {
		err = json.Unmarshal(data, &prompt)
	} else {
		err = yaml.Unmarshal(data, &prompt)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to parse file: %w", err)
	}

	// 验证必要字段
	if prompt.Name == "" {
		return nil, fmt.Errorf("prompt name is required")
	}

	return &prompt, nil
}

// LoadFromSubdirectories 递归地从目录和子目录加载提示词
func LoadFromSubdirectories(rootDir string) ([]*Prompt, error) {
	golog.Infof("Starting to load prompts from subdirectories in %s", rootDir)
	var allPrompts []*Prompt

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录入口本身
		if info.IsDir() {
			return nil
		}

		// 只处理yaml/json文件
		if !(strings.HasSuffix(info.Name(), ".yaml") ||
			strings.HasSuffix(info.Name(), ".yml") ||
			strings.HasSuffix(info.Name(), ".json")) {
			return nil
		}

		prompt, err := LoadFromFile(path)
		if err != nil {
			golog.Errorf("error loading prompt from %s: %v\n", path, err)
			return nil
		}

		allPrompts = append(allPrompts, prompt)
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("error walking directories: %w", err)
	}

	golog.Infof("Finished loading prompts. Found %d prompts in %s and its subdirectories.", len(allPrompts), rootDir)
	return allPrompts, nil
}
