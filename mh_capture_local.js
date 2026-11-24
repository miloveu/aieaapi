/**
 * mh_capture_local.js —— Loon 3.5.3 response 脚本（本地验证版，无 NAS）
 *
 * 与 NAS 版 (mh_capture.js) 的唯一差异：命中「推送窗口 / 疑似信号接口」时，
 * 直接在 iPhone 上弹一条本地通知（含 URL 与正文片段），并在 Loon 日志打印完整记录。
 * 缓冲仍写 $persistentStore（供 dump 脚本查看），不向任何服务端上报。
 *
 * 判定方式：手机弹出标题为「🎯 MH 命中」的通知，且正文里出现 trig/inv/t1/t2/t3
 *            字样 → 信号能抓到；只有 badge/sync 和行情 → HTTP 层没有信号内容。
 */

var KEY = "mh_capture";
var PUSH_KEY = "mh_last_push";
var THROTTLE_KEY = "mh_throttle";
var MAX_LINES = 300;
var MAX_BYTES = 256 * 1024;
var HINT_BYTES = 8 * 1024;
var WINDOW_MS = 90 * 1000;
var THROTTLE_MS = 30 * 1000;

var u = $request.url || "";
var st = $response.status;
var body = typeof $response.body === "string" ? $response.body : "";
var now = Date.now();

var PUBLIC = /(gold_min\.json|_kline_\d+[mh]?\.(json|json\.gz)|flash\.json)/i;
var isPublic = PUBLIC.test(u);

var SUSPECT = /(signal|pattern|level|levels|struct|notification|notif|history|message|push|detail|alert|trigger|badge|prefs|devices|auth)/i;
var isSuspect = SUSPECT.test(u);

var isBadge = /\/badge\/sync/i.test(u);
if (isBadge) {
  $persistentStore.write(String(now), PUSH_KEY);
}

var lastPush = parseInt($persistentStore.read(PUSH_KEY) || "0", 10) || 0;
var inWindow = !isPublic && !isBadge && lastPush > 0 && (now - lastPush) <= WINDOW_MS;
if (isBadge) inWindow = true;

var rec = { t: now, u: u, s: st, len: body.length, pw: inWindow ? 1 : 0 };
var keep = false;
if (inWindow || isSuspect) {
  keep = true;
  rec.hint = body.slice(0, HINT_BYTES);
} else if (!isPublic) {
  var thr = {};
  try { thr = JSON.parse($persistentStore.read(THROTTLE_KEY) || "{}") || {}; } catch (e) { thr = {}; }
  var last = thr[u] || 0;
  if (now - last > THROTTLE_MS) {
    keep = true;
    thr[u] = now;
    var ks = Object.keys(thr);
    if (ks.length > 200) {
      ks.sort(function (a, b) { return thr[a] - thr[b]; });
      for (var i = 0; i < ks.length - 200; i++) delete thr[ks[i]];
    }
    $persistentStore.write(JSON.stringify(thr), THROTTLE_KEY);
  }
}
if (!keep && isPublic && !isSuspect) {
  var thr2 = {};
  try { thr2 = JSON.parse($persistentStore.read(THROTTLE_KEY) || "{}") || {}; } catch (e2) { thr2 = {}; }
  var last2 = thr2[u] || 0;
  if (now - last2 > 60000) {
    keep = true;
    thr2[u] = now;
    var ks2 = Object.keys(thr2);
    if (ks2.length > 200) {
      ks2.sort(function (a, b) { return thr2[a] - thr2[b]; });
      for (var j = 0; j < ks2.length - 200; j++) delete thr2[ks2[j]];
    }
    $persistentStore.write(JSON.stringify(thr2), THROTTLE_KEY);
  }
}

if (keep) {
  var buf = $persistentStore.read(KEY) || "";
  buf += JSON.stringify(rec) + "\n";
  var lines = buf.split("\n").filter(function (x) { return x.length > 0; });
  if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES);
  buf = lines.join("\n") + "\n";
  if (buf.length > MAX_BYTES) {
    var cut = buf.slice(-MAX_BYTES);
    var nl = cut.indexOf("\n");
    buf = nl >= 0 ? cut.slice(nl + 1) : cut;
  }
  $persistentStore.write(buf, KEY);

  // ---- 本地版差异：命中即弹通知 + 写日志 ----
  if (inWindow || isSuspect) {
    var path = u.replace(/^https?:\/\/[^/]+/, "");
    var snippet = (rec.hint || "").replace(/\s+/g, " ").slice(0, 150);
    var SIGNAL_WORDS = /(trig|inv|"t1"|"t2"|"t3"|sim_?diff|pattern|signal|target|stop_loss|take_profit)/i;
    var title = SIGNAL_WORDS.test(rec.hint || "") ? "🎯 MH 命中·疑似信号!" : "MH 命中";
    $notification.post(title, path.slice(0, 80), snippet || "(空正文)");
    $console.log("[MH] " + JSON.stringify(rec));
  }
}

$done({});
