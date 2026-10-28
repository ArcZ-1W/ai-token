# Xozen AI - Implementation Guide: Effort Level System

## 📦 Files Created

### 1. **Documentation**
- `EFFORT-LEVEL-SYSTEM.md` - Original concept
- `TOKEN-CALCULATION-VERCEL.md` - Token calculation (not used - no Vercel API)
- `CORRECTED-EFFORT-SYSTEM.md` - Final corrected system

### 2. **AI App Components** (in `/ai` folder)
- `effort-picker-html.html` - HTML snippet untuk effort picker
- `effort-picker-css.css` - CSS styles untuk effort system
- `effort-picker-js.html` - JavaScript implementation

### 3. **Landing Page**
- `index.html` - Updated (hero text + Ultra Coder bonus)

---

## ✅ What's Done

1. ✅ Landing page hero updated - hapus "menyatukan kimi, glm..." 
2. ✅ Landing page Ultra Coder - tambah "+2,500 xoz/hari"
3. ✅ Created effort picker HTML component
4. ✅ Created effort picker CSS styles
5. ✅ Created JavaScript with token calculator

---

## 🔧 What You Need To Do

### Step 1: Update `ai/index.html`

**Find and REPLACE the model dropdown:**

```html
<!-- FIND THIS (around line 1158): -->
<div class="dd" id="dd">
  <button type="button" class="dd-btn" id="ddBtn"...>
    <span id="ddLabel">Xozen AI</span>
    ...
  </button>
</div>

<!-- REPLACE WITH: -->
```
Copy content from: `ai/effort-picker-html.html`

---

**Find and REPLACE the token display:**

```html
<!-- FIND THIS (around line 150-200, search for "qcard"): -->
<div class="qcard" id="qCard">
  <div class="q-head">
    <span id="qTitle">Sisa pemakaian...</span>
    ...
  </div>
  ...
</div>

<!-- REPLACE WITH: -->
<div class="usage-card">
  <div class="usage-header">
    <span>Token Usage</span>
    <button class="usage-refresh" onclick="xozenEffort.checkDailyBonus()">↻</button>
  </div>
  
  <div class="usage-bar-container">
    <div class="usage-bar" id="usageBar" style="width: 45%" data-level="good">
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
  <div class="daily-bonus" hidden>
    🎁 +2,500 xoz daily bonus
  </div>
</div>
```

---

**ADD CSS to the `<style>` section:**

Copy all content from: `ai/effort-picker-css.css`
Paste it at the end of your existing `<style>` block

---

**ADD JavaScript before `</body>`:**

Copy all content from: `ai/effort-picker-js.html`
Paste it before the closing `</body>` tag

---

### Step 2: Update Your Send Message Function

Find your existing message send function and modify it:

```javascript
// Your existing send function
async function sendMessage() {
  const message = textarea.value.trim();
  if (!message) return;
  
  // ===== ADD THIS =====
  const effortLevel = window.xozenEffort.getCurrentLevel();
  const model = window.xozenEffort.getCurrentModel();
  
  // Calculate cost
  const cost = window.xozenEffort.calculateCost(message);
  
  // Check balance
  const user = getCurrentUser(); // Your user object
  const available = user.totalTokens - user.usedTokens;
  
  if (cost > available) {
    alert('Token tidak cukup! Upgrade paket atau tunggu daily bonus.');
    return;
  }
  // ===== END ADD =====
  
  // Send to AI with model
  const response = await callYourAI(message, model);
  
  // ===== ADD THIS =====
  // Calculate AI response cost
  const aiCost = window.tokenCalc.calculate(response, effortLevel);
  const totalCost = cost + aiCost;
  
  // Deduct tokens
  window.xozenEffort.deductTokens(totalCost);
  // ===== END ADD =====
  
  // Display response...
}
```

---

### Step 3: Update User Plan Check

Add this to your login/init function:

```javascript
function initUser(user) {
  // Your existing init code...
  
  // ===== ADD THIS =====
  // Check if user can use Extra effort
  const extraOption = document.querySelector('[data-level="extra"]');
  if (extraOption) {
    if (user.plan === 'pro' || user.plan === 'ultra') {
      extraOption.dataset.allowed = 'true';
    }
  }
  
  // Show daily bonus for Ultra Coder
  const bonusEl = document.querySelector('.daily-bonus');
  if (bonusEl) {
    bonusEl.hidden = user.plan !== 'ultra';
  }
  
  // Update usage display
  window.xozenEffort.updateUsageDisplay(user.usedTokens, user.totalTokens);
  // ===== END ADD =====
}
```

---

### Step 4: Create Supabase Function (Optional - for daily bonus)

If you want auto daily bonus for Ultra Coder:

```sql
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION check_daily_bonus(user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  user_plan TEXT;
  last_claim DATE;
  today DATE;
  bonus_amount INTEGER := 2500;
  current_tokens INTEGER;
BEGIN
  -- Get user info
  SELECT plan, daily_bonus_claimed_at, limit_auto
  INTO user_plan, last_claim, current_tokens
  FROM member_plans mp
  JOIN accounts a ON a.username = mp.username
  WHERE mp.username = user_id;
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add column if not exists
ALTER TABLE member_plans 
ADD COLUMN IF NOT EXISTS daily_bonus_claimed_at DATE;

-- Grant access
GRANT EXECUTE ON FUNCTION check_daily_bonus(TEXT) TO authenticated, anon;
```

Then in your frontend:

```javascript
// Call this function on app load
async function checkDailyBonus() {
  const { data, error } = await supabase.rpc('check_daily_bonus', {
    user_id: currentUser.username
  });
  
  if (data && data > 0) {
    alert(`🎁 Daily bonus claimed: +${data} xoz tokens!`);
    // Refresh usage display
  }
}
```

---

## 📊 Testing Checklist

After implementation, test:

- [ ] Effort picker opens/closes
- [ ] Can select Low, Medium, High
- [ ] Extra is locked for Plus plan (shows alert)
- [ ] Extra works for Pro/Ultra
- [ ] Usage bar shows percentage
- [ ] Usage bar changes color (green→yellow→orange→red)
- [ ] Token calculation works (test with different message lengths)
- [ ] Daily bonus shows for Ultra Coder only
- [ ] Daily bonus can be claimed once per day
- [ ] Messages send with correct model based on effort

---

## 🎯 Summary

**Model Mapping:**
- Low → XozenLite (1x)
- Medium → Xozen Code (1.5x)
- High → Xozen Vox (2x)
- Extra → Xozen Thinking (2.5x) - Pro/Ultra only

**Token Calculation:**
- 1-10 chars: 200 xoz
- 11-25 chars: 350 xoz
- 26-50 chars: 500 xoz
- 51+ chars: 700 xoz
- × effort multiplier
- ± 10% random variation

**Ultra Coder Bonus:**
- +2,500 xoz per day
- Auto check on app load
- Shows notification when claimed

---

## 🚀 You're Ready!

All components are created. Just:
1. Copy HTML snippets to `ai/index.html`
2. Copy CSS to `<style>` section
3. Copy JavaScript before `</body>`
4. Update your send function
5. (Optional) Add Supabase function for daily bonus

**Need help with integration? Let me know!** 🎉
