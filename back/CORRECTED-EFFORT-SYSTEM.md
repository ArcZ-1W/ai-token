# Xozen AI - Corrected Effort Level System

## ✅ KOREKSI SISTEM

### 💰 Token System (REVISED)

**Plus & Pro:**
- One-time purchase
- NO daily refill
- Habis = habis, harus beli lagi

**Ultra Coder:**
- One-time purchase: 50,000 xoz
- **PLUS: +2,500 xoz per hari** (daily bonus)
- Refill bonus setiap hari, bukan reset ke full

### Example Ultra Coder Usage:
```
Day 1:
- Start: 50,000 xoz
- Used: 10,000 xoz
- Remaining: 40,000 xoz

Day 2 (midnight):
- Remaining: 40,000 xoz
- Daily Bonus: +2,500 xoz
- New Total: 42,500 xoz

Day 3 (after using 5,000):
- Remaining: 37,500 xoz
- Daily Bonus: +2,500 xoz
- New Total: 40,000 xoz
```

---

## 🤖 Model Mapping (CORRECTED)

Sesuai 4 model yang sudah ditentukan:

```javascript
const EFFORT_MODEL_MAP = {
  low: 'xozenlite',        // XozenLite (minimumLite) - All Plan
  medium: 'xozen-code',    // Xozen Code (auto) - All Plan
  high: 'xozen-vox',       // Xozen Vox (mimo-v2.6-pro) vision - All Plan
  extra: 'xozen-thinking'  // Xozen Thinking (glm-5.3-flashx-mod) - Pro & Ultra only
};
```

### Model Restrictions:
- **Low, Medium, High**: Available for ALL plans (Plus, Pro, Ultra)
- **Extra**: Only for Pro & Ultra Coder

---

## 🎯 Token Calculation (UNCHANGED)

Character-based dengan randomizer:
```javascript
1-10 chars:  200 xoz × effort × random(±10%)
11-25 chars: 350 xoz × effort × random(±10%)
26-50 chars: 500 xoz × effort × random(±10%)
51+ chars:   700 xoz × effort × random(±10%)

Effort multipliers:
- Low (XozenLite):      1x
- Medium (Xozen Code):  1.5x
- High (Xozen Vox):     2x
- Extra (Xozen Thinking): 2.5x
```

---

## 💾 Database Schema Update

```sql
-- Member usage table
ALTER TABLE member_usage ADD COLUMN IF NOT EXISTS 
  daily_bonus_claimed_at DATE;

-- Ultra Coder gets 2500 xoz daily bonus
CREATE OR REPLACE FUNCTION check_daily_bonus(user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  user_plan TEXT;
  last_claim DATE;
  today DATE;
  bonus_amount INTEGER := 2500;
BEGIN
  -- Get user plan and last claim date
  SELECT plan, daily_bonus_claimed_at 
  INTO user_plan, last_claim
  FROM member_plans
  WHERE username = user_id;
  
  -- Only Ultra Coder gets bonus
  IF user_plan != 'ultra' THEN
    RETURN 0;
  END IF;
  
  today := CURRENT_DATE;
  
  -- Check if already claimed today
  IF last_claim = today THEN
    RETURN 0;
  END IF;
  
  -- Give bonus
  UPDATE accounts 
  SET limit_auto = limit_auto + bonus_amount
  WHERE username = user_id;
  
  -- Update claim date
  UPDATE member_plans 
  SET daily_bonus_claimed_at = today
  WHERE username = user_id;
  
  RETURN bonus_amount;
END;
$$ LANGUAGE plpgsql;
```

---

## 📱 Frontend Implementation (NO VERCEL API NEEDED)

Karena pakai Supabase, tidak perlu Vercel API. Langsung dari frontend:

```javascript
// Token Calculator (Frontend Only)
class TokenCalculator {
  constructor() {
    this.multipliers = {
      low: 1.0,      // XozenLite
      medium: 1.5,   // Xozen Code
      high: 2.0,     // Xozen Vox
      extra: 2.5     // Xozen Thinking
    };
  }
  
  getBaseCost(text) {
    const length = text.trim().length;
    if (length === 0) return 0;
    if (length <= 10) return 200;
    if (length <= 25) return 350;
    if (length <= 50) return 500;
    return 700;
  }
  
  addRandomVariation(cost) {
    const variation = cost * 0.1;
    const randomOffset = (Math.random() * variation * 2) - variation;
    return cost + randomOffset;
  }
  
  calculate(text, effortLevel = 'low') {
    const baseCost = this.getBaseCost(text);
    if (baseCost === 0) return 0;
    
    const withVariation = this.addRandomVariation(baseCost);
    const multiplier = this.multipliers[effortLevel] || 1.0;
    return Math.round(withVariation * multiplier);
  }
}

// Daily Bonus Check (on app load)
async function checkDailyBonus() {
  const user = getCurrentUser();
  if (user.plan !== 'ultra') return;
  
  const { data, error } = await supabase.rpc('check_daily_bonus', {
    user_id: user.username
  });
  
  if (data > 0) {
    showNotification(`🎁 Daily bonus: +${data} xoz tokens!`);
    refreshTokenDisplay();
  }
}

// Usage Update After Send
async function updateUsageAfterSend(cost) {
  const user = getCurrentUser();
  
  // Deduct tokens
  const newUsage = user.currentUsage + cost;
  
  await supabase
    .from('accounts')
    .update({ limit_auto: user.limit_auto - cost })
    .eq('username', user.username);
  
  // Update display
  updateProgressBar(newUsage, user.totalTokens);
}
```

