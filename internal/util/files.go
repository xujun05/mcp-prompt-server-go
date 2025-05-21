package util

import (
	"os"
)

// EnsureDirectory 确保目录存在
func EnsureDirectory(dir string) error {
	return os.MkdirAll(dir, 0755)
}

// FileExists 检查文件是否存在
func FileExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

// DirectoryExists 检查目录是否存在
func DirectoryExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return info.IsDir()
}

// CopyFile 复制文件
func CopyFile(src, dst string) error {
	input, err := os.ReadFile(src)
	if err != nil {
		return err
	}

	return os.WriteFile(dst, input, 0644)
}
