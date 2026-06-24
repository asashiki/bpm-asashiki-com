const API_BASE = "https://link.asashiki.com";
const TZ = "Asia/Shanghai";

const $ = (id) => document.getElementById(id);

const state = {
  bpm: 72,
  phase: 0,
  points: [],
};

function fmtNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function fmtTime(iso) {
  if (!iso) return "没有时间戳";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function minutesText(minutes) {
  if (!Number.isFinite(minutes)) return "--";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h} 小时 ${m} 分钟`;
}

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

function metricByType(summary, type) {
  return summary.metrics?.find((metric) => metric.type === type) ?? null;
}

function setText(id, value) {
  $(id).textContent = value;
}

function row(left, right, className = "mini-row") {
  const item = document.createElement("div");
  item.className = className;
  item.innerHTML = `<span>${left}</span><strong>${right}</strong>`;
  return item;
}

function renderDiagnosis({ heart24, oxygen24, sleep168, devices }) {
  const latestBpm = heart24?.latest?.value;
  const avgBpm = heart24?.avg;
  const hasPulse = Number.isFinite(latestBpm) && latestBpm > 0;
  const staleMinutes = heart24?.latest?.recordedAt
    ? (Date.now() - new Date(heart24.latest.recordedAt).getTime()) / 60000
    : Infinity;
  const oxygen = oxygen24?.latest?.value;
  const sleepLatestHoursAgo = sleep168?.latest?.recordedAt
    ? (Date.now() - new Date(sleep168.latest.recordedAt).getTime()) / 3600000
    : Infinity;

  const onlineDevices = devices.devices?.filter((device) => device.isOnline) ?? [];
  const alive = hasPulse && staleMinutes < 180;

  setText("status-word", alive ? "还活着" : "待复核");
  $("status-word").className = alive ? "alive" : "warning";
  setText(
    "status-note",
    alive ? "心脏仍在打卡，死亡申请被驳回" : "脉搏记录有点久，建议戳一下本人",
  );

  const jokes = [];
  if (alive) {
    jokes.push(
      `结论：没死。心脏最近一次提交了 ${latestBpm} bpm 的在线证明，服务器认为这具身体仍在营业。`,
    );
  } else {
    jokes.push("结论：系统不敢签死亡证明。不是因为乐观，是因为证据链还没跑完。");
  }
  if (Number.isFinite(avgBpm)) {
    jokes.push(`24 小时平均 ${fmtNumber(avgBpm, 1)} bpm，像一台拒绝下班的生物水泵。`);
  }
  if (Number.isFinite(oxygen)) {
    jokes.push(`血氧最新 ${oxygen}%：氧气仍愿意入股，项目尚未清算。`);
  }
  if (sleepLatestHoursAgo > 30) {
    jokes.push("睡眠记录看起来缺席。人类学上这叫熬夜，系统里更像慢性自毁的签到。");
  }

  setText("diagnosis-text", jokes.join(""));

  const reasons = $("reasons");
  reasons.replaceChildren(
    row("心率证据", hasPulse ? `${latestBpm} bpm，拒绝安静` : "未发现有效心跳", "reason"),
    row("数据新鲜度", Number.isFinite(staleMinutes) ? `${Math.round(staleMinutes)} 分钟前` : "未知", "reason"),
    row("在线设备", `${onlineDevices.length} 台，还在替你暴露行踪`, "reason"),
  );
}

function renderVitals(summary24) {
  const heart = metricByType(summary24, "heart_rate");
  const oxygen = metricByType(summary24, "oxygen_saturation");

  state.bpm = heart?.latest?.value ?? heart?.avg ?? 72;

  setText("live-bpm", fmtNumber(state.bpm));
  setText("avg-heart", heart ? fmtNumber(heart.avg, 1) : "--");
  setText("latest-heart", heart?.latest ? fmtNumber(heart.latest.value) : "--");
  setText("latest-heart-time", heart?.latest ? `${fmtTime(heart.latest.recordedAt)} 更新` : "没拿到最新心跳");
  setText("oxygen", oxygen?.latest ? `${fmtNumber(oxygen.latest.value)}%` : "--");

  return { heart, oxygen };
}

function renderSleep(summary168, sleepRecords) {
  const sleep = metricByType(summary168, "sleep");
  const latest = sleep?.latest?.value;
  const target = 8 * 60;
  const percent = Math.max(0, Math.min(100, ((latest ?? 0) / target) * 100));
  $("sleep-fill").style.width = `${percent}%`;

  if (sleep) {
    const recordedAverage = sleep.sum / 7;
    setText(
      "sleep-text",
      `最近一次睡了 ${minutesText(latest)}。七天只有 ${sleep.count} 条睡眠记录，总计 ${minutesText(sleep.sum)}；摊到每天是 ${minutesText(recordedAverage)}。不是睡够了，是缺勤被平均数粉饰了。`,
    );
  } else {
    setText("sleep-text", "七天内没有睡眠样本。不是永生，是日志里已经开始有都市传说味。");
  }

  const list = $("sleep-records");
  const rows = (sleepRecords.records ?? []).slice(0, 4).map((record) =>
    row(fmtTime(record.recordedAt), minutesText(record.value)),
  );
  list.replaceChildren(...(rows.length ? rows : [row("睡眠记录", "空")]));

  return sleep;
}

function renderDevices(devices) {
  const current = devices.devices?.[0];
  setText("device-live", current?.live ?? "没有设备愿意出庭作证。");

  const list = $("device-list");
  const rows = (devices.devices ?? []).map((device) =>
    row(
      device.deviceName ?? device.deviceId,
      device.isOnline ? `${device.appName ?? "未知"} · 在线` : "离线",
    ),
  );
  list.replaceChildren(...rows);
}

function renderPulse(records) {
  const list = $("pulse-list");
  const rows = (records.records ?? []).slice(0, 7).map((record) => {
    const item = document.createElement("div");
    item.className = "pulse-row";
    item.innerHTML = `<span>${fmtTime(record.recordedAt)}</span><strong>${fmtNumber(record.value)} bpm</strong>`;
    return item;
  });
  list.replaceChildren(...(rows.length ? rows : [row("心率记录", "空", "pulse-row")]));
}

async function refresh() {
  try {
    const [summary24, summary168, heartRecords, sleepRecords, devices] = await Promise.all([
      getJson("/api/devices/health/summary?hours=24"),
      getJson("/api/devices/health/summary?hours=168"),
      getJson("/api/devices/health/records?type=heart_rate&hours=24&limit=8"),
      getJson("/api/devices/health/records?type=sleep&hours=168&limit=4"),
      getJson("/api/devices/current"),
    ]);

    const { heart, oxygen } = renderVitals(summary24);
    const sleep = renderSleep(summary168, sleepRecords);
    renderDevices(devices);
    renderPulse(heartRecords);
    renderDiagnosis({ heart24: heart, oxygen24: oxygen, sleep168: sleep, devices });
    setText("verdict-line", "心脏还在跳，互联网暂不受理死亡证明。");
  } catch (error) {
    console.error(error);
    setText("verdict-line", "验尸官罢工：API 没回话。");
    setText("status-word", "失联");
    $("status-word").className = "dead";
    setText("status-note", "不是死了，是 fetch 先倒下了");
    setText("diagnosis-text", "数据读取失败。按照互联网医学，这种情况应先检查网络，再检查人生。");
  }
}

function drawEcg() {
  const canvas = $("ecg");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const baseline = height * 0.52;
  const beatWidth = Math.max(54, 110 - state.bpm * 0.35);

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#41f0a0";
  ctx.shadowColor = "rgba(65, 240, 160, 0.7)";
  ctx.shadowBlur = 16;
  ctx.beginPath();

  for (let x = -beatWidth; x < width + beatWidth; x += 2) {
    const t = ((x + state.phase) % beatWidth) / beatWidth;
    let y = baseline + Math.sin((x + state.phase) * 0.045) * 3;
    if (t > 0.14 && t < 0.18) y -= 22 * Math.sin(((t - 0.14) / 0.04) * Math.PI);
    if (t > 0.28 && t < 0.31) y += 36 * Math.sin(((t - 0.28) / 0.03) * Math.PI);
    if (t > 0.31 && t < 0.345) y -= 118 * Math.sin(((t - 0.31) / 0.035) * Math.PI);
    if (t > 0.345 && t < 0.39) y += 54 * Math.sin(((t - 0.345) / 0.045) * Math.PI);
    if (t > 0.58 && t < 0.72) y -= 24 * Math.sin(((t - 0.58) / 0.14) * Math.PI);

    if (x === -beatWidth) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
  state.phase = (state.phase + Math.max(1.4, state.bpm / 44)) % beatWidth;
  requestAnimationFrame(drawEcg);
}

refresh();
setInterval(refresh, 60_000);
requestAnimationFrame(drawEcg);
