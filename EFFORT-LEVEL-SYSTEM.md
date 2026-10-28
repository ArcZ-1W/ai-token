# Xozen AI - Effort Level System Design

## 🎯 Konsep Baru: Explanation Expert dengan Effort Level

### Perubahan dari Pilih Model → Effort Level

**BEFORE (Old System):**
- User memilih model (Xozen AI, Kimi, GLM, DeepSeek, dll)
- Dropdown dengan banyak pilihan model
- User harus tahu model mana yang cocok

**AFTER (New System):**
- User memilih Effort Level: Low, Medium, High, Extra
- Sistem otomatis pilih model terbaik berdasarkan effort
- Lebih simple dan intuitif

---

## 📊 Effort Level System

### Effort Levels & Multiplier

| Level | Multiplier | Cost | Use Case |
|-------|-----------|------|----------|
| **Low** | 1x | Normal | Chat sederhana, Q&A cepat |
| **Medium** | 1.5x | +50% | Explain code, debug ringan |
| **High** | 2x | +100% | Complex coding, refactoring |
| **Extra** | 2.5x | +150% | Architectural design, optimization |

### Model Mapping (Backend)

```javascript
const EFFORT_MODEL_MAP = {
  low: 'xozenlite',      // Lightweight untuk chat cepat
  medium: 'xozen-code',  // Auto coding
  high: 'xozen-vox',     // Vision + advanced
  extra: 'xozen-thinking' // Thinking model (Pro/Ultra only)
};
```

---

## 🎨 UI Changes

### 1. Remove Model Dropdown
```html
<!-- BEFORE -->
<button class="dd-btn">
  <span>Xozen AI</span>
  <svg>...</svg>
</button>

<!-- AFTER -->
<button class="effort-btn">
  <span>Low Effort</span>
  <svg>...</svg>
</button>
```

### 2. Effort Level Picker
```html
<div class="effort-menu">
  <div class="effort-header">
    <h4>Choose Effort Level</h4>
    <p>How much processing power do you need?</p>
  </div>
  
  <button class="effort-option" data-level="low">
    <div class="effort-icon">⚡</div>
    <div class="effort-info">
      <strong>Low</strong>
      <span>Quick responses · 1x cost</span>
    </div>
    <div class="effort-badge">Fast</div>
  </button>
  
  <button class="effort-option" data-level="medium">
    <div class="effort-icon">🔧</div>
    <div class="effort-info">
      <strong>Medium</strong>
      <span>Balanced · 1.5x cost</span>
    </div>
  </button>
  
  <button class="effort-option" data-level="high">
    <div class="effort-icon">🚀</div>
    <div class="effort-info">
      <strong>High</strong>
      <span>Complex tasks · 2x cost</span>
    </div>
  </button>
  
  <button class="effort-option" data-level="extra" data-plan-required="pro">
    <div class="effort-icon">💎</div>
    <div class="effort-info">
      <strong>Extra</strong>
      <span>Maximum power · 2.5x cost</span>
    </div>
    <div class="effort-badge pro">Pro+</div>
  </button>
</div>
```

---

## 📈 Token Usage Display

### Old System
```
Sisa: 15,234 xoz token
Paket: Pro · Aktif hingga 15 Nov
```

### New System - Progress Bar

```html
<div class="usage-card">
  <div class="usage-header">
    <span>Token Usage</span>
    <button class="refresh-btn">↻</button>
  </div>
  
  <div class="usage-bar-container">
    <div class="usage-bar" style="width: 45%">
      <span class="usage-percent">45%</span>
    </div>
  </div>
  
  <div class="usage-details">
    <div class="usage-stat">
      <span class="label">Used</span>
      <span class="value">13,500 tokens</span>
    </div>
    <div class="usage-stat">
      <span class="label">Total</span>
      <span class="value">30,000 tokens</span>
    </div>
  </div>
  
  <!-- Only for Ultra Coder -->
  <div class="refill-info" data-plan="ultra">
    <span>⏱️ Refills daily at midnight</span>
  </div>
  
  <!-- For other plans -->
  <div class="refill-info" data-plan="plus">
    <span>💡 Upgrade to Ultra Coder for daily refills</span>
  </div>
</div>
```

### Visual States

**0-50% Used (Green):**
```css
.usage-bar { background: linear-gradient(90deg, #4ade80, #22c55e); }
```

**51-80% Used (Yellow):**
```css
.usage-bar { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
```

**81-99% Used (Orange):**
```css
.usage-bar { background: linear-gradient(90deg, #fb923c, #ea580c); }
```

**100% Used (Red):**
```css
.usage-bar { background: linear-gradient(90deg, #ef4444, #dc2626); }
.usage-card { border-color: #ef4444; }
```

---

## 💾 Backend Calculation

### Token Calculation Example

