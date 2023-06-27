# Fetch (and await) a Vercel Preview URL

This action will fetcha Vercel Preview URL and await for it to be deployed before running.

## Example Usage:

```
- name: Wait and Fetch Vercel Preview URL
  id: fetch_vercel_preview_url
  uses: lukecaan/vercel-preview-url@v0.0.1
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  with:
    project_id: '{{project_id_here}}'
    team_id: '{{team_id_here (optional)}}'

- name: Run E2E tests
  env:
    VERCEL_DEPLOYMENT_URL: ${{ steps.fetch_vercel_preview_url.outputs.preview_url }}
  run: |
    yarn run-e2e
```
