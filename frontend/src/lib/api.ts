import axios from "axios";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002";
export const api = axios.create({ baseURL: BASE_URL });
api.defaults.withCredentials = true;
api.interceptors.response.use(
	response => response,
	error => {
		if (error.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
			window.location.assign("/login");
		}
		return Promise.reject(error);
	},
);
export const register = (email: string, password: string) => api.post("/api/auth/register", { email, password }).then(r => r.data);
export const login = (email: string, password: string) => api.post("/api/auth/login", { email, password }).then(r => r.data);
export const logout = () => api.post("/api/auth/logout");
export const getCurrentUser = () => api.get("/api/auth/me").then(r => r.data);
export const getLearningPreferences = () => api.get("/api/auth/preferences").then(r => r.data);
export const saveLearningPreferences = (preferences: { experience_level: string; risk_tolerance: string; investment_horizon: string }) => api.put("/api/auth/preferences", preferences).then(r => r.data);
export const getPortfolios = () => api.get("/api/portfolio/list").then(r => r.data);
export const createPortfolio = (name: string, starting_cash = 100000) => api.post("/api/portfolio/", { name, starting_cash }).then(r => r.data);
export const getPortfolio = (portfolioId?: number) => api.get("/api/portfolio/", { params: portfolioId ? { portfolio_id: portfolioId } : {} }).then(r => r.data);
export const createPaperTrade = (portfolioId: number, ticker: string, side: "BUY" | "SELL", shares: number) => api.post(`/api/portfolio/${portfolioId}/trades`, { ticker, side, shares }).then(r => r.data);
export const getTrades = (portfolioId: number) => api.get(`/api/portfolio/${portfolioId}/trades`).then(r => r.data);
export const getPortfolioCoach = (portfolioId: number) => api.get(`/api/portfolio/${portfolioId}/coach`).then(r => r.data);
export const getWatchlist = () => api.get("/api/portfolio/watchlist").then(r => r.data);
export const addWatchlistTicker = (ticker: string) => api.post(`/api/portfolio/watchlist/${encodeURIComponent(ticker)}`).then(r => r.data);
export const removeWatchlistTicker = (ticker: string) => api.delete(`/api/portfolio/watchlist/${encodeURIComponent(ticker)}`).then(r => r.data);
export const getMovers = () => api.get("/api/market/movers").then(r => r.data);
export const getMarketMovers = getMovers;
export const getMarketOverview = () => api.get("/api/market/overview").then(r => r.data);
export const getMarketPrice = (ticker: string) => api.get(`/api/market/price/${encodeURIComponent(ticker)}`).then(r => r.data);
export const getPortfolioRisk = (portfolioId?: number) => api.get("/api/risk/portfolio", { params: portfolioId ? { portfolio_id: portfolioId } : {} }).then(r => r.data);
export const getRiskHistory = (portfolioId?: number) => api.get("/api/risk/history", { params: portfolioId ? { portfolio_id: portfolioId } : {} }).then(r => r.data);
export const getStressTest = (portfolioId?: number) => api.get("/api/risk/stress-test", { params: portfolioId ? { portfolio_id: portfolioId } : {} }).then(r => r.data);
export const getScreener = () => api.get("/api/stocks/screener").then(r => r.data);
export const compareStocks = (tickers: string, period = "1y") => api.get("/api/stocks/compare", { params: { tickers, period } }).then(r => r.data);
export const getStockDetail = (ticker: string, period = "1y") => api.get(`/api/stocks/${ticker}`, { params: { period } }).then(r => r.data);
