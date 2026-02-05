# Alante Performance Dashboard (Static)

## What this is
A static HTML/CSS/JS dashboard that renders:
- Performance Metrics (left)
- Program Outcomes (left)
- Utilization Activity Log feed (right, scrollable)
From JSON generated out of `Alante Performance Data.xlsx`.

## Update data
Edit `Alante Performance Data.xlsx` and push it. GitHub Actions will regenerate:
- `data/performance_metrics.json`
- `data/utilization_log.json`

## Deploy (GitHub Pages)
1. Repo Settings -> Pages
2. Source: Deploy from branch
3. Branch: main, folder: / (root)
4. Your site will be at https://<org>.github.io/<repo>/

If you deploy under a subpath, this template works as-is because it uses relative paths.

