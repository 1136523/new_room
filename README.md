# 个人简历主页

纯静态网页，无框架、无构建、无第三方依赖。推到 `main` 分支后由 GitHub Actions
自动检查并发布到 GitHub Pages。

---

## 日常维护：只改 `index.html`

**绝大多数更新只需要动 `index.html` 一个文件。** 这是本项目的核心设计：
所有内容都写在 HTML 里，JS 只做增强，不存任何数据。

| 想改什么 | 区块 | 做法 |
|---|---|---|
| 姓名、身份、学校 | 【区块 1】`#about` | 直接改 `h1` 和下面两行 `p` |
| 联系方式、城市、地址 | 【区块 1】`#about` | 复制 `.profile-details` 里的一个 `div` |
| 教育 / 竞赛 / 工作经历 | 【区块 2】`#experience` | 复制一个 `.experience-item` |
| 项目经历 | 【区块 3】`#projects` | 复制一个 `.research-item` |
| 技能 | 【区块 4】`#skills` | 复制一个 `li` |
| **作品** | 【区块 5】`#portfolio` | 复制一个 `li.work-card`（见下） |
| 学习目标 | 【区块 6】`#teaching` | 复制一个 `li` |
| 学习记录 | 【区块 7】`#publications` | 复制一个 `li` |

每个区块内部都有一段被 HTML 注释包起来的**「新增模板」**，
复制出来改文字即可，不会影响现有内容。

### 新增一个作品（最常用）

复制 `index.html` 里任意一个 `li.work-card`，改 5 处：

```html
<li class="work-card" data-year="2026" data-tags="前端 运维">
  <a href="作品线上地址" target="_blank" rel="noopener noreferrer">
    <div class="work-cover">
      <img src="assets/作品封面.png" alt="作品名称的实际网页截图"
           width="1200" height="800" loading="lazy" decoding="async">
    </div>
    <div class="work-copy">
      <h3>作品名称</h3>
      <p>一句话简介。</p>
    </div>
  </a>
</li>
```

| 改哪里 | 说明 |
|---|---|
| `data-year` | 4 位数字，决定排序，**同时**被 CSS 显示成封面右上角角标 |
| `data-tags` | 空格分隔的标签，用于自动生成筛选按钮 |
| `href` | 作品线上地址 |
| `src` / `alt` | 封面图放 `assets/`，`alt` 要描述图上是什么 |
| `h3` / `p` | 名称和简介 |

**`data-tags` 只写这一次**：筛选按钮下次打开自动出现新标签，
不需要再去别处登记。标签之间用**单个空格**分隔，多打空格会被自检拦住。

---

## 改完必须跑自检

```bash
node tools/check-page.mjs   # HTML 结构 / 引用 / 锚点 / alt / data 属性
node tools/test-works.mjs   # 作品筛选与排序的逻辑自测
```

两条都通过再推送。CI 里跑的是同样两条命令，本地先跑能省一次往返等待。

`check-page.mjs` 会挡住这些「页面看起来完全正常、但实际是错的」问题：

1. 必需文件缺失
2. 引用的 css / js / 图片不存在
3. 链接指向的 `#锚点` 没有对应 `id`
4. **`id` 重复**（锚点只会跳到第一个）
5. **有栏目但没加进导航**（页面上找不到了）
6. 图片缺 `alt`、`alt` 为空、或写成「图片 / 头像」这类过于笼统的说法
7. **作品卡片的 `data-year` 不是 4 位数字、`data-tags` 缺失或有多余空格**

各区块末尾的「新增模板」是 HTML 注释，自检会先剥掉注释再检查，
所以模板里的占位路径不会误报；复制出来变成真正的代码后才会被检查。

---

## 文件结构

```
index.html          ← 唯一内容来源，日常维护只改它
styles.css          ← 样式，按【区块 N】分区，响应式集中在第 12 区
app.js              ← 返回顶部、阅读进度条、导航高亮
works.js            ← 作品筛选与排序（读 HTML 上的 data-* 属性，不存数据）
assets/             ← 图片与字体
tools/
  check-page.mjs    ← 提交前自检
  test-works.mjs    ← 作品逻辑自测
.github/workflows/pages.yml   ← 检查通过后自动发布到 Pages
```

改样式时，`styles.css` 的分区编号与 `index.html` 的【区块 N】一一对应，
找样式不用通读全文。换配色和字号只需改文件开头 `:root` 里的变量。

---

## 两条贯穿全项目的原则

**1. index.html 是唯一数据源。**
作品曾经同时存在于 `works-data.js` 和 `index.html` 两处，而 JS 每次渲染都会
把 HTML 里的卡片清空重画 —— 照着 HTML 注释加作品完全不生效，是最难查的一类坑。
现在卡片只写在 HTML 里，JS 只读不写内容。

**2. 渐进增强：JS 管状态，CSS 管样子。**

- 禁用 JS 时页面**依然完整可读** —— 作品全部显示，只是没有筛选栏和角标高亮。
  因此 `.section` 的淡入效果绝不能写成 `display: none`。
- JS 只负责往元素上加减类名（`is-visible` / `is-current`），
  外观一律写在 CSS 里。想改交互的视觉表现不需要动 JS。

---

## 部署

推到 `main` 即自动发布，无需手动操作：

1. `check` 任务跑两条自检
2. `deploy` 任务等 `check` 通过后，把整个目录发到 GitHub Pages

首次使用需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

---

## 附：第 6 课验收要求

本课没有唯一代码填空答案，以课堂操作手册中的「测试、修复与最终发布」验收项和完整工程为准。

**问题记录必须包含**：重现步骤、实际现象、涉及文件、修复内容、同一步骤重测结果。

**最终检查**：资料、图片、链接、手机布局、导航状态、作品筛选、Git 提交和 Pages 网址均正常。
提交说明应写清修复原因与结果。

