// ============================================================================
// works.js —— 作品门户的交互增强
// ----------------------------------------------------------------------------
// 设计原则：**index.html 是唯一内容来源**，本文件不存任何作品数据。
// 作品卡片直接写在 index.html 的 <li class="work-card"> 上，本文件只读它们身上的
// 两个属性：
//
//   data-year="2026"              排序用的年份（纯数字），同时被 CSS 显示成封面角标
//   data-tags="前端 后端 数据库"   空格分隔的标签，用于自动生成筛选按钮
//
// 这样运维新增作品时只改 HTML 一处：标签不用另外登记，筛选按钮下次打开自动出现。
//
// 渐进增强：JS 失败或被禁用时，工具条为空、作品全部照常显示，页面依然完整可读。
// ============================================================================

// ---------------------------------------------------------------------------
// 页面状态：init() 一次性填好，之后只读
// ---------------------------------------------------------------------------

/** 界面交互状态：当前筛哪个标签、年份按什么方向排。 */
const state = { tag: '全部', newestFirst: true }

/** 作品数据与元素引用。空数组/空值表示「还没启动」。 */
let cards = []
let tags = []
let listEl = null
let tagBoxEl = null
let sortBtnEl = null

// ---------------------------------------------------------------------------
// 读取
// ---------------------------------------------------------------------------

/**
 * 把每张作品卡片读成一条数据。
 * 容错点：data-year 缺失或写错时兜底为 0，保证排序不会整体变成 NaN。
 */
function readCards() {
  return [...listEl.querySelectorAll('.work-card')].map(card => ({
    el: card, // 原始 DOM 节点，筛选和排序都通过它生效
    year: Number.parseInt(card.dataset.year, 10) || 0,
    tags: (card.dataset.tags || '').split(/\s+/).filter(Boolean),
  }))
}

/** 汇总所有出现过的标签并去重，「全部」永远排在第一位。 */
function collectTags() {
  return ['全部', ...new Set(cards.flatMap(card => card.tags))]
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

/** 算出当前状态下该显示哪些、按什么顺序排列。 */
function getVisible() {
  const matched =
    state.tag === '全部' ? cards : cards.filter(card => card.tags.includes(state.tag))
  // 用展开语法复制一份再排：sort 会就地改动原数组，不复制会打乱原始数据
  return [...matched].sort((a, b) => (state.newestFirst ? b.year - a.year : a.year - b.year))
}

/** 空结果提示节点，用到时才插入 DOM。 */
const emptyTip = document.createElement('li')
emptyTip.className = 'works-empty'
emptyTip.textContent = '这个标签下还没有作品。'

/** 重绘列表：按排序结果显示或隐藏卡片。 */
function renderList() {
  const shown = getVisible()
  const shownEls = new Set(shown.map(card => card.el))
  // 把已存在的节点重新 append 等于把它移到末尾。
  // 按排序结果依次追加，可见卡片就自动排好了序，隐藏卡片被挤到后面。
  shown.forEach(card => listEl.append(card.el))
  cards.forEach(card => { card.el.hidden = !shownEls.has(card.el) })
  // 筛不出东西时给一句话，不让列表空着
  emptyTip.hidden = shown.length > 0
  listEl.append(emptyTip)
}

/** 重绘筛选按钮，并高亮当前标签。 */
function renderTags() {
  tagBoxEl.replaceChildren(
    ...tags.map(tag => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = tag
      // aria-pressed 既让 CSS 知道该高亮谁，也告诉读屏软件「这个按钮是按下状态」
      button.setAttribute('aria-pressed', String(tag === state.tag))
      button.addEventListener('click', () => {
        state.tag = tag
        renderTags()
        renderList()
      })
      return button
    }),
  )
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

function init() {
  listEl = document.querySelector('.portfolio-list')
  tagBoxEl = document.querySelector('#works-tags')
  sortBtnEl = document.querySelector('#works-sort')
  // 缺任何一个元素就退出，本页其余部分不受影响
  if (!listEl || !tagBoxEl || !sortBtnEl) return

  cards = readCards()
  if (!cards.length) return
  tags = collectTags()

  sortBtnEl.addEventListener('click', () => {
    state.newestFirst = !state.newestFirst
    sortBtnEl.textContent = state.newestFirst ? '按年份：新→旧' : '按年份：旧→新'
    renderList()
  })

  renderTags()
  renderList()
}

// 放在文件末尾调用：上面全是 const 声明和函数声明，
// 若在声明之前调用 init()，内部读到 state 会触发 TDZ 报错。
init()
