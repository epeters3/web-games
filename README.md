# web-games

## The Web Site

This repo contains a Next.js static site that serves multiple free, single-player web games. All are backend-free i.e. there is no database. The games run entirely in the user's browser.

### Development

- Install: `pnpm install`
- Run dev server: `pnpm dev`
- Build static export: `pnpm build`

### Deployment

GitHub Pages deploys on pushes to `main` via `.github/workflows/deploy.yml`.

## Game Ideas

### Space Snake

Classic 2D snake but with a space background, flourescent colors, and the snake is a space monster that eats asteroids.

### Space Dogs

3D space flight simulator dogfighting game with beautiful 3D assets, including fights in asteroid fields, near planets, etc. Includes futuristic weapons i.e. not just seeking missiles and machine guns. Also rail guns, atom bombs, lightning, etc.

### Knights of The Forest

2D side scroller where you are an elf knight that is defending his woodland home from bad men and goblins, ogres, bad creatures, etc. Can level up and get new weapons, bows, magic powers (shoot fire, etc.), etc. Maybe procedurally generated for infinity play that gets indefinitely harder. How long can you survive? Maybe uses sprites.

## Reference

- **glTF** - Good 3D asset format to use.
- Free glTF assets: https://sketchfab.com/search?features=downloadable&licenses=7c23a1ba438d4306920229c12afcb5f9&licenses=72eb2b1960364637901eacce19283624&type=models
