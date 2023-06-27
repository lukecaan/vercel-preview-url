# Fetch (and await) a Vercel Preview URL

This action will fetcha Vercel Preview URL and await for it to be deployed before running.

Requires you to input the current branch name because github decided to make that hard for some reason ...

Currently suggest using [tj-actions/branch-names@v7](https://github.com/tj-actions/branch-names)

## Example Usage:

```
- name: Get branch names
  id: branch-name
  uses: tj-actions/branch-names@v7

- name: Wait and Fetch Vercel Preview URL
  id: fetch_vercel_preview_url
  uses: lukecaan/vercel-preview-url@v0.0.1
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  with:
    branch_name: {{ steps.branch-name.outputs.current_branch }}
    project_id: '{{project_id_here}}'
    team_id: '{{team_id_here (optional)}}'

- name: Run E2E tests
  env:
    VERCEL_DEPLOYMENT_URL: ${{ steps.fetch_vercel_preview_url.outputs.preview_url }}
  run: |
    yarn run-e2e
```
