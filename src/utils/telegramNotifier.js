const axios = require('axios');
const logger = require('./logger');

/**
 * Telegram notification utility
 */
class TelegramNotifier {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.enabled = !!(this.botToken && this.chatId);

    if (!this.enabled) {
      logger.warn('Telegram notifications disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    }
  }

  /**
   * Send a message to Telegram
   */
  async sendMessage(message, options = {}) {
    if (!this.enabled) {
      logger.debug('Telegram notification skipped (not configured)');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      const response = await axios.post(url, {
        chat_id: this.chatId,
        text: message,
        parse_mode: options.parseMode || 'HTML',
        disable_notification: options.silent || false,
      }, {
        timeout: 10000,
      });

      if (response.data.ok) {
        logger.debug('Telegram notification sent successfully');
        return true;
      } else {
        logger.error('Telegram API error', { error: response.data });
        return false;
      }
    } catch (error) {
      logger.error('Failed to send Telegram notification', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Send session summary
   */
  async sendSessionSummary(summary) {
    const {
      startTime,
      endTime,
      betsPlaced,
      totalStaked,
      dailyProfit,
      betDetails = [],
      currency = 'USDT',
    } = summary;

    const duration = endTime - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    const profitEmoji = dailyProfit >= 0 ? '📈' : '📉';
    const profitSign = dailyProfit >= 0 ? '+' : '';

    let message = `🤖 <b>Betting Session Summary</b>\n\n`;
    message += `⏰ Duration: ${hours}h ${minutes}m\n`;
    message += `📊 Bets Placed: ${betsPlaced}\n`;
    message += `💰 Total Staked: ${totalStaked.toFixed(2)} ${currency}\n`;
    message += `${profitEmoji} Daily P/L: ${profitSign}${dailyProfit.toFixed(2)} ${currency}\n\n`;

    if (betDetails.length > 0) {
      message += `<b>Bets Placed This Session:</b>\n\n`;

      betDetails.slice(0, 10).forEach((bet, i) => {
        const eventName = `${bet.home} vs ${bet.away}`;
        const shortEvent = eventName.length > 40 ? eventName.substring(0, 37) + '...' : eventName;

        message += `${i + 1}. ${shortEvent}\n`;
        message += `   ${bet.sport.toUpperCase()} | ${bet.side} @ ${bet.odds}\n`;
        message += `   💵 ${bet.stake.toFixed(2)} ${currency} | Edge: ${bet.edge.toFixed(1)}%\n\n`;
      });

      if (betDetails.length > 10) {
        message += `... and ${betDetails.length - 10} more bets\n\n`;
      }
    }

    message += `🕐 Session ended: ${new Date(endTime).toLocaleString()}\n`;

    return this.sendMessage(message);
  }

  /**
   * Send bet placed notification
   */
  async sendBetPlaced(bet) {
    const { home, away, sport, side, odds, stake, edge, currency = 'USDT' } = bet;

    let message = `🎯 <b>New Bet Placed</b>\n\n`;
    message += `${home} vs ${away}\n`;
    message += `Sport: ${sport.toUpperCase()}\n`;
    message += `Bet: ${side} @ ${odds}\n`;
    message += `Stake: ${stake.toFixed(2)} ${currency}\n`;
    message += `Edge: ${edge.toFixed(2)}%\n`;

    return this.sendMessage(message, { silent: true });
  }

  /**
   * Send bet result notification
   */
  async sendBetResult(bet) {
    const { home, away, result, odds, stake, profit, currency = 'USDT' } = bet;

    const statusEmoji = result === 'WIN' ? '✅' : result === 'LOSS' ? '❌' : '⚪';
    const profitSign = profit >= 0 ? '+' : '';

    let message = `${statusEmoji} <b>Bet ${result}</b>\n\n`;
    message += `${home} vs ${away}\n`;
    message += `Odds: ${odds}\n`;
    message += `Stake: ${stake.toFixed(2)} ${currency}\n`;
    message += `P/L: ${profitSign}${profit.toFixed(2)} ${currency}\n`;

    return this.sendMessage(message);
  }

  /**
   * Send error notification
   */
  async sendError(error) {
    let message = `🚨 <b>Error Alert</b>\n\n`;
    message += `${error.message}\n\n`;
    message += `Time: ${new Date().toLocaleString()}`;

    return this.sendMessage(message);
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(summary) {
    const {
      date,
      totalBets,
      wins,
      losses,
      voids,
      totalStaked,
      totalProfit,
      winRate,
      currency = 'USDT',
    } = summary;

    const profitEmoji = totalProfit >= 0 ? '📈' : '📉';
    const profitSign = totalProfit >= 0 ? '+' : '';

    let message = `📅 <b>Daily Summary - ${date}</b>\n\n`;
    message += `📊 Total Bets: ${totalBets}\n`;
    message += `✅ Wins: ${wins}\n`;
    message += `❌ Losses: ${losses}\n`;
    if (voids > 0) {
      message += `⚪ Voids: ${voids}\n`;
    }
    message += `📈 Win Rate: ${winRate.toFixed(1)}%\n\n`;
    message += `💰 Total Staked: ${totalStaked.toFixed(2)} ${currency}\n`;
    message += `${profitEmoji} Total Profit: ${profitSign}${totalProfit.toFixed(2)} ${currency}\n`;
    message += `📊 ROI: ${((totalProfit / totalStaked) * 100).toFixed(2)}%\n`;

    return this.sendMessage(message);
  }
}

module.exports = new TelegramNotifier();
