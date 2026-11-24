/**
 * mh_dump_local.js —— Loon cron 脚本（本地验证版，无 NAS）
 *
 * 每 5 分钟把缓冲里的记录逐行写进 Loon 日志（Loon → 数据 → 日志 → 脚本，可查），
 * 然后清空缓冲（已落日志，不怕丢；capture 端有自己的上限保护）。
 * 修改查看频率：改插件 [Script] 里 cron 的间隔表达式（当前每 5 分钟一次）。
 */

var KEY = "mh_capture";
var buf = $persistentStore.read(KEY) || "";
var lines = buf.split("\n").filter(function (x) { return x.length > 0; });

if (!lines.length) {
  console.log("[MH-Dump] 本轮无新记录");
  $done();
}

console.log("[MH-Dump] ===== " + lines.length + " 条记录 =====");
for (var i = 0; i < lines.length; i++) {
  console.log("[MH] " + lines[i]);
}

var pw = lines.filter(function (x) { return x.indexOf('"pw":1') >= 0; }).length;
$notification.post("MH-Dump", "本轮 " + lines.length + " 条（推送窗口 " + pw + " 条）", "详情见 Loon → 脚本 → 日志");

$persistentStore.write(undefined, KEY);
$done({});
