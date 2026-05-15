"""Google Sheets integration with CSV fallback."""

from pathlib import Path
import pandas as pd

from src.config.settings import DATA_DIR, GOOGLE_SERVICE_ACCOUNT_FILE, SPREADSHEET_ID, USE_GOOGLE_SHEETS


CSV_FILES = {
    "Participantes": "participantes_exemplo.csv",
    "Jogos": "jogos_exemplo.csv",
    "Palpites": "palpites_exemplo.csv",
    "FaseFinal": "fase_final_exemplo.csv",
    "ResultadoFinal": "resultado_final_exemplo.csv",
}


class SheetsService:
    """Read and write bolao data from Google Sheets or local CSV files."""

    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = Path(data_dir)
        self.use_google_sheets = USE_GOOGLE_SHEETS and bool(SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_FILE)

    def read_sheet(self, sheet_name: str) -> pd.DataFrame:
        if self.use_google_sheets:
            return self._read_google_sheet(sheet_name)
        return self._read_csv(sheet_name)

    def update_sheet(self, sheet_name: str, dataframe: pd.DataFrame) -> None:
        if self.use_google_sheets:
            self._update_google_sheet(sheet_name, dataframe)
            return
        output_path = self.data_dir / f"{sheet_name.lower()}_saida.csv"
        dataframe.to_csv(output_path, index=False)

    def _read_csv(self, sheet_name: str) -> pd.DataFrame:
        filename = CSV_FILES.get(sheet_name)
        if not filename:
            raise ValueError(f"Aba sem CSV configurado: {sheet_name}")
        return pd.read_csv(self.data_dir / filename)

    def _read_google_sheet(self, sheet_name: str) -> pd.DataFrame:
        """Connect to Google Sheets in the future.

        Configure .env:
        SPREADSHEET_ID=<id da planilha>
        GOOGLE_SERVICE_ACCOUNT_FILE=<caminho do json da conta de servico>
        USE_GOOGLE_SHEETS=true
        """
        raise NotImplementedError("Google Sheets ainda nao configurado. Use CSV local por enquanto.")

    def _update_google_sheet(self, sheet_name: str, dataframe: pd.DataFrame) -> None:
        raise NotImplementedError("Atualizacao no Google Sheets sera implementada na integracao real.")
