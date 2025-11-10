@echo off
echo ================================================================================
echo   CLOUDBET AUTOMATED BETTING BOT - PRODUCTION MODE
echo ================================================================================
echo.
echo Starting production bot with +EV strategy...
echo.
echo Configuration:
echo   - Multi-bookmaker odds comparison (The Odds API + Cloudbet)
echo   - Sharp consensus from Pinnacle, Bookmaker, BetCRIS
echo   - Minimum edge: 2.0%%
echo   - Max bets per day: 5
echo   - Scan interval: 5 minutes
echo.
echo Press Ctrl+C to stop the bot at any time
echo.
echo ================================================================================
echo.

node production-bot.js

pause
