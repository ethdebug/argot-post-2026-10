// bin/vite-scenes.ts's: each scene's snapshot file as the build named it
// (by its contents), by its path as the app asks for it,
// "snapshots/<scene>.json"; none on the dev server (the paths as they are)
declare module "virtual:snapshot-files" {
  const files: Record<string, string>;
  export default files;
}
