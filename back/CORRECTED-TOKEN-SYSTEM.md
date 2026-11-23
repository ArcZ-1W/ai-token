# KOREKSI: Token System & Pricing

## 🔄 SISTEM TOKEN YANG BENAR

### Token Structure:

**Pro Plan:**
- Purchase: 30,000 xoz (one-time)
- Daily Bonus: +2,000 xoz per day
- **PENTING:** Bonus dikonsumsi DULU, baru 30,000 xoz utama

**Ultra Coder:**
- Purchase: 50,000 xoz (one-time)  
- Daily Bonus: +5,000 xoz per day
- **PENTING:** Bonus dikonsumsi DULU, baru 50,000 xoz utama

---

## 📊 Cara Kerja

### Example Pro User:

**Day 1:**
```
Main Balance: 30,000 xoz
Daily Bonus: +2,000 xoz (claimed)
---
Total Available: 32,000 xoz

Usage Display:
├─ Daily Bonus: 2,000 xoz (use this first)
└─ Main Balance: 30,000 xoz (use after bonus depleted)
```

**After using 1,500 xoz:**
```
Daily Bonus: 500 xoz (left)
Main Balance: 30,000 xoz (untouched)
---
Total Available: 30,500 xoz
```

**After using 3,000 xoz total:**
```
Daily Bonus: 0 xoz (depleted)
Main Balance: 29,000 xoz (now consuming main)
---
Total Available: 29,000 xoz
```

**Day 2 (midnight):**
```
Daily Bonus: +2,000 xoz (refreshed!)
Main Balance: 29,000 xoz (unchanged)
---
Total Available: 31,000 xoz
```

---

## 💰 PRICING YANG BENAR

### Pro Plan:
- **Harga Asli:** ~~Rp 30.000~~
- **Harga Diskon:** **Rp 15.000**
- Token: 30,000 xoz + 2,000/hari
- Models: 4 (semua termasuk Extra)
- Plan AI: 5,000 token/hari

### Ultra Coder:
- **Harga Asli:** ~~Rp 55.000~~
- **Harga Diskon:** **Rp 40.000**
- Token: 50,000 xoz + 5,000/hari
- Models: 4 (semua termasuk Extra)
- Plan AI: 15,000 token/hari
- Pin: 3 obrolan

---

## 🎯 Token Consumption Logic

```javascript
// Pseudo-code
function deductTokens(cost) {
  const user = getCurrentUser();
  
  // Try to deduct from daily bonus FIRST
  if (user.dailyBonusRemaining > 0) {
    if (cost <= user.dailyBonusRemaining) {
      // Fully covered by daily bonus
      user.dailyBonusRemaining -= cost;
      return;
    } else {
      // Partially use bonus, rest from main
      const remainder = cost - user.dailyBonusRemaining;
      user.dailyBonusRemaining = 0;
      user.mainBalance -= remainder;
      return;
    }
  }
  
  // No daily bonus left, use main balance
  user.mainBalance -= cost;
}
```

---

## 📱 UI Display Update

### Token Display Should Show:

```
┌────────────────────────────────┐
│ Token Usage              ↻     │
├────────────────────────────────┤
│ Daily Bonus: 1,500 xoz         │
│ Main Balance: 30,000 xoz       │
│ ─────────────────────────────  │
│ Total: 31,500 xoz              │
├────────────────────────────────┤
│ ▓▓▓▓▓▓▓░░░░░░░░░  45%          │
├────────────────────────────────┤
│ 🎁 +2,000 xoz daily (Pro)      │
└────────────────────────────────┘
```

### Progress Bar:
- Calculate based on MAIN balance only
- Daily bonus is "extra" on top
- When daily bonus depleted, only main balance shown

---

## 🔄 Daily Reset Logic

```javascript
async function checkDailyBonus() {
  const user = getCurrentUser();
  const today = new Date().toISOString().split('T')[0];
  
  // Pro: +2,000 xoz
  // Ultra: +5,000 xoz
  const bonusAmount = user.plan === 'ultra' ? 5000 : 2000;
  
  // Check if already claimed today
  if (user.lastBonusClaim === today) {
    return; // Already claimed
  }
  
  // Reset daily bonus
  user.dailyBonusRemaining = bonusAmount;
  user.lastBonusClaim = today;
  
  // Save to database
  await updateUserBonus(user);
  
  // Show notification
  showNotification(`🎁 Daily bonus: +${bonusAmount} xoz!`);
}
```

---

## 📋 Database Schema Update

```sql
-- Add columns for daily bonus tracking
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS
  daily_bonus_remaining INTEGER DEFAULT 0;
  
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS
  last_bonus_claim DATE;

-- Main token balance (unchanged)
-- limit_auto = main balance (30,000 or 50,000)
```

---

## 🔄 Summary of Changes Needed

1. **Landing Page Pricing:**
   - Pro: ~~30k~~ → **15k**
   - Ultra: ~~55k~~ → **40k**

2. **Token Display:**
   - Show daily bonus separately
   - Show main balance separately
   - Progress bar based on main only

3. **Token Consumption:**
   - Deduct from daily bonus FIRST
   - Then deduct from main balance

4. **Daily Bonus Amount:**
   - Pro: 2,000 xoz (not 2,500)
   - Ultra: 5,000 xoz (not 2,500)

---

Saya akan update files sekarang!
