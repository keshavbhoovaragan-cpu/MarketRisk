import sqlite3, os, time, logging
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DATA_DIR = os.environ.get("MARKETRISK_DATA_DIR", os.path.join(BASE_DIR, "data"))
DB_PATH = os.environ.get("DB_PATH", os.path.join(DATA_DIR, "marketrisk.db"))

os.makedirs(DATA_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _ensure_column(conn, table, column, definition):
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS portfolios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL DEFAULT 'My Portfolio',
            created_at INTEGER,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            cash_balance REAL NOT NULL DEFAULT 100000,
            starting_cash REAL NOT NULL DEFAULT 100000,
            is_paper INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, portfolio_id INTEGER NOT NULL DEFAULT 1, ticker TEXT NOT NULL, shares REAL NOT NULL, avg_cost REAL NOT NULL, added_at INTEGER, UNIQUE(portfolio_id, ticker));
        CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, ticker TEXT UNIQUE NOT NULL, added_at INTEGER);
        CREATE TABLE IF NOT EXISTS user_watchlist (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            ticker TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, ticker)
        );
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
            ticker TEXT NOT NULL,
            side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
            shares REAL NOT NULL CHECK (shares > 0),
            price REAL NOT NULL CHECK (price > 0),
            fees REAL NOT NULL DEFAULT 0,
            executed_at INTEGER NOT NULL,
            quote_source TEXT NOT NULL,
            quote_as_of INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            experience_level TEXT NOT NULL DEFAULT 'beginner',
            risk_tolerance TEXT NOT NULL DEFAULT 'moderate',
            investment_horizon TEXT NOT NULL DEFAULT 'long_term',
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS price_cache (ticker TEXT PRIMARY KEY, price REAL, change_pct REAL, volume INTEGER, market_cap REAL, pe_ratio REAL, week52_high REAL, week52_low REAL, updated_at INTEGER, quote_as_of INTEGER, provider TEXT);
        CREATE TABLE IF NOT EXISTS risk_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, portfolio_id INTEGER NOT NULL DEFAULT 1, var_95 REAL, var_99 REAL, sharpe_ratio REAL, beta REAL, volatility REAL, max_drawdown REAL, snapshot_date TEXT, created_at INTEGER);
    """)
    _ensure_column(conn, "portfolios", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE")
    _ensure_column(conn, "portfolios", "cash_balance", "REAL NOT NULL DEFAULT 100000")
    _ensure_column(conn, "portfolios", "starting_cash", "REAL NOT NULL DEFAULT 100000")
    _ensure_column(conn, "portfolios", "is_paper", "INTEGER NOT NULL DEFAULT 1")
    _ensure_column(conn, "price_cache", "quote_as_of", "INTEGER")
    _ensure_column(conn, "price_cache", "provider", "TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS sessions_user_expiry ON sessions(user_id, expires_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS portfolios_user ON portfolios(user_id, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS trades_portfolio_time ON trades(portfolio_id, executed_at DESC)")
    conn.execute("INSERT OR IGNORE INTO portfolios (id, name, created_at) VALUES (1, 'My Portfolio', ?)", (int(time.time()),))
    sample = [("AAPL",10,178.50),("MSFT",5,374.20),("GOOGL",3,140.80),("NVDA",8,495.60),("TSLA",4,245.30),("AMZN",6,178.90),("META",7,484.10),("JPM",12,198.40),("BRK-B",3,362.10),("V",9,272.50)]
    for ticker,shares,cost in sample:
        conn.execute("INSERT OR IGNORE INTO holdings (portfolio_id, ticker, shares, avg_cost, added_at) VALUES (1,?,?,?,?)", (ticker,shares,cost,int(time.time())))
    for t in ["SPY","QQQ","BTC-USD","ETH-USD","GLD","TLT"]:
        conn.execute("INSERT OR IGNORE INTO watchlist (ticker, added_at) VALUES (?,?)", (t,int(time.time())))
    conn.commit()
    conn.close()

init_db()
