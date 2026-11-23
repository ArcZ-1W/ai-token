# Xozen AI - Token Calculation System (Vercel)

## 💰 Token Cost Formula

### Character-based Calculation

```javascript
// Base cost by character count
function calculateBaseCost(text) {
  const length = text.length;
  
  if (length <= 10) return 200;
  if (length <= 25) return 350;
  if (length <= 50) return 500;
  return 700; // 51+
}

// Add randomizer for natural variation
function addRandomizer(baseCost) {
  // ±10% variation
  const variation = baseCost * 0.1;
  const randomOffset = (Math.random() * variation * 2) - variation;
  return Math.round(baseCost + randomOffset);
}

// Apply effort multiplier
function calculateFinalCost(text, effortLevel) {
  const baseCost = calculateBaseCost(text);
  const randomized = addRandomizer(baseCost);
  
  const multipliers = {
    low: 1.0,
    medium: 1.5,
    high: 2.0,
    extra: 2.5
  };
  
  const multiplier = multipliers[effortLevel] || 1.0;
  return Math.round(randomized * multiplier);
}
```

## 📊 Examples

### Low Effort (1x)
```
"Hi" (2 chars)
Base: 200 xoz
Random: 180-220 xoz
Final: ~200 xoz

"Explain this code please" (24 chars)
Base: 350 xoz
Random: 315-385 xoz
Final: ~350 xoz

"Can you help me debug this JavaScript function?" (48 chars)
Base: 500 xoz
Random: 450-550 xoz
Final: ~500 xoz

"I need help with a complex React component that has multiple state..." (68 chars)
Base: 700 xoz
Random: 630-770 xoz
Final: ~700 xoz
```

### Medium Effort (1.5x)
```
"Hi" (2 chars)
Base: 200 xoz
Random: 180-220 xoz
Multiplied: 270-330 xoz
Final: ~300 xoz

"Explain this code" (17 chars)
Base: 350 xoz
Random: 315-385 xoz
Multiplied: 472-577 xoz
Final: ~525 xoz
```

### High Effort (2x)
```
"Debug this" (10 chars)
Base: 200 xoz
Random: 180-220 xoz
Multiplied: 360-440 xoz
Final: ~400 xoz

"Refactor this entire module" (28 chars)
Base: 500 xoz
Random: 450-550 xoz
Multiplied: 900-1100 xoz
Final: ~1000 xoz
```

### Extra Effort (2.5x)
```
"Optimize architecture" (21 chars)
Base: 350 xoz
Random: 315-385 xoz
Multiplied: 787-962 xoz
Final: ~875 xoz

"Design complete system architecture for microservices..." (56 chars)
Base: 700 xoz
Random: 630-770 xoz
Multiplied: 1575-1925 xoz
Final: ~1750 xoz
```

## 🔧 Implementation Code

```javascript
// Token Calculator Class
class TokenCalculator {
  constructor() {
    this.multipliers = {
      low: 1.0,
      medium: 1.5,
      high: 2.0,
      extra: 2.5
    };
  }
  
  // Get base cost by character count
  getBaseCost(text) {
    const length = text.trim().length;
    
    if (length === 0) return 0;
    if (length <= 10) return 200;
    if (length <= 25) return 350;
    if (length <= 50) return 500;
    return 700;
  }
  
  // Add random variation (±10%)
  addRandomVariation(cost) {
    const variationPercent = 0.1; // 10%
    const maxVariation = cost * variationPercent;
    const randomOffset = (Math.random() * maxVariation * 2) - maxVariation;
    return cost + randomOffset;
  }
  
  // Calculate final cost with effort
  calculate(text, effortLevel = 'low') {
    const baseCost = this.getBaseCost(text);
    if (baseCost === 0) return 0;
    
    const withVariation = this.addRandomVariation(baseCost);
    const multiplier = this.multipliers[effortLevel] || 1.0;
    const finalCost = withVariation * multiplier;
    
    return Math.round(finalCost);
  }
  
  // Calculate for both user message and AI response
  calculateConversation(userText, aiResponseText, effortLevel = 'low') {
    const userCost = this.calculate(userText, effortLevel);
    const aiCost = this.calculate(aiResponseText, effortLevel);
    return {
      userCost,
      aiCost,
      total: userCost + aiCost
    };
  }
}

// Usage
const calc = new TokenCalculator();

// Single message
const cost = calc.calculate("How do I fix this bug?", "medium");
console.log(`Cost: ${cost} xoz`); // ~525 xoz

// Full conversation
const conversation = calc.calculateConversation(
  "How do I fix this bug?",
  "You can fix it by changing the variable name...",
  "high"
);
console.log(`User: ${conversation.userCost} xoz`);
console.log(`AI: ${conversation.aiCost} xoz`);
console.log(`Total: ${conversation.total} xoz`);
```

## 📱 Frontend Display

