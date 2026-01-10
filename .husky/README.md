# Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) to manage git hooks for maintaining code quality.

## Pre-commit Hook

The pre-commit hook automatically runs before each commit to ensure code quality:

1. **Format** - Runs `pnpm format` to format all code
2. **Build** - Runs `pnpm build` to ensure all packages build successfully
3. **Lint** - Runs `pnpm lint` to check for code quality issues

If any of these steps fail, the commit will be rejected and you'll need to fix the issues before committing again.

## Bypassing Hooks (Not Recommended)

In rare cases where you need to bypass the pre-commit hook, you can use:

```bash
git commit --no-verify -m "your message"
```

**Warning:** Only bypass hooks when absolutely necessary, as they help maintain code quality.

## Troubleshooting

### Hook not running

If the pre-commit hook isn't running, try:

```bash
# Reinstall husky
pnpm prepare
```

### Permission denied error

If you get a permission error:

```bash
chmod +x .husky/pre-commit
```

## Customizing Hooks

To modify what runs on pre-commit, edit the `.husky/pre-commit` file.

Example pre-commit file:
```bash
turbo format
turbo build
turbo lint
```

## Additional Hooks

You can add more git hooks as needed:

```bash
# Add pre-push hook
echo "pnpm test" > .husky/pre-push
chmod +x .husky/pre-push
```

Common hooks:
- `pre-commit` - Before commit
- `pre-push` - Before push
- `commit-msg` - Validate commit message format
- `post-merge` - After git merge (useful for running pnpm install)
