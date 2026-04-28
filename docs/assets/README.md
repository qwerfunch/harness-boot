# docs/assets/ — README portfolio assets

This directory holds the GIFs and screenshots referenced from the *Built with harness-boot* section in the main `README.md`.

## Inventory

| File | Purpose |
|---|---|
| `cosmic-suika.png` | First external dogfood project — preview screenshot |
| `<your-project>.{png,gif}` | A project built with harness-boot — open a PR or issue and we'll add it |

## Format guidance (target, not a hard limit)

We'll optimize before merging, so don't worry about hitting these exactly:

- **Screenshot**: PNG or WEBP, roughly 1 MB or less
- **GIF**: 1–3 seconds, roughly 5 MB or less, around 800 px wide
- **Retina**: append `@2x` to the filename if you want pixel density preserved

If your asset is bigger than these targets, send it anyway — we'll resize and re-encode on merge.

## How to add

```bash
# Option A (recommended) — open a PR yourself
cp ~/recording.gif docs/assets/your-project.gif
# then add a row to README.md §Built with harness-boot, copying an existing row as a template.

# Option B — just send it
# Open an issue with the image attached and a one-liner about the project.
# The maintainer will optimize and add the row.
```
