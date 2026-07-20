---
name: video-render
agent: renderer
description: |
  Auto-generated skill for renderer agent.
  渲染 HTML / PDF / 截图，套品牌色与版式。
---

# Video Render（视频渲染）

## 1. 脚本生成
基于 brief 生成视频脚本:
- 0-3s: hook(抓人)
- 3-10s: 痛点
- 10-25s: 方案
- 25-30s: CTA

## 2. 分镜
每个时间点:
- 画面描述
- 字幕文案
- BGM 建议

## 3. 输出
data/business/renders/<rnd-id>/
- script.md
- storyboard.md
- voiceover.mp3 (TTS 生成)
- subtitles.srt