### Show Cost After Send (Optional)
```javascript
// After message sent
function updateUsageAfterSend(cost, currentUsage, totalTokens) {
  const newUsage = currentUsage + cost;
  const percentage = (newUsage / totalTokens) * 100;
  
  // Update progress bar
  updateProgressBar(percentage);
  
  // Update text (don't show exact cost)
  updateUsageText(newUsage, totalTokens);
  
  // Show subtle indicator (optional)
  showCostFlash(cost); // Brief animation showing tokens used
}

function showCostFlash(cost) {
  const flash = document.createElement('div');
  flash.className = 'cost-flash';
  flash.textContent = `-${cost} xoz`;
  document.body.appendChild(flash);
  
  setTimeout(() => flash.remove(), 2000);
}
```

### Progress Bar Update
```javascript
function updateProgressBar(percentage) {
  const bar = document.querySelector('.usage-bar');
  const percentText = document.querySelector('.usage-percent');
  
  // Update width
  bar.style.width = `${percentage}%`;
  percentText.textContent = `${Math.round(percentage)}%`;
  
  // Update color based on percentage
  if (percentage >= 90) {
    bar.setAttribute('data-level', 'danger');
  } else if (percentage >= 70) {
    bar.setAttribute('data-level', 'warning');
  } else {
    bar.removeAttribute('data-level');
  }
}
```

## 💾 Vercel Edge Function

```javascript
// api/chat.js (Vercel Edge Function)
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const { message, effortLevel, userId } = await req.json();
  
  // Calculate cost
  const calc = new TokenCalculator();
  const userCost = calc.calculate(message, effortLevel);
  
  // Check user balance
  const user = await getUserFromDB(userId);
  if (user.currentUsage + userCost > user.totalTokens) {
    return new Response(JSON.stringify({
      error: 'Insufficient tokens',
      needed: userCost,
      available: user.totalTokens - user.currentUsage
    }), {
      status: 402,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Call AI model based on effort
  const modelMap = {
    low: 'xozenlite',
    medium: 'xozen-code',
    high: 'xozen-vox',
    extra: 'xozen-thinking'
  };
  
  const aiResponse = await callAIModel(
    modelMap[effortLevel],
    message
  );
  
  // Calculate AI response cost
  const aiCost = calc.calculate(aiResponse, effortLevel);
  const totalCost = userCost + aiCost;
  
  // Update user usage
  await updateUserUsage(userId, totalCost);
  
  return new Response(JSON.stringify({
    response: aiResponse,
    cost: totalCost,
    newUsage: user.currentUsage + totalCost,
    percentage: ((user.currentUsage + totalCost) / user.totalTokens) * 100
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 🔄 Daily Refill (Ultra Coder)

```javascript
// api/check-refill.js
export default async function handler(req) {
  const { userId } = await req.json();
  
  const user = await getUserFromDB(userId);
  
  // Only Ultra Coder gets daily refill
  if (user.plan !== 'ultra') {
    return new Response(JSON.stringify({
      refillAvailable: false,
      message: 'Upgrade to Ultra Coder for daily refills'
    }));
  }
  
  // Check if new day (WIB timezone)
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta'
  }));
  
  const lastRefill = new Date(user.lastRefillDate);
  const lastRefillJakarta = new Date(lastRefill.toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta'
  }));
  
  const isNewDay = jakartaTime.getDate() !== lastRefillJakarta.getDate() ||
                   jakartaTime.getMonth() !== lastRefillJakarta.getMonth() ||
                   jakartaTime.getFullYear() !== lastRefillJakarta.getFullYear();
  
  if (isNewDay) {
    // Reset usage
    await updateUserUsage(userId, 0, true); // true = reset
    await updateLastRefillDate(userId, now);
    
    return new Response(JSON.stringify({
      refilled: true,
      newUsage: 0,
      percentage: 0,
      message: 'Tokens refilled! 100% available.'
    }));
  }
  
  return new Response(JSON.stringify({
    refilled: false,
    currentUsage: user.currentUsage,
    percentage: (user.currentUsage / user.totalTokens) * 100
  }));
}
```

## 📊 Cost Table Reference

| Input Length | Base Cost | Low (1x) | Medium (1.5x) | High (2x) | Extra (2.5x) |
|--------------|-----------|----------|---------------|-----------|--------------|
| 1-10 chars   | 200 xoz   | ~200     | ~300          | ~400      | ~500         |
| 11-25 chars  | 350 xoz   | ~350     | ~525          | ~700      | ~875         |
| 26-50 chars  | 500 xoz   | ~500     | ~750          | ~1000     | ~1250        |
| 51+ chars    | 700 xoz   | ~700     | ~1050         | ~1400     | ~1750        |

*Note: Actual costs vary ±10% due to randomizer*

## 🎯 User Experience

**User sends:** "Help me debug this"
- Characters: 19
- Base: 350 xoz
- Random: 315-385 xoz
- Effort: High (2x)
- **Final: ~700 xoz**

**Progress bar:**
- Before: 45% (13,500/30,000)
- After: 47.3% (14,200/30,000)
- User sees smooth animation, no exact numbers

**Ultra Coder at midnight:**
- Auto checks refill
- If new day: Reset to 0%
- Shows: "✨ Tokens refilled!"

---

**Ready to implement with this calculation system?** 🚀
