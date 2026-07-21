---
name: zip-folder
description: |
  Use this skill when a folder (e.g. dist/, demo/) needs to be packaged for download.
  Always pair with `codespace-build`.
---

# 1. 命令

```bash
zip -r dist.zip dist
```

# 2. 输出命名

- `dist-<PRJ-ID>-<version>.zip`
- `demo-<alias>-<version>.zip`

# 3. 失败回退

- 文件过大 → 拆分 zip；
- 上传失败 → 切到 GitHub Release。
