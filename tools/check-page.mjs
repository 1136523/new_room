// ============================================================================
// 自检脚本 —— 提交前先跑一遍
// ----------------------------------------------------------------------------
// 用法：node tools/check-page.mjs
//
// 专门检查「人工容易漏、机器一秒查完」的错误。GitHub Actions 里也跑这一条，
// 所以本地先跑能省掉一次往返等待。
//
// 检查项：
//   1  必需文件在不在
//   2  index.html 引用的本地文件是不是真的存在
//   3  页内锚点 #xxx 有没有对应的 id
//   4  有没有重复的 id
//   5  每个栏目是不是都在导航里
//   6  图片的 alt 是否写了、写得够不够具体
//   7  作品卡片的 data-year / data-tags 格式是否正确 ← 改作品时最常出错的地方
//
// 不依赖任何第三方包，Node 自带能力就够。
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const problems = [];
const ok = (msg) => console.log('  [OK]', msg);
const bad = (msg) => { problems.push(msg); console.log('  [X] ', msg); };

// 读 index.html；不存在就直接退出，后面的检查都做不了
const htmlPath = path.join(root, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.log('找不到 index.html，请先在项目根目录运行本脚本。');
  process.exit(1);
}
const html = fs.readFileSync(htmlPath, 'utf8');

// 关键：先剥掉 HTML 注释再检查。
// 各区块末尾都有「新增模板」的注释示例，里面是占位路径（assets/作品封面.png）
// 和占位链接。示例不参与检查，复制出来变成真正的代码后才会被检查。
const code = html.replace(/<!--[\s\S]*?-->/g, '');

const heading = (n, text) => console.log(`\n== ${n}. ${text} ==`);

// ---------------------------------------------------------------------------
heading(1, '必需文件');
// 增删 JS 文件时，这里要同步，否则 CI 会在打包阶段才发现
for (const name of ['index.html', 'styles.css', 'app.js', 'works.js']) {
  if (fs.existsSync(path.join(root, name))) ok(name);
  else bad(`缺少 ${name}`);
}

// ---------------------------------------------------------------------------
heading(2, '引用的本地文件');
// 取出所有 href/src，跳过「不是文件」的写法：
//   http(s): 外部网址      //       协议相对网址
//   mailto:  发邮件        tel:     打电话
//   data:    内嵌数据      #        页内锚点
// 用「有没有冒号协议头」判断，比逐个列举更稳妥 —— 以后加 sms:、geo: 也不用改这里。
const refs = [...code.matchAll(/(?:href|src)=["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((v) => !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(v));

for (const ref of [...new Set(refs)]) {
  const target = path.join(root, ref.split('?')[0].split('#')[0]);
  if (fs.existsSync(target)) ok(ref);
  else bad(`引用了不存在的文件：${ref}`);
}

// ---------------------------------------------------------------------------
heading(3, '页内锚点');
const ids = [...code.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]);
const anchors = [...new Set([...code.matchAll(/href=["']#([^"']+)["']/g)].map((m) => m[1]))];
for (const anchor of anchors) {
  if (ids.includes(anchor)) ok(`#${anchor}`);
  else bad(`链接指向 #${anchor}，但页面里没有 id="${anchor}"`);
}

// ---------------------------------------------------------------------------
heading(4, '重复的 id');
// id 重复时锚点只会跳到第一个，导航和「当前栏目高亮」都会指错地方
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
for (const id of duplicates) bad(`id="${id}" 重复出现，锚点只会跳到第一个`);
if (!duplicates.length) ok('没有重复的 id');

// ---------------------------------------------------------------------------
heading(5, '导航与栏目对应');
// 少一个方向都会出问题：栏目没进导航 = 没人找得到；
// 导航指向已删的栏目 = 点下去没反应（这一条第 3 项已覆盖）。
const navTargets = [...new Set(
  [...code.matchAll(/<nav[^>]*>[\s\S]*?<\/nav>/g)]
    .flatMap((block) => [...block[0].matchAll(/href=["']#([^"']+)["']/g)].map((m) => m[1])),
)];
const sections = [...new Set(
  [...code.matchAll(/<section[^>]*\sid=["']([^"']+)["']/g)].map((m) => m[1]),
)];
for (const id of sections) {
  if (navTargets.includes(id)) ok(`#${id}`);
  else bad(`栏目 <section id="${id}"> 没有对应的导航链接，页面上找不到了`);
}

// ---------------------------------------------------------------------------
heading(6, '图片 alt');
// alt 是图片加载失败时的替代文字，也是视障用户理解图片的唯一途径。
// 它很容易在改代码时被删掉，而且页面看起来完全正常，人工发现不了 ——
// 这正是最适合交给机器查的那类问题。
const WEAK_ALT = new Set(['图片', '照片', 'image', 'photo', 'img', '头像', '封面']);
for (const [tag] of code.matchAll(/<img[^>]*>/g)) {
  const found = tag.match(/alt=["']([^"']*)["']/);
  const brief = tag.slice(0, 60);
  if (!found) bad(`图片缺少 alt：${brief}`);
  else if (!found[1].trim()) bad(`图片的 alt 是空的：${brief}`);
  else if (WEAK_ALT.has(found[1].trim())) bad(`alt 写得太笼统（"${found[1]}"）：${brief}`);
  else ok(found[1]);
}

// ---------------------------------------------------------------------------
heading(7, '作品卡片 data 属性');
// works.js 完全靠这两个属性工作：data-year 决定排序并由 CSS 显示成角标，
// data-tags 决定筛选按钮。写错了页面不会报错，只是筛选默默失灵，
// 所以必须在这里拦住。
const cards = [...code.matchAll(/<li\b[^>]*\bclass=["'][^"']*\bwork-card\b[^"']*["'][^>]*>/g)];
if (!cards.length) bad('没找到 .work-card 作品卡片，检查作品门户区块是否被改坏了');

for (const [tag] of cards) {
  const year = tag.match(/data-year=["']([^"']*)["']/);
  const cardTags = tag.match(/data-tags=["']([^"']*)["']/);
  const brief = tag.slice(0, 70);

  if (!year) bad(`作品卡片缺少 data-year（纯数字年份）：${brief}`);
  else if (!/^\d{4}$/.test(year[1])) bad(`data-year 必须是 4 位数字，现在是 "${year[1]}"：${brief}`);
  else ok(`data-year="${year[1]}"`);

  if (!cardTags) bad(`作品卡片缺少 data-tags（空格分隔），筛选不会包含它：${brief}`);
  else if (!cardTags[1].trim()) bad(`data-tags 是空的：${brief}`);
  // 标签是空格的连续分隔，漏打一个空格会让 "前端 后端" 变成一个叫"前端 后端"的标签
  else if (/\s\s|^\s|\s$/.test(cardTags[1])) bad(`data-tags 不能有多余空格："${cardTags[1]}"：${brief}`);
  else ok(`data-tags="${cardTags[1]}"`);
}

// ---------------------------------------------------------------------------
console.log('');
if (problems.length) {
  console.log(`自检未通过，共 ${problems.length} 个问题，请逐条修好再提交。`);
  process.exit(1);
}
console.log('自检通过。');
