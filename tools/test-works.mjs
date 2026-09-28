// works.js 逻辑自测
// 用一个极简 DOM 替身跑真实的 works.js，验证标签汇总、筛选、排序与空结果提示。
// 替身只实现 works.js 实际用到的那几个方法。
//
// 用法：node tools/test-works.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

class El {
  constructor(tag, className = '', dataset = {}) {
    this.tag = tag;
    this.className = className;
    this.dataset = dataset;
    this.children = [];
    this.hidden = false;
    this.attrs = {};
    this.textContent = '';
    this.handlers = {};
  }
  // 重新 append 已存在的节点等于把它移到末尾 —— works.js 正是靠这个特性排序
  append(...nodes) {
    for (const n of nodes) {
      const i = this.children.indexOf(n);
      if (i >= 0) this.children.splice(i, 1);
      this.children.push(n);
    }
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn); }
  click() { (this.handlers.click ?? []).forEach((fn) => fn()); }
  setAttribute(k, v) { this.attrs[k] = v; }
  has(cls) { return this.className.split(/\s+/).includes(cls); }
  querySelectorAll(sel) {
    const parts = sel.split('.').filter(Boolean); // 去掉 ".work-card" 前导点产生的空串
    return this.children.filter((c) => parts.every((p) => c.has(p)));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  /** 当前可见的作品卡片（排除空结果提示） */
  get shown() { return this.children.filter((c) => c.has('work-card') && !c.hidden); }
}

/** 用一棵模拟 DOM 树跑一遍 works.js，返回操控入口。 */
function mount(specs) {
  const list = new El('ol', 'portfolio-list');
  const cards = specs.map(([year, tags]) => {
    const el = new El('li', 'work-card', { year: String(year), tags });
    list.append(el);
    return el;
  });
  const tagBox = new El('div', 'works-tags');
  const sortBtn = new El('button', 'works-sort');
  const registry = { '.portfolio-list': list, '#works-tags': tagBox, '#works-sort': sortBtn };
  globalThis.document = { querySelector: (s) => registry[s] ?? null, createElement: (t) => new El(t) };
  eval(fs.readFileSync('works.js', 'utf8'));
  return {
    list, cards, tagBox, sortBtn,
    tags: () => tagBox.children.map((b) => b.textContent),
    clickTag: (name) => tagBox.children.find((b) => b.textContent === name).click(),
    shownTags: () => list.shown.map((c) => c.dataset.tags),
    emptyTip: () => list.children.find((c) => c.has('works-empty')),
  };
}

const SPEC = [
  [2026, '前端 后端 数据库'],
  [2026, '前端 数据库 部署'],
  [2025, '前端 AI'],
];

// ---------------------------------------------------------------------------
// 1. 标签由 data-tags 自动汇总去重，「全部」永远第一位
// ---------------------------------------------------------------------------
const p = mount(SPEC);
assert.deepEqual(p.tags(), ['全部', '前端', '后端', '数据库', '部署', 'AI'], '标签汇总去重');
assert.equal(p.tagBox.children[0].attrs['aria-pressed'], 'true', '默认选中「全部」');
console.log('[OK] 标签自动汇总去重：', p.tags().join(' / '));

// ---------------------------------------------------------------------------
// 2. 默认按年份「新→旧」，同年保持页面里的原有顺序
// ---------------------------------------------------------------------------
assert.deepEqual(p.shownTags(), ['前端 后端 数据库', '前端 数据库 部署', '前端 AI'], '默认新→旧');
console.log('[OK] 默认按年份「新→旧」，同年保持原有顺序');

// ---------------------------------------------------------------------------
// 3. 筛选只隐藏不销毁，原始节点可反复使用
// ---------------------------------------------------------------------------
p.clickTag('AI');
assert.deepEqual(p.shownTags(), ['前端 AI'], '按标签筛选');
assert.ok(p.cards.every((c) => p.list.children.includes(c)), '三张卡片都还在 DOM 里');
console.log('[OK] 按「AI」筛选只剩 1 张，且未销毁 DOM');

// ---------------------------------------------------------------------------
// 4. 切回「全部」
// ---------------------------------------------------------------------------
p.clickTag('全部');
assert.equal(p.shownTags().length, 3, '切回全部');
console.log('[OK] 切回「全部」恢复 3 张');

// ---------------------------------------------------------------------------
// 5. 排序方向翻转，且能翻回
// ---------------------------------------------------------------------------
p.sortBtn.click();
assert.equal(p.sortBtn.textContent, '按年份：旧→新', '按钮文案跟着翻转');
assert.equal(p.shownTags()[0], '前端 AI', '2025 应排到最前');
p.sortBtn.click();
assert.equal(p.shownTags()[0], '前端 后端 数据库', '翻回新→旧');
console.log('[OK] 排序方向可来回切换');

// ---------------------------------------------------------------------------
// 6. 空结果提示的显隐始终与筛选结果一致（防御性分支，遍历所有标签验证）
// ---------------------------------------------------------------------------
for (const tag of p.tags()) {
  p.clickTag(tag);
  assert.equal(p.emptyTip().hidden, p.shownTags().length > 0, `「${tag}」下提示显隐不正确`);
}
assert.ok(p.emptyTip(), '空结果提示节点已创建');
console.log('[OK] 空结果提示的显隐与筛选结果始终一致');

// ---------------------------------------------------------------------------
// 7. 运维主流程：往 HTML 加一张带新标签的作品，新标签自动出现
// ---------------------------------------------------------------------------
const added = mount([...SPEC, [2027, '前端 运维']]);
assert.deepEqual(added.tags(), ['全部', '前端', '后端', '数据库', '部署', 'AI', '运维'], '新标签自动出现');
assert.equal(added.shownTags()[0], '前端 运维', '2027 的新作品排最前');
added.clickTag('运维');
assert.deepEqual(added.shownTags(), ['前端 运维'], '新标签可筛选');
console.log('[OK] 新增作品只需改 HTML：新标签「运维」自动出现且可筛选');

// ---------------------------------------------------------------------------
// 8. 容错：data-year 缺失时不应让排序整体变成 NaN
// ---------------------------------------------------------------------------
const messy = mount([[2026, 'a'], [null, 'b'], ['坏值', 'c']]);
assert.equal(messy.shownTags().length, 3, '缺 data-year 的卡片仍要显示，不能消失');
console.log('[OK] data-year 缺失/非法时兜底为 0，卡片照常显示');

console.log('\nworks.js 逻辑自测全部通过。');
