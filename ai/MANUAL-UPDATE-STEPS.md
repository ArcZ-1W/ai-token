# Manual Update Instructions for ai/index.html

## File sudah di-backup ke: ai/index-old.html

## Changes Required:

### 1. FIND (Line ~1158):
```html
<div class="dd" id="dd"><button type="button" class="dd-btn" id="ddBtn" aria-haspopup="dialog" aria-expanded="false" aria-label="Pilih model AI"><span id="ddLabel">Xozen AI</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button></div>
```

### REPLACE WITH:
```html
<!-- Effort Level Picker -->
<div class="effort-picker" id="effortPicker">
  <button type="button" class="effort-btn" id="effortBtn" aria-haspopup="true" aria-expanded="false" aria-label="Select effort level">
    <span id="effortLabel">Low Effort</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  
  <div class="effort-menu" id="effortMenu" hidden>
    <div class="effort-header">
      <h4>Choose Effort Level</h4>
      <p>Select processing power for your task</p>
    </div>
    
    <button class="effort-option active" data-level="low" data-model="xozenlite">
      <div class="effort-icon">⚡</div>
      <div class="effort-info">
        <strong>Low</strong>
        <span>XozenLite · Quick · 1x</span>
      </div>
      <div class="effort-check">✓</div>
    </button>
    
    <button class="effort-option" data-level="medium" data-model="xozen-code">
      <div class="effort-icon">🔧</div>
      <div class="effort-info">
        <strong>Medium</strong>
        <span>Xozen Code · Auto · 1.5x</span>
      </div>
      <div class="effort-check">✓</div>
    </button>
    
    <button class="effort-option" data-level="high" data-model="xozen-vox">
      <div class="effort-icon">🚀</div>
      <div class="effort-info">
        <strong>High</strong>
        <span>Xozen Vox · Vision · 2x</span>
      </div>
      <div class="effort-check">✓</div>
    </button>
    
    <button class="effort-option" data-level="extra" data-model="xozen-thinking" data-plan-required="pro,ultra">
      <div class="effort-icon">💎</div>
      <div class="effort-info">
        <strong>Extra</strong>
        <span>Xozen Thinking · Max · 2.5x</span>
      </div>
      <div class="effort-badge">Pro+</div>
      <div class="effort-check">✓</div>
    </button>
  </div>
</div>
```

---

### 2. ADD CSS (before closing </style> tag):

Copy entire content from: `ai/effort-picker-css.css`

---

### 3. ADD JavaScript (before closing </body> tag):

Copy entire content from: `ai/effort-picker-js.html`

---

### 4. FIND the qcard section (Line ~1136):
```html
<div class="qcard" id="qCard">
```

### REPLACE entire qcard div with:
```html
<div class="usage-card">
  <div class="usage-header">
    <span>Token Usage</span>
    <button class="usage-refresh" id="usageRefresh" onclick="window.xozenEffort && window.xozenEffort.checkDailyBonus()">↻</button>
  </div>
  
  <div class="usage-bar-container">
    <div class="usage-bar" id="usageBar" style="width: 0%" data-level="good">
      <span class="usage-percent" id="usagePercent">0%</span>
    </div>
  </div>
  
  <div class="usage-details">
    <div class="usage-stat">
      <span class="label">Used</span>
      <span class="value" id="usedTokens">0</span>
    </div>
    <div class="usage-stat">
      <span class="label">Available</span>
      <span class="value" id="availableTokens">0</span>
    </div>
  </div>
  
  <div class="daily-bonus" id="dailyBonus" hidden>
    🎁 +2,500 xoz daily bonus
  </div>
</div>
```

---

## OR Use Find & Replace in Your Editor:

1. Open `ai/index.html` in VS Code / Notepad++
2. Use multi-line find & replace
3. Follow instructions above

---

## Recommended: Use a diff tool
- Beyond Compare
- WinMerge
- VS Code Compare

Compare `ai/index-old.html` with updated version after changes.

---

Easier option: Saya bisa bikinin script Python untuk auto-replace?
