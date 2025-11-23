Set-Location "C:\Users\USER\Documents\betrix-ui"

$workflowFile = ".github\workflows\ci-smoke-test.yml"
if (-not (Test-Path $workflowFile)) { Write-Host 'Workflow file not found:' $workflowFile; exit 1 }

# Read file content
$content = Get-Content $workflowFile -Raw

# Replace broken placeholder patterns with the correct literal GitHub Actions secret expression
$pattern = '\$\s*\{\s*\{\s*secrets\.\$renderApiKeyPlaceholder\s*\}\s*\}|\$\s*\{\s*\{\s*secrets\.RENDER_API_KEY\s*\}\s*\}'
$replacement = '${{ secrets.RENDER_API_KEY }}'
$newContent = [Regex]::Replace($content, $pattern, $replacement, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

if ($newContent -eq $content) {
  Write-Host "No changes required in $workflowFile"
  exit 0
}

# Backup existing file
Copy-Item -Path $workflowFile -Destination ($workflowFile + '.bak') -Force

# Write updated file
Set-Content -Path $workflowFile -Value $newContent -Encoding UTF8

# If git available, show diff, commit, and push
if ((Get-Command git -ErrorAction SilentlyContinue) -ne $null) {
  git add $workflowFile
  Write-Host 'Staged updated workflow file. Showing git diff (staged)...'
  git --no-pager diff --staged -- $workflowFile

  $commitOut = git commit -m 'fix(ci): correct GitHub secrets reference for Render API key' 2>&1
  Write-Host $commitOut
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'Pushing commit to origin/main...'
    git push origin main 2>&1 | Write-Host
  } else {
    Write-Host 'No commit created (file unchanged) or commit failed; nothing to push.'
  }
} else {
  Write-Host "Git not found; file updated on disk at $workflowFile"
}

Write-Host 'Done. The workflow now references the literal ${{ secrets.RENDER_API_KEY }} for the Render API key.'
