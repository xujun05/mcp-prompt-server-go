#!/bin/bash

# 设置项目目录
PROJECT_DIR=$(dirname "$0")
cd "$PROJECT_DIR" || exit 1

echo "构建 MCP Prompt Server..."

# 确保目录结构存在
mkdir -p bin

# 构建项目
go build -o bin/mcp-prompt-server ./cmd/main.go

if [ $? -eq 0 ]; then
    echo "构建成功！可执行文件位于: bin/mcp-prompt-server"
    echo "运行命令: ./bin/mcp-prompt-server"
else
    echo "构建失败。"
fi
