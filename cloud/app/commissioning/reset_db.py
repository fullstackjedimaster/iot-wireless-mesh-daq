from database import Base
from database import engine

Base.metadata.drop_all(engine)

Base.metadata.create_all(engine)

print("Database reset successfully!")

