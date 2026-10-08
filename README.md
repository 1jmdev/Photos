# Photos

A fast, feature-packed gallery app for people who take a lot of photos.
Built with Expo and React Native, primarily for Android.

## Features

- **Photo grid** with pinch-to-zoom and a fast scroller
- **Albums**, videos and favorites
- **Viewer** with swipe navigation, swipe-down to close, video playback and photo information
- **Share, favorite and delete** photos
- **Photo editor** with crop, rotate, flip, brightness, contrast, saturation, warmth and filters, with undo back to the original
- **Map** of all photos by where they were taken
- **Fast thumbnails** through native modules

## Tech stack

- Expo, React Native, TypeScript
- NativeWind (Tailwind CSS) for styling
- expo-media-library for photo access, expo-sqlite for the local index
- React Native Skia for the editor
- MapLibre for the map
- Local Expo modules in `modules/` for thumbnails and locations

## Getting started

Install dependencies:

```bash
bun install
```

Build a release APK:

```bash
bun run android:apk
```

## Project structure

```
src/
  screens/     Home, Album, Viewer, Editor
  components/  Reusable UI components
  hooks/       Media library and media list hooks
  lib/         Database, sync, location and editing logic
modules/       Native Expo modules (Android)
```

## Scripts

| Command          | Description               |
| ---------------- | ------------------------- |
| `bun run start`  | Start the Expo dev server |
| `bun run check`  | Lint and format check     |
| `bun run format` | Format and fix the code   |
