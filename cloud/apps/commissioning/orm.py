from database import engine
from models import Base

print("Initializing database...")
Base.metadata.create_all(bind=engine)
print("Database setup complete.")
