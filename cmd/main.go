package main

import (
	"flag"
	"os"
	"os/signal"
	"syscall"

	"github.com/chaoyuepan/mcp-prompt-server-go/internal/server"
	"github.com/kataras/golog"
)

var (
	addr = flag.String("addr", ":8888", "server address, use stdio transport if not set")
)

func main() {
	flag.Parse()

	golog.Println("Starting MCP Prompt Server...")

	// 创建并启动服务器
	srv, err := server.NewServer("../prompts")
	if err != nil {
		golog.Fatalf("Failed to create server: %v", err)
	}

	// 在后台运行服务器
	go func() {
		if err := srv.Start(*addr); err != nil {
			golog.Fatalf("server error: %v", err)
		}

		golog.Infof("server started on %s", *addr)
	}()

	golog.Println("MCP Prompt Server is running...")

	// 优雅关闭
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	golog.Infof("shutting down...")
	srv.Stop()
	golog.Infof("server stopped")
}