```javascript
// Base cost per message
const BASE_COST = 1000; // tokens

// User selects "High" effort
const EFFORT_MULTIPLIER = 2.0;

// Final cost
const ACTUAL_COST = BASE_COST * EFFORT_MULTIPLIER;
// = 1000 * 2.0 = 2000 tokens

// Update usage
currentUsage += ACTUAL_COST;
percentage = (currentUsage / totalTokens) * 100;
```

### Refill Logic

```javascript
// Ultra Coder Plan
if (plan === 'ultra') {
  // Check if new day
  const lastRefill = user.lastRefillDate;
  const now = new Date();
  
  if (now.getDate() !== lastRefill.getDate()) {
    // Reset to full
    user.currentUsage = 0;
    user.lastRefillDate = now;
  }
}

// Other plans (Plus, Pro)
// No daily refill - one time purchase
```

---

## 🎨 CSS Styles

```css
/* Effort Button */
.effort-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  background: var(--glass-strong);
  border: 1px solid var(--glass-edge);
  border-radius: 12px;
  color: var(--ink);
  font-size: 13.5px;
  cursor: pointer;
  transition: all 0.15s;
}

.effort-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

/* Effort Menu */
.effort-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 320px;
  padding: 16px;
  background: linear-gradient(145deg, rgba(40, 44, 80, 0.96), rgba(22, 25, 50, 0.97));
  border: 1px solid var(--glass-edge);
  border-radius: 16px;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
  animation: slideIn 0.2s ease;
}

.effort-header {
  margin-bottom: 16px;
}

.effort-header h4 {
  font-size: 15px;
  font-weight: 650;
  margin: 0 0 4px;
}

.effort-header p {
  font-size: 12px;
  color: var(--ink-dim);
  margin: 0;
}

/* Effort Options */
.effort-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.effort-option:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(2px);
}

.effort-option.active {
  background: rgba(143, 123, 255, 0.15);
  border-color: var(--accent);
}

.effort-option[data-plan-required]:not([data-allowed]) {
  opacity: 0.5;
  cursor: not-allowed;
}

.effort-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.effort-info {
  flex: 1;
  text-align: left;
}

.effort-info strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}

.effort-info span {
  font-size: 12px;
  color: var(--ink-dim);
}

.effort-badge {
  padding: 4px 8px;
  background: rgba(53, 214, 255, 0.15);
  color: var(--accent-2);
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.effort-badge.pro {
  background: rgba(143, 123, 255, 0.15);
  color: var(--accent);
}

/* Usage Card */
.usage-card {
  padding: 16px;
  background: rgba(8, 11, 24, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  margin-bottom: 12px;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.usage-header span {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-dim);
}

.refresh-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--ink-dim);
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 16px;
  transition: all 0.15s;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--ink);
}

.usage-bar-container {
  height: 32px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  margin-bottom: 12px;
}

.usage-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 12px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 20px rgba(143, 123, 255, 0.4);
}

/* Color variants */
.usage-bar[data-level="warning"] {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.4);
}

.usage-bar[data-level="danger"] {
  background: linear-gradient(90deg, #ef4444, #dc2626);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
}

.usage-percent {
  font-size: 13px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.usage-details {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.usage-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.usage-stat .label {
  font-size: 11px;
  color: var(--ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.usage-stat .value {
  font-size: 14px;
  font-weight: 650;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.refill-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: var(--ink-dim);
  text-align: center;
}

.refill-info[data-plan="ultra"] {
  color: var(--accent-2);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 🔧 Implementation Steps

1. **Update HTML Structure**
   - Replace model dropdown with effort button
   - Add effort menu HTML
   - Update usage card UI

2. **Update JavaScript**
   - Remove model selection logic
   - Add effort level state management
   - Update API calls with effort multiplier
   - Calculate token usage with multiplier

3. **Update API Backend**
   - Map effort level to model
   - Apply multiplier to cost calculation
   - Handle refill logic for Ultra Coder

4. **Update Database**
   - Add `effort_level` field (default: 'low')
   - Add `last_refill_date` for Ultra Coder
   - Track daily usage separately

---

## 📱 User Flow

1. **User opens chat**
   - Sees current usage bar (e.g., 45%)
   - Default effort: Low

2. **User clicks effort button**
   - Menu opens with 4 options
   - Current selection highlighted
   - Extra locked if not Pro/Ultra

3. **User selects High effort**
   - Button updates: "High Effort"
   - No warning about cost (simplified UX)

4. **User sends message**
   - Backend calculates: 1000 * 2.0 = 2000 tokens
   - Usage bar updates: 45% → 51%

5. **Usage reaches 100%**
   - Ultra Coder: "Refills at midnight"
   - Others: "Upgrade or purchase more tokens"

---

## ✅ Benefits

1. **Simpler UX**: 4 choices vs 30+ models
2. **Clear value**: User understands what they're paying for
3. **No confusion**: System picks best model
4. **Progressive disclosure**: Extra only for Pro+
5. **Visual feedback**: Progress bar > numbers

---

## 🚀 Next: Implementation

Ready to implement? I can create the full updated HTML/CSS/JS files!
