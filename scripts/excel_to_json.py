import json
import pandas as pd
from pathlib import Path

EXCEL_PATH = Path(__file__).resolve().parents[1] / "Alante Performance Data.xlsx"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

pm = pd.read_excel(EXCEL_PATH, sheet_name="Performance_Metrics")
ul = pd.read_excel(EXCEL_PATH, sheet_name="Utilization Log")

# Clean strings
for df in (pm, ul):
    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].astype(str).str.strip()

# If Programs column doesn't exist, create empty lists
if "Programs" not in ul.columns:
    ul["Programs"] = [[] for _ in range(len(ul))]

with open(DATA_DIR / "performance_metrics.json", "w") as f:
    json.dump(pm.to_dict(orient="records"), f, indent=2)

with open(DATA_DIR / "utilization_log.json", "w") as f:
    json.dump(ul.to_dict(orient="records"), f, indent=2)

print("Wrote JSON files to", DATA_DIR)
