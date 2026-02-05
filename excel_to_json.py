import json
import pandas as pd

EXCEL_PATH = "Alante Performance Data.xlsx"

def main():
    perf = pd.read_excel(EXCEL_PATH, sheet_name="Performance_Metrics")
    prog = pd.read_excel(EXCEL_PATH, sheet_name="Program_Outcomes")
    log  = pd.read_excel(EXCEL_PATH, sheet_name="Utilization_Log")

    # Performance Metrics JSON (expected fields)
    perf_out = []
    for _, r in perf.iterrows():
        perf_out.append({
            "Org": str(r["Org"]),
            "KPI": str(r["Metric"]),
            "Last3": float(r["Last_3_Mth_Avg"]) if pd.notna(r["Last_3_Mth_Avg"]) else None,
            "Current": float(r["Current_Month"]) if pd.notna(r["Current_Month"]) else None,
            "MoM": float(r["MoM_Change"]) if pd.notna(r["MoM_Change"]) else None,
            "YTD": float(r["YTD_Avg"]) if pd.notna(r["YTD_Avg"]) else None,
        })

    prog_out = []
    for _, r in prog.iterrows():
        prog_out.append({
            "Org": str(r["Org"]),
            "Program": str(r["Program"]),
            "Eligible": int(r["Eligible"]),
            "Engaged": int(r["Engaged"]),
            "Completed": int(r["Completed"]),
            "CompletionPct": float(r["Completion_Pct"]) * 100 if r["Completion_Pct"]<=1 else float(r["Completion_Pct"]),
            "MoM": str(r.get("MoM_Trend","up")),
        })

    log_out = []
    for _, r in log.iterrows():
        tags = []
        if pd.notna(r.get("Tags", "")):
            tags = [t.strip() for t in str(r["Tags"]).split(",") if t.strip()]
        log_out.append({
            "Patient": str(r["Patient"]),
            "Date": str(r["Date"]),
            "Org": str(r["Org"]),
            "Event": str(r["Event"]),
            "Facility": str(r["Facility"]),
            "Diagnosis": str(r["Diagnosis"]),
            "ICD10": str(r["ICD10"]),
            "Tags": tags,
        })

    with open("data/performance_metrics.json","w") as f:
        json.dump(perf_out, f, indent=2)

    with open("data/program_outcomes.json","w") as f:
        json.dump(prog_out, f, indent=2)

    with open("data/utilization_log.json","w") as f:
        json.dump(log_out, f, indent=2)

    print("Wrote JSON to data/")

if __name__ == "__main__":
    main()
