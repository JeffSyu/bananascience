<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>香蕉老師的科學互動實驗室</title>
  <link rel="stylesheet" href="./style.css" />
  <script src="./main.js" defer></script>
</head>
<body>

  <!-- 標頭區：固定於畫面最上方，向下滾動時自動向上縮小、靠左並隱藏小標題 -->
  <div class="header-spacer">
    <header class="site-header" id="siteHeader">
      <div class="header-inner">
        <h1>香蕉老師的科學互動實驗室</h1>
        <p class="subtitle">香蕉老師的教學模擬分享，透過即時互動與視覺化，讓物理化學更具象</p>
      </div>
    </header>
  </div>

  <!-- 主內容雙欄容器 -->
  <div class="layout-container">

    <!-- 左側篩選欄 -->
    <aside class="filter-sidebar" aria-label="模擬篩選條件">
      <div class="sidebar-search">
        <input
          type="search"
          id="searchInput"
          class="search-input"
          placeholder="搜尋模擬名稱或關鍵字..."
          aria-label="搜尋模擬名稱或關鍵字"
        />
      </div>

      <!-- 篩選群組 1：學科領域 -->
      <div class="filter-group">
        <button type="button" class="group-toggle" aria-expanded="true" onclick="toggleGroup(this)">
          <span>學科領域</span>
          <span class="chevron">▼</span>
        </button>
        <div class="group-collapse">
          <div class="group-options">
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="domain" value="physics" data-label="物理" />
                <span>物理</span>
              </span>
              <span class="item-count" data-count-for="physics">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="domain" value="chemistry" data-label="化學" />
                <span>化學</span>
              </span>
              <span class="item-count" data-count-for="chemistry">(0)</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 篩選群組 2：單元主題 -->
      <div class="filter-group">
        <button type="button" class="group-toggle" aria-expanded="true" onclick="toggleGroup(this)">
          <span>單元主題</span>
          <span class="chevron">▼</span>
        </button>
        <div class="group-collapse">
          <div class="group-options">
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="topic" value="kinematics" data-label="力學與運動" />
                <span>力學與運動</span>
              </span>
              <span class="item-count" data-count-for="kinematics">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="topic" value="wave" data-label="波動與聲音" />
                <span>波動與聲音</span>
              </span>
              <span class="item-count" data-count-for="wave">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="topic" value="optics" data-label="光學與視覺" />
                <span>光學與視覺</span>
              </span>
              <span class="item-count" data-count-for="optics">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="topic" value="electricity" data-label="電磁與電路" />
                <span>電磁與電路</span>
              </span>
              <span class="item-count" data-count-for="electricity">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="topic" value="matter" data-label="物質與原子" />
                <span>物質與原子</span>
              </span>
              <span class="item-count" data-count-for="matter">(0)</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 篩選群組 3：適用年級 -->
      <div class="filter-group">
        <button type="button" class="group-toggle" aria-expanded="true" onclick="toggleGroup(this)">
          <span>適用年級</span>
          <span class="chevron">▼</span>
        </button>
        <div class="group-collapse">
          <div class="group-options">
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="grade" value="grade_7" data-label="七年級" />
                <span>七年級</span>
              </span>
              <span class="item-count" data-count-for="grade_7">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="grade" value="grade_8" data-label="八年級" />
                <span>八年級</span>
              </span>
              <span class="item-count" data-count-for="grade_8">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="grade" value="grade_9" data-label="九年級" />
                <span>九年級</span>
              </span>
              <span class="item-count" data-count-for="grade_9">(0)</span>
            </label>
            <label class="checkbox-label">
              <span class="checkbox-left">
                <input type="checkbox" name="grade" value="gifted" data-label="資優加深加廣" />
                <span>資優</span>
              </span>
              <span class="item-count" data-count-for="gifted">(0)</span>
            </label>
          </div>
        </div>
      </div>
    </aside>

    <!-- 右側模擬教材清單 -->
    <main class="catalog-main">
      <!-- 動態篩選條件移除列（左）與結果統計（右） -->
      <div class="catalog-toolbar">
        <div class="active-filters" id="activeFilters"></div>
        <div class="result-stats" id="resultStats">載入模擬中...</div>
      </div>

      <!-- 模擬教材卡片網格（由 main.js 讀取 sims-data.json 自動生成） -->
      <div class="sim-grid" id="simGrid"></div>

      <!-- 無符合篩選結果時的提示畫面 -->
      <div class="empty-state hidden" id="emptyState">
        <p id="emptyStateText">找不到同時符合目前篩選條件的模擬。</p>
        <button type="button" class="reset-btn" id="resetFilterBtn" onclick="clearAllFilters()">清除所有篩選條件</button>
      </div>
    </main>

  </div>

  <footer>
    <p>© BananScience 香蕉老師的科學互動實驗室 · Powered by AI Studio &amp; GitHub Actions</p>
  </footer>

</body>
</html>
