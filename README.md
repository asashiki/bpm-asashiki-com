# 死了没？

一个只读健康数据仪表盘，部署目标域名：`bpm.asashiki.com`。

页面直接调用 `https://link.asashiki.com`：

- `/api/devices/health/summary?hours=24`
- `/api/devices/health/summary?hours=168`
- `/api/devices/health/records?type=heart_rate&hours=24&limit=8`
- `/api/devices/health/records?type=sleep&hours=168&limit=4`
- `/api/devices/current`

本地预览：

```bash
python3 -m http.server 4173 -d /home/asashiki/bpm-asashiki-com
```

Cloudflare Pages 发布：

```bash
cd /home/asashiki/bpm-asashiki-com
npm run deploy
```
