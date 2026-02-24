package com.chatbot.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
public class FinanceDomainService {

    private static final List<String> FINANCE_KEYWORDS = List.of(
            "finance", "financial", "investment", "investing", "wealth", "retirement",
            "stock", "stocks", "equity", "equities", "share", "shares",
            "market", "bull", "bear", "index", "ticker", "valuation", "market cap", "dividend",
            "portfolio", "allocation", "risk", "volatility", "beta", "sip",
            "pe ratio", "p/e", "eps", "revenue", "earnings", "guidance",
            "technical analysis", "fundamental analysis", "candlestick", "support", "resistance",
            "options", "call option", "put option", "futures", "hedge", "short selling",
            "etf", "mutual fund", "bond", "yield", "interest rate", "cagr",
            "inflation", "repo rate", "rbi", "macroeconomic", "liquidity",
            "tax", "income tax", "capital gains", "gst", "fd", "ppf", "nps", "elss", "ulip"
    );

    private static final List<String> STOCK_QUERY_KEYWORDS = List.of(
            "stock", "stocks", "share", "shares", "equity", "equities", "ticker",
            "listed", "market cap", "pe ratio", "p/e", "eps", "dividend",
            "earnings", "results", "nse", "bse", "sensex", "nifty"
    );

    private static final List<String> INDIAN_STOCK_MARKERS = List.of(
            "india", "indian", "nse", "bse", "sensex", "nifty", "nifty 50", "nifty50",
            ".ns", ".bo",
            "reliance", "tcs", "infosys", "hdfc", "hdfc bank", "icici", "sbin", "state bank",
            "axis bank", "itc", "larsen", "l&t", "bharti airtel", "bajaj finance",
            "tata motors", "tata steel", "adani", "wipro", "hindustan unilever", "asian paints"
    );

    private static final List<String> FOREIGN_STOCK_MARKERS = List.of(
            "nasdaq", "nyse", "dow", "s&p", "sp500", "s&p 500",
            "wall street", "us stocks", "u.s. stocks", "american stocks",
            "aapl", "msft", "googl", "amzn", "meta", "tsla", "nvda", "nvidia", "tesla", "apple", "microsoft"
    );

    public boolean isFinanceRelated(String message) {
        if (message == null) {
            return false;
        }

        String normalized = message.toLowerCase(Locale.ROOT).trim();
        if (normalized.isEmpty()) {
            return false;
        }

        for (String keyword : FINANCE_KEYWORDS) {
            if (normalized.contains(keyword)) {
                return true;
            }
        }

        // Allow direct ticker-like input (e.g. "AAPL", "TSLA")
        if (message.trim().matches("^[A-Za-z]{1,5}$")) {
            return true;
        }

        return false;
    }

    public String validateScope(String message) {
        if (!isFinanceRelated(message)) {
            return outOfScopeMessage();
        }

        String normalized = message.toLowerCase(Locale.ROOT);
        if (!isStockQuery(normalized)) {
            return null;
        }

        if (containsAny(normalized, FOREIGN_STOCK_MARKERS)) {
            return "I only cover Indian listed stocks (NSE/BSE). Ask about Indian equities only.";
        }

        if (containsAny(normalized, INDIAN_STOCK_MARKERS)) {
            return null;
        }

        // If no explicit market is given, default to Indian market context.
        // Allow direct ticker-like inputs as likely Indian symbols.
        return null;
    }

    public String outOfScopeMessage() {
        return "I only support finance topics and Indian listed stocks. Ask about investing, risk, valuation, or NSE/BSE equities.";
    }

    public String scopeHelpMessage() {
        return "I can help with Indian stocks (NSE/BSE), valuation metrics, portfolio risk, mutual funds, taxation basics, and market trends.";
    }

    public String buildFinancePrompt(String userMessage) {
        return """
                You are a finance-focused assistant specialized in Indian markets.
                Rules:
                - Only answer finance/stock-market questions.
                - For stocks, only discuss Indian listed equities (NSE/BSE).
                - Do not provide analysis for US or other non-Indian listed stocks.
                - If user asks about non-Indian stocks, reply briefly that you only handle Indian listed stocks.
                - If question is outside finance, reply briefly that you only handle finance topics.
                - Be concise and factual.
                - If providing analysis, mention key assumptions.
                - Do not guarantee returns and do not present content as personalized financial advice.
                - For general stock queries without country context, assume Indian market context.

                User question:
                %s
                """.formatted(userMessage);
    }

    private boolean isStockQuery(String normalizedMessage) {
        if (containsAny(normalizedMessage, STOCK_QUERY_KEYWORDS)) {
            return true;
        }

        // Direct symbol-like input, e.g. RELIANCE, TCS, INFY
        return normalizedMessage.trim().matches("^[a-z]{1,8}$");
    }

    private boolean containsAny(String message, List<String> keywords) {
        for (String keyword : keywords) {
            if (message.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
