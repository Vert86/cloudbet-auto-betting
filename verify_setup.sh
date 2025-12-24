#!/bin/bash
echo "=== CloudBet Bot Setup Verification ==="
echo ""

# Check .env exists
if [ -f ".env" ]; then
    echo "✅ .env file exists"
else
    echo "❌ .env file missing"
fi

# Check API keys are set
if grep -q "API_SPORTS_KEY=3708b4f904f898d5ff05f48374385713" .env; then
    echo "✅ API-Sports key configured"
else
    echo "❌ API-Sports key missing"
fi

if grep -q "MAX_BETS_PER_DAY=10" .env; then
    echo "✅ Max bets set to 10"
else
    echo "❌ Max bets not updated"
fi

if grep -q "USE_FUNDAMENTAL_ANALYSIS=true" .env; then
    echo "✅ Fundamental analysis enabled"
else
    echo "❌ Fundamental analysis disabled"
fi

# Check .env is ignored
if git check-ignore .env > /dev/null 2>&1; then
    echo "✅ .env is ignored by git"
else
    echo "⚠️  .env might be tracked by git"
fi

# Check new predictor exists
if [ -f "src/services/fundamentalAnalysisPredictor.js" ]; then
    echo "✅ Fundamental predictor module exists"
else
    echo "❌ Predictor module missing"
fi

# Check logs directory
if [ -d "logs" ]; then
    echo "✅ Logs directory exists"
else
    echo "⚠️  Logs directory missing (will be created on first run)"
fi

echo ""
echo "=== Summary ==="
echo "Ready to run: node production-bot.js"