---

## 🎨 UI Updates Needed

### 1. Effort Level Picker
```html
<div class="effort-picker">
  <button class="effort-btn" data-level="low">
    <span class="effort-icon">⚡</span>
    <span class="effort-name">Low</span>
    <span class="effort-desc">XozenLite · 1x</span>
  </button>
  
  <button class="effort-btn" data-level="medium">
    <span class="effort-icon">🔧</span>
    <span class="effort-name">Medium</span>
    <span class="effort-desc">Xozen Code · 1.5x</span>
  </button>
  
  <button class="effort-btn" data-level="high">
    <span class="effort-icon">🚀</span>
    <span class="effort-name">High</span>
    <span class="effort-desc">Xozen Vox · 2x</span>
  </button>
  
  <button class="effort-btn" data-level="extra" data-plan="pro,ultra">
    <span class="effort-icon">💎</span>
    <span class="effort-name">Extra</span>
    <span class="effort-desc">Xozen Thinking · 2.5x</span>
    <span class="effort-badge">Pro+</span>
  </button>
</div>
```

### 2. Usage Progress Bar
```html
<div class="usage-card">
  <div class="usage-header">
    <span>Token Usage</span>
    <button class="refresh-btn" onclick="refreshTokens()">↻</button>
  </div>
  
  <div class="usage-bar-container">
    <div class="usage-bar" id="usageBar" style="width: 45%">
      <span class="usage-percent">45%</span>
    </div>
  </div>
  
  <div class="usage-details">
    <div class="usage-stat">
      <span class="label">Used</span>
      <span class="value" id="usedTokens">13,500</span>
    </div>
    <div class="usage-stat">
      <span class="label">Available</span>
      <span class="value" id="availableTokens">16,500</span>
    </div>
  </div>
  
  <!-- Only show for Ultra Coder -->
  <div class="daily-bonus" data-plan="ultra">
    <span>🎁 +2,500 xoz daily bonus</span>
  </div>
</div>
```

---

## 🔄 Implementation Flow

### On App Load:
1. Check user plan
2. If Ultra Coder: Check daily bonus
3. Display usage progress bar
4. Set default effort: Low

### On Message Send:
1. Calculate cost based on:
   - Character count
   - Effort level
   - Random variation
2. Check if enough tokens
3. Send to AI (model based on effort)
4. Deduct tokens from user
5. Update progress bar

### Model Selection (Backend/API):
```javascript
// Your existing API should handle this
const modelMap = {
  low: 'xozenlite',
  medium: 'xozen-code', 
  high: 'xozen-vox',
  extra: 'xozen-thinking'
};

// When calling AI API
const model = modelMap[effortLevel];
const response = await fetch('YOUR_AI_ENDPOINT', {
  method: 'POST',
  body: JSON.stringify({
    model: model,
    message: userMessage
  })
});
```

---

## 📊 Progress Bar States

```css
/* 0-50% - Good (Green) */
.usage-bar[data-level="good"] {
  background: linear-gradient(90deg, #4ade80, #22c55e);
}

/* 51-80% - Warning (Yellow) */
.usage-bar[data-level="warning"] {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}

/* 81-95% - Danger (Orange) */
.usage-bar[data-level="danger"] {
  background: linear-gradient(90deg, #fb923c, #ea580c);
}

/* 96-100% - Critical (Red) */
.usage-bar[data-level="critical"] {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}
```

---

## ✅ Summary

**TIDAK PAKAI VERCEL API** karena:
- Sudah pakai Supabase
- Token calculation di frontend
- Model selection di backend API yang sudah ada

**Yang perlu diubah:**
1. Frontend UI (ai/index.html)
   - Ganti model dropdown → effort picker
   - Ganti token display → progress bar
   - Add token calculator
   - Add daily bonus check

2. Supabase Functions
   - Add daily bonus function
   - Track bonus claim date

3. Landing page
   - Update copy untuk Ultra Coder (+2,500/day)

---

**Siap implement sekarang?** 🚀
