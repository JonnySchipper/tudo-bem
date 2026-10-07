# Asking Claude on GitHub

Claude Code runs in GitHub Actions and is billed to Jonny's Claude subscription (`CLAUDE_CODE_OAUTH_TOKEN` via the action's `claude_code_oauth_token` input). The workflow is [`.github/workflows/claude.yml`](../.github/workflows/claude.yml).

## Start a run

Do one of these, and include `@claude` plus the task:

- Open an issue whose title or body contains `@claude`.
- Assign an issue whose title or body already contains `@claude`.
- Comment `@claude` on an issue or pull request. A review comment or a submitted review counts.

Only a repository **owner** can start a run (`author_association` OWNER). A comment from anyone else is ignored, so a drive-by `@claude` on this public repo cannot spend the subscription.

The mention has to be in the comment when it is posted. Editing a comment to add `@claude` does not start a run; post a new comment. GitHub reads this workflow from `main`, so it does nothing until that file is on the default branch.

## Pick a model

A run uses the Claude Code Action's default model. To pick Opus, add a `--model` flag under `claude_args` in `.github/workflows/claude.yml`. The action passes `claude_args` through to the Claude Code CLI. For example:

```yaml
claude_args: |
  --model claude-opus-4-7
```

Leave `--model` out to keep the default. The comment in the workflow has the same example.

## Watch the run

Open the **Actions** tab, choose **Claude Code**, and open the run. Claude also updates a progress comment on the issue or pull request.
