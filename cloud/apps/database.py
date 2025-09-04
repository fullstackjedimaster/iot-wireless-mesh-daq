import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from cloud.apps.util.config import load_config

# ✅ Load database configuration from config.yaml
config = load_config()

DB_USER = config["database"]["user"]
DB_PASSWORD = config["database"]["password"]
DB_HOST = config["database"]["host"]
DB_PORT = config["database"]["port"]
DB_NAME = config["database"]["name"]

# ✅ Construct the Database URL
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ✅ Create SQLAlchemy Engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# ✅ Create a Session Factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ✅ Base class for models
Base = declarative_base()

# ✅ Log successful database configuration load
logger = logging.getLogger(__name__)
logger.info(f"Database configuration loaded: {DATABASE_URL}")
