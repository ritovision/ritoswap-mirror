// scripts/snapshot.ts
// Creates a snapshot commit and pushes to mirror remote

import { execSync } from 'child_process';

function getTreeSha(): string {
  return execSync('git show -s --format=%T HEAD').toString().trim();
}

function createSnapshotCommit(treeSha: string, message: string): string {
  return execSync(`git commit-tree ${treeSha} -m "${message}"`).toString().trim();
}

function pushToMirror(commitSha: string): void {
  execSync(`git push --force mirror ${commitSha}:refs/heads/main`, {
    stdio: 'inherit'
  });
}

function snapshot(): void {
  const tree = getTreeSha();
  const date = new Date().toISOString().slice(0, 10);
  const message = `Snapshot ${date}`;

  console.log(`📸 Creating snapshot for ${date}...`);
  console.log(`   Tree SHA: ${tree}`);

  const sha = createSnapshotCommit(tree, message);
  console.log(`   Commit SHA: ${sha}`);

  console.log(`   Pushing to mirror...`);
  pushToMirror(sha);

  console.log(`✅ Pushed snapshot ${sha}`);
}

snapshot();
