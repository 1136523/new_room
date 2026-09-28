// ============================================================================
// app.js —— 页面交互
// ----------------------------------------------------------------------------
// 职责只有三个：返回顶部、阅读进度条、导航高亮。
//
// 渐进增强：HTML 里的 <a href="#skills"> 本身就能跳转，不依赖 JS。
// JS 只负责「告诉用户现在在哪」，JS 挂了页面照样能读，只是少了提示。
//
// 贯穿全文件的一条分工原则：**JS 管状态，CSS 管样子。**
// JS 只往元素上加减类名（is-visible / is-current），具体外观写死在 styles.css，
// 想改交互的视觉表现不需要动这个文件。
// ============================================================================

// ---------------------------------------------------------------------------
// 准备：抓住后面要用的元素
// ---------------------------------------------------------------------------
// querySelector     按选择器找第一个，找不到返回 null
// querySelectorAll  按选择器找全部，返回可 forEach 的集合
// 选择器写法与 CSS 完全一致：#id 找 id，.class 找类，nav a 找范围里的 a
const progressBar = document.querySelector('#reading-progress')
const indicator = document.querySelector('#section-indicator')
const toTopButton = document.querySelector('#to-top')
const navLinks = document.querySelectorAll('nav a')

// 页面上所有栏目：hero 是首屏，section 是其余栏目，两类都要盯上。
const sections = document.querySelectorAll('main .hero[id], main section[id]')

// 栏目 id → 栏目中文名，直接取导航链接上的文字。
// 好处：在 HTML 里新加一个栏目，这个文件一行都不用改。
const sectionNames = new Map(
  [...navLinks].map(link => [link.getAttribute('href'), link.textContent.trim()]),
)

// ---------------------------------------------------------------------------
// 功能 1：返回顶部
// ---------------------------------------------------------------------------
toTopButton?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  // 回到顶部后地址栏的 # 还停在刚才那个栏目，手动清掉，
  // 否则右下角徽标写着「技能」，人却已经在最上面了。
  history.replaceState(null, '', location.pathname)
  showCurrent('#about')
})

// ---------------------------------------------------------------------------
// 功能 2：滚动时更新按钮显隐与进度条
// ---------------------------------------------------------------------------
function handleScroll() {
  // 滚过大半屏（0.6 屏高）才显示。写比例而不是写死 500px，
  // 是因为手机和电脑的屏高差很多，写死的数字总有一种设备不合适。
  toTopButton?.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.6)
  updateProgress()
}

function updateProgress() {
  // 进度 = 已滚过的距离 ÷ 能滚的总距离
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  // 页面太短时 scrollable 可能是 0，除以 0 得到 NaN，进度条就再也不动了。
  // **凡是分母可能为 0 的地方，都要先挡一下。**
  const ratio = scrollable > 0 ? window.scrollY / scrollable : 0
  if (progressBar) progressBar.style.width = `${ratio * 100}%`
}

// 滚动一秒能触发几十次，**监听器越少越好**，所以两件事合在一个函数里。
window.addEventListener('scroll', handleScroll, { passive: true })

// ---------------------------------------------------------------------------
// 功能 3：导航高亮 + 右下角栏目名
// ---------------------------------------------------------------------------
function showCurrent(hash) {
  // 没有 # 时默认第一个栏目，否则刚打开页面什么都不高亮
  const current = hash || '#about'

  // Map.get 取不到时返回 undefined，用 || '' 兜底，别让页面上出现 "undefined"
  if (indicator) indicator.textContent = sectionNames.get(current) || ''

  navLinks.forEach(link => {
    const isCurrent = link.getAttribute('href') === current
    link.classList.toggle('is-current', isCurrent)
    // aria-current 告诉读屏软件「当前在这一项」。视觉上看不见，
    // 但在 F12 的 Elements 面板里能看到它跟着高亮移动。无障碍是基本要求。
    if (isCurrent) link.setAttribute('aria-current', 'location')
    else link.removeAttribute('aria-current')
  })
}

window.addEventListener('hashchange', () => showCurrent(location.hash))
// 「监听变化」和「一开始先做一次」是两件事，两件都要做：
// 别人把 index.html#skills 直接发给你，你打开时 hash 从头到尾没有「变化」过，
// hashchange 根本不会触发，只监听的话什么都不高亮。
showCurrent(location.hash)

// 首屏也把进度条算一次，否则刷新时浏览器已滚到中间，进度条却还是 0
updateProgress()
handleScroll()

// ---------------------------------------------------------------------------
// 以下两段用 IntersectionObserver，浏览器只在该「真的进出屏幕」时通知，
// 比在 scroll 里自己算位置省性能。
// ---------------------------------------------------------------------------

// 效果：不用点任何东西，滚到哪个栏目，导航和徽标自己跟着变。
// rootMargin 把判定区上下各收窄 45%，只剩屏幕中间一条 —— 意思是
// 「必须滚到屏幕中间才算进入这个栏目」。不收窄的话栏目刚露头就切换，
// 滚动时高亮会来回乱跳。
const spy = new IntersectionObserver(
  entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) showCurrent(`#${entry.target.id}`)
    }
  },
  { rootMargin: '-45% 0px -45% 0px' },
)
sections.forEach(section => spy.observe(section))

// 效果：内容不是「一开始全在那儿」，而是滚到哪里哪里浮现出来。
// 同一个 API 换一组参数就是另一种效果：
//   threshold: 0.15   露出 15% 就算进入（上面那个要滚到正中间）
//   进入后 unobserve   只淡入一次，往回滚不会再淡一遍
const reveal = new IntersectionObserver(
  (entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target) // 已显示过就不再盯着，省性能
    }
  },
  { threshold: 0.15 },
)
sections.forEach(section => reveal.observe(section))
