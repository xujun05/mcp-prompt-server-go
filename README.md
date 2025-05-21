# MCP Prompt Server (Go)

Go语言实现的MCP提示词服务器，基于[mark3labs/mcp-go](https://github.com/mark3labs/mcp-go)。

Inspired by [joeseesun/mcp-prompt-server](https://github.com/joeseesun/mcp-prompt-server), and [gdli6177/mcp-prompt-server](https://github.com/gdli6177/mcp-prompt-server).

## 主要特性

- 📦 **丰富的提示词模板**: 内置高质量的代码、写作、产品、知识卡片、网页生成、结构化总结等提示词
- 🛠️ **即插即用的MCP工具**: 所有提示词自动注册为MCP工具，支持参数化调用，兼容主流编辑器
- 🔄 **热重载与管理**: 无需重启服务器即可重新加载新提示词
- 🧩 **易于扩展**: 添加新的YAML/JSON文件即可扩展功能，无需修改核心代码
- 🏷️ **多语言与多领域**: 适用于中文/英文内容、产品、教育、媒体、AI等多个领域

## 目录结构

```
mcp-prompt-server-go/
├── cmd/
│   └── main.go               # 程序入口
├── internal/
│   ├── server/               # 服务器实现
│   │   └── server.go
│   ├── prompt/               # 提示词处理
│   │   ├── loader.go         # 提示词加载器
│   │   └── model.go          # 提示词数据结构
│   └── util/                 # 工具函数
│       └── files.go
├── prompts/                  # 所有提示词模板（YAML/JSON文件）
│   ├── gen_summarize.yaml
│   ├── gen_title.yaml
│   └── ...
└── README.md
```

## 快速开始

1. **克隆仓库**

   ```bash
   git clone https://github.com/yourusername/mcp-prompt-server-go.git
   cd mcp-prompt-server-go
   ```

2. **构建项目**

   ```bash
   ./build.sh
   ```

3. **启动服务器**

   ```bash
   ./bin/mcp-prompt-server
   ```

   MCP提示词服务器将自动加载`prompts/`目录中的所有提示词模板，并将它们作为MCP工具暴露。

## 工具集成

### Raycast

1. 在Raycast中，搜索`install server (MCP)`
2. 给你的MCP一个简单的名称，例如`prompt`（方便后续@调用）
3. 命令: 输入构建后可执行文件的路径，例如 `/Users/yourusername/mcp-prompt-server-go/bin/mcp-prompt-server`
4. 保存后Raycast将自动集成MCP提示词服务器

### Cursor

- 编辑`~/.cursor/mcp_config.json`并添加以下内容（替换路径为您的实际项目路径）：

  ```json
  {
    "servers": [
      {
        "name": "Prompt Server",
        "command": "/path/to/mcp-prompt-server-go/bin/mcp-prompt-server",
        "args": [],
        "transport": "stdio"
      }
    ]
  }
  ```

### Windsurf

- 编辑`~/.codeium/windsurf/mcp_config.json`并添加：

  ```json
  {
    "mcpServers": {
      "prompt-server": {
        "command": "/path/to/mcp-prompt-server-go/bin/mcp-prompt-server",
        "args": [],
        "transport": "stdio"
      }
    }
  }
  ```

## 如何扩展提示词

1. **在`prompts/`目录中创建新的YAML或JSON文件**
2. **模板示例**：

   ```yaml
   name: your_prompt_name
   description: What this prompt does
   arguments: []
   messages:
     - role: user
       content:
         type: text
         text: |
           Your prompt content, supports parameter placeholders like {{param}}
   ```

3. **热重载提示词**
   - 使用编辑器中的`reload_prompts`工具，或重启服务器

## 管理与调试

- `reload_prompts`: 热重载所有提示词模板
- `get_prompt_names`: 列出所有可用的提示词名称

## 许可证

MIT
