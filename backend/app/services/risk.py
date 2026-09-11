import numpy as np
import pandas as pd
from typing import Dict, Tuple
from scipy import stats

def calc_returns(prices: pd.Series) -> pd.Series:
    return np.log(prices / prices.shift(1)).dropna()

def calc_var(returns: pd.Series, confidence: float = 0.95, method: str = "historical") -> float:
    if len(returns) < 30: return 0.0
    if method == "historical": return float(-np.percentile(returns, (1-confidence)*100))
    mean, std = returns.mean(), returns.std()
    return float(-(mean + std * stats.norm.ppf(1-confidence)))

def calc_cvar(returns: pd.Series, confidence: float = 0.95) -> float:
    if len(returns) < 30: return 0.0
    var = calc_var(returns, confidence, "historical")
    tail = returns[returns < -var]
    return float(-tail.mean()) if len(tail) > 0 else var

def calc_sharpe(returns: pd.Series, risk_free_rate: float = 0.05) -> float:
    if len(returns) < 30 or returns.std() == 0: return 0.0
    excess = returns - risk_free_rate/252
    return float((excess.mean()/excess.std()) * np.sqrt(252))

def calc_sortino(returns: pd.Series, risk_free_rate: float = 0.05) -> float:
    if len(returns) < 30: return 0.0
    excess = returns - risk_free_rate/252
    downside = returns[returns < 0].std()
    return float((excess.mean()/downside) * np.sqrt(252)) if downside != 0 else 0.0

def calc_beta(portfolio_returns: pd.Series, market_returns: pd.Series) -> float:
    aligned = pd.concat([portfolio_returns, market_returns], axis=1).dropna()
    if len(aligned) < 30: return 1.0
    p, m = aligned.iloc[:,0], aligned.iloc[:,1]
    cov = np.cov(p,m)[0][1]
    var = np.var(m)
    return float(cov/var) if var != 0 else 1.0

def calc_alpha(portfolio_returns: pd.Series, market_returns: pd.Series, beta: float, risk_free_rate: float = 0.05) -> float:
    daily_rf = risk_free_rate/252
    return float(portfolio_returns.mean()*252 - (daily_rf*252 + beta*(market_returns.mean()*252 - daily_rf*252)))

def calc_max_drawdown(prices: pd.Series) -> Tuple[float, str, str]:
    if len(prices) < 2: return 0.0,"",""
    rolling_max = prices.cummax()
    drawdown = (prices - rolling_max) / rolling_max
    max_dd = drawdown.min()
    trough_idx = drawdown.idxmin()
    peak_idx = prices[:trough_idx].idxmax() if len(prices[:trough_idx]) > 0 else prices.index[0]
    return float(max_dd*100), str(peak_idx)[:10], str(trough_idx)[:10]

def calc_volatility(returns: pd.Series) -> float:
    return float(returns.std() * np.sqrt(252) * 100)

def calc_correlation_matrix(returns_dict: Dict[str, pd.Series]) -> Dict:
    df = pd.DataFrame(returns_dict).dropna()
    if df.empty: return {}
    corr = df.corr().round(3)
    return {"tickers": list(corr.columns), "matrix": corr.values.tolist()}

def monte_carlo_var(returns: pd.Series, n_simulations: int = 10000, horizon_days: int = 1) -> Dict:
    if len(returns) < 30: return {"var_95":0,"var_99":0,"expected_loss":0}
    mean, std = returns.mean(), returns.std()
    sim = np.random.normal(mean, std, (n_simulations, horizon_days))
    sim_portfolio = np.sum(sim, axis=1)
    var_95 = float(-np.percentile(sim_portfolio, 5))
    var_99 = float(-np.percentile(sim_portfolio, 1))
    tail = sim_portfolio[sim_portfolio < -var_95]
    expected_loss = float(-tail.mean()) if len(tail) > 0 else var_95
    return {"var_95":round(var_95*100,2),"var_99":round(var_99*100,2),
            "expected_loss":round(expected_loss*100,2),"simulations":n_simulations,"method":"Monte Carlo"}

def risk_grade(var_95: float) -> str:
    if var_95 < 0.01: return "A"
    if var_95 < 0.015: return "B"
    if var_95 < 0.025: return "C"
    if var_95 < 0.035: return "D"
    return "F"
