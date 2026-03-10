package com.chatbot.service;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

@Service
public class FinanceDomainService {

    // ---------- REGEX PATTERNS ----------

    private static final Pattern TICKER_PATTERN =
            Pattern.compile("^[A-Z]{2,10}$");

    private static final Pattern FINANCE_PATTERN =
            Pattern.compile("(stock|share|equity|investment|portfolio|dividend|valuation|market|pe|roe|roce|earnings)");

    // ---------- FINANCE KEYWORDS ----------

    private static final Set<String> FINANCE_KEYWORDS = Set.of(
            "finance","financial","investment","investing","wealth","retirement",
            "stock","stocks","equity","equities","share","shares",
            "market","bull","bear","index","valuation","market cap","dividend",
            "portfolio","allocation","risk","volatility","beta","sip",
            "technical analysis","fundamental analysis","support","resistance",
            "options","futures","hedge","short selling",
            "etf","mutual fund","bond","yield","interest rate","cagr",
            "inflation","repo rate","rbi","macroeconomic","liquidity",
            "tax","income tax","capital gains","gst","fd","ppf","nps","elss","ulip"
    );

    // ---------- STOCK METRICS ----------

    private static final Set<String> STOCK_METRICS = Set.of(
            "pe","p/e","pe ratio","eps","roe","roce","revenue","earnings",
            "ebitda","margin","guidance","valuation","market cap"
    );

    // ---------- INDIAN MARKET ----------

    private static final Set<String> INDIAN_MARKERS = Set.of(
            "india","indian","nse","bse","sensex","nifty","nifty50","nifty 50"
    );

    private static final Set<String> INDIAN_COMPANIES = Set.of(
            "reliance","tcs","infosys","hdfc","hdfc bank","icici","sbin",
            "axis bank","itc","larsen","l&t","bharti airtel","bajaj finance",
            "tata motors","tata steel","adani","wipro","asian paints",
            "hindustan unilever"
    );

    // ---------- FOREIGN MARKET ----------

    private static final Set<String> FOREIGN_MARKERS = Set.of(
            "nasdaq","nyse","dow","s&p","sp500","s&p 500",
            "wall street","us stocks","american stocks"
    );

    private static final Set<String> FOREIGN_COMPANIES = Set.of(
            "apple","microsoft","tesla","amazon","meta","google","nvidia"
    );

    // ---------- TEXT NORMALIZATION ----------

    private String normalize(String text) {

        if (text == null) return "";

        return text.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    // ---------- FINANCE DETECTION ----------

    public boolean isFinanceRelated(String message) {

        if (message == null) return false;

        String normalized = normalize(message);

        if (normalized.isEmpty()) return false;

        if (FINANCE_PATTERN.matcher(normalized).find())
            return true;

        for (String keyword : FINANCE_KEYWORDS) {
            if (normalized.contains(keyword))
                return true;
        }

        for (String metric : STOCK_METRICS) {
            if (normalized.contains(metric))
                return true;
        }

        return isTicker(message);
    }

    // ---------- STOCK QUERY ----------

    private boolean isStockQuery(String message) {

        String normalized = normalize(message);

        if (normalized.contains("stock") || normalized.contains("share"))
            return true;

        for (String metric : STOCK_METRICS)
            if (normalized.contains(metric))
                return true;

        for (String company : INDIAN_COMPANIES)
            if (normalized.contains(company))
                return true;

        return isTicker(message);
    }

    // ---------- TICKER DETECTION ----------

    private boolean isTicker(String message) {

        if (message == null) return false;

        String trimmed = message.trim().toUpperCase(Locale.ROOT);

        return TICKER_PATTERN.matcher(trimmed).matches();
    }

    // ---------- SCOPE VALIDATION ----------

    public String validateScope(String message) {

        if (!isFinanceRelated(message))
            return outOfScopeMessage();

        String normalized = normalize(message);

        if (!isStockQuery(normalized))
            return null;

        if (containsAny(normalized, FOREIGN_MARKERS) ||
                containsAny(normalized, FOREIGN_COMPANIES)) {

            return "I only cover Indian listed stocks (NSE/BSE). Please ask about Indian equities.";
        }

        return null;
    }

    // ---------- HELPER ----------

    private boolean containsAny(String text, Set<String> keywords) {

        for (String keyword : keywords) {
            if (text.contains(keyword))
                return true;
        }

        return false;
    }

    // ---------- RESPONSES ----------

    public String outOfScopeMessage() {

        return """
                I only support finance topics and Indian listed stocks.

                You can ask about:
                • NSE/BSE companies
                • valuation metrics (PE, ROE, ROCE)
                • portfolio risk
                • mutual funds
                • taxation basics
                """;
    }

    public String scopeHelpMessage() {

        return """
                I can help with:

                • Indian stocks (NSE/BSE)
                • valuation metrics
                • portfolio allocation
                • mutual funds and SIP
                • market trends
                """;
    }

    // ---------- PROMPT BUILDER ----------

    public String buildFinancePrompt(String userMessage) {

        return """
                You are a finance-focused assistant specialized in Indian markets.

                Rules:
                - Only answer finance/stock-market questions.
                - Only discuss Indian listed equities (NSE/BSE).
                - Do not provide analysis for US or foreign stocks.
                - If user asks about non-Indian stocks, say you only support Indian equities.
                - If question is outside finance, say you only handle finance topics.
                - Be concise and factual.
                - Mention assumptions if giving analysis.
                - Do not guarantee returns.
                - Do not present content as personalized financial advice.

                User question:
                %s
                """.formatted(userMessage);
    }
}