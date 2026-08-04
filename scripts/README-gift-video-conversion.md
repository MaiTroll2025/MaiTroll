# Gift Video Conversion & Upload Scripts

This system converts raw gift videos into transparent WebM files and uploads them to Supabase Storage for use in Mai Troll gift overlays.

## Folder Structure

```
raw-gift-videos/     # Place your source video files here
public/gift-videos/  # Converted WebM files output here
scripts/             # Conversion and upload scripts
```

## Prerequisites

1. **FFmpeg** - Must be installed and available in PATH
   - Windows: `choco install ffmpeg` or download from ffmpeg.org
   - macOS: `brew install ffmpeg`
   - Linux: `apt install ffmpeg`

2. **Node.js** >= 20.x

3. **Database Migration** - Run this SQL migration first to add `animation_url` column:
   ```bash
   supabase db push supabase/migrations/20271027000003_gift_animation_url.sql
   ```

4. **Supabase Service Role Key** - Set in environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access

## Scripts

### 1. `convert-gifts-alpha.js`

For videos that already have transparency (alpha channel).

```bash
node scripts/convert-gifts-alpha.js [--overwrite]
```

Options:
- `--overwrite` - Re-convert files even if output already exists

### 2. `convert-gifts-greenscreen.js`

For videos with green screen or solid color backgrounds. Removes the background using chroma key.

```bash
node scripts/convert-gifts-greenscreen.js [--overwrite] [--color #00ff00] [--similarity 0.2] [--blend 0.0]
```

Options:
- `--overwrite` - Re-convert files even if output already exists
- `--color` - Hex color to key out (default: `#00ff00` for green)
- `--similarity` - Color similarity threshold 0-1 (default: 0.2)
- `--blend` - Edge blend amount 0-1 (default: 0.0)

### 3. `upload-gift-videos-to-supabase.js`

Uploads converted `.webm` files to Supabase Storage and updates `gift_items.animation_url`.

```bash
node scripts/upload-gift-videos-to-supabase.js [--dry-run]
```

Options:
- `--dry-run` - Preview what would be uploaded without making changes

## FFmpeg Settings

For alpha-preserving WebM conversion:

```
-c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0
```

For green screen removal with chroma key:

```
-vf chromakey=color:similarity:blend
```

## Naming Convention

Output files must match `gift_items.slug` field. The script slugifies filenames automatically:

- `my-gift-video.mp4` -> `my-gift-video.webm` (slug: `my-gift-video`)
- `Love Common Velvet Ember.mp4` -> `love-common-velvet-ember.webm` (slug: `love-common-velvet-ember`)

Ensure your source video filenames produce slugs that match existing `gift_items.slug` values.

## Environment Variables

Create a `.env` file or set these variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Usage Flow

1. Place source videos in `raw-gift-videos/`
2. Run conversion:
   - `node scripts/convert-gifts-alpha.js` (for videos with existing transparency)
   - `node scripts/convert-gifts-greenscreen.js` (for green screen videos)
3. Verify output in `public/gift-videos/`
4. Upload to Supabase:
   - `node scripts/upload-gift-videos-to-supabase.js --dry-run` (preview)
   - `node scripts/upload-gift-videos-to-supabase.js` (execute)

## Supported Input Formats

- `.mp4`
- `.mov`
- `.webm`
- `.mkv`

## Output Format

- `.webm` with VP9 codec
- YUVA420P pixel format (preserves alpha transparency)
- Suitable for overlay use in BroadcastPage, ViewerPage, and Random Battle gift overlays