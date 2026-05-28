from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Konfigurasi dasar aplikasi.
    port: int = 5000
    database_url: str
    jwt_secret: str
    cors_origin: str = 'http://localhost:5173,http://127.0.0.1:5173'
    google_client_id: str | None = None
    # Path dataset eksternal untuk membantu training awal model.
    dataset_csv_path: str = '../dataset/Personal_Finance_Dataset.csv'
    # Flag ini mengatur apakah model boleh memakai dataset CSV tambahan.
    use_dataset_for_training: bool = True
    # Mode training default diset agar mengikuti notebook referensi.
    training_mode: str = 'notebook_exact'

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origin.split(',') if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
