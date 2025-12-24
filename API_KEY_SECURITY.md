# API Key Security

## ✅ Your API Keys Are Protected

Your sensitive API keys are stored in `.env` which is **already excluded from git**.

### What's Protected:
- ✅ CloudBet API key
- ✅ The Odds API key
- ✅ API-Sports key
- ✅ Telegram bot token
- ✅ All other credentials

### How It Works:

**.gitignore** contains:
```
.env
```

This means:
- `.env` is **never tracked** by git
- `.env` is **never committed** to your repository
- `.env` is **never pushed** to GitHub

### For Other Developers:

We provide `.env.example` with placeholder values:
```env
API_SPORTS_KEY=your_api_sports_key_here
CLOUDBET_API_KEY=your_cloudbet_api_key_here
```

They copy `.env.example` to `.env` and add their own keys.

---

## Verification

### Check if .env is ignored:
```bash
git check-ignore .env
```
**Expected output:** `.env` (means it's ignored ✅)

### Check if .env is tracked:
```bash
git ls-files .env
```
**Expected output:** (empty) (means it's not tracked ✅)

### Check git history:
```bash
git log --all --full-history -- .env
```
**Expected output:** (empty) (means never committed ✅)

---

## What If I Already Committed .env?

If you accidentally committed `.env` before, here's how to remove it from git history:

### Remove from latest commit:
```bash
git rm --cached .env
git commit -m "Remove .env from tracking"
git push
```

### Remove from entire history (advanced):
```bash
# Install BFG Repo-Cleaner
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Remove .env from all history
java -jar bfg.jar --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: Rewrites history)
git push --force
```

**Note:** Force pushing rewrites history. Only do this if you understand the implications.

---

## Best Practices

### ✅ DO:
- Keep `.env` in `.gitignore`
- Use `.env.example` for documentation
- Share API key setup instructions, not actual keys
- Rotate keys if accidentally exposed

### ❌ DON'T:
- Commit `.env` to git
- Share `.env` file directly
- Include API keys in code comments
- Post API keys in issues/PRs
- Screenshot `.env` file

---

## Current Status

✅ `.env` is in `.gitignore`
✅ `.env` has never been committed
✅ `.env.example` exists with placeholders
✅ Your API keys are safe

**You can safely push to GitHub without exposing your keys.**

---

## Setup for New Users

1. Clone the repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your own API keys:
   - CloudBet API key
   - The Odds API key (https://the-odds-api.com)
   - API-Sports key (https://api-sports.io)
   - Telegram bot token

---

## API Key Sources

Get your free API keys here:

- **CloudBet Trading API:** https://www.cloudbet.com/en/account/api
- **The Odds API:** https://the-odds-api.com (20K requests/month free)
- **API-Sports:** https://api-sports.io (100% free for NBA/NFL/NHL)
- **Telegram Bot:** https://t.me/BotFather
