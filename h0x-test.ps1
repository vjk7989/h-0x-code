$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path -LiteralPath $scriptDir).Path

$env:npm_config_cache = Join-Path $repoRoot ".npm-cache"
$env:TEMP = Join-Path $repoRoot ".test-tmp"
$env:TMP = Join-Path $repoRoot ".test-tmp"
$env:HOME = Join-Path $repoRoot ".test-home"
$env:H0X_CONFIG_HOME = Join-Path $repoRoot ".test-home"
$env:H0X_CODING_AGENT_DIR = Join-Path $repoRoot ".test-home\.pi\agent"
$env:H0X_CODING_AGENT_SESSION_DIR = Join-Path $repoRoot ".test-home\.pi\sessions"
$env:XDG_CONFIG_HOME = Join-Path $repoRoot ".test-home\.config"

$gitConfigDir = Join-Path $env:XDG_CONFIG_HOME "git"
$gitIgnorePath = Join-Path $gitConfigDir "ignore"
New-Item -ItemType Directory -Force -Path `
	$env:npm_config_cache, `
	$env:TEMP, `
	$env:HOME, `
	$env:H0X_CODING_AGENT_DIR, `
	$env:H0X_CODING_AGENT_SESSION_DIR, `
	$gitConfigDir `
	| Out-Null
if (-not (Test-Path -LiteralPath $gitIgnorePath)) {
	New-Item -ItemType File -Path $gitIgnorePath | Out-Null
}

$sourcePiAgentDir = Join-Path $env:USERPROFILE ".pi\agent"
if (Test-Path -LiteralPath $sourcePiAgentDir) {
	foreach ($fileName in @("auth.json", "models.json", "settings.json")) {
		$sourcePath = Join-Path $sourcePiAgentDir $fileName
		$targetPath = Join-Path $env:H0X_CODING_AGENT_DIR $fileName
		if ((Test-Path -LiteralPath $sourcePath) -and -not (Test-Path -LiteralPath $targetPath)) {
			Copy-Item -LiteralPath $sourcePath -Destination $targetPath
			Write-Host "Seeded workspace-local H-0x $fileName from existing Pi Code config."
		}
	}
}

$piTest = Join-Path $scriptDir "pi-test.ps1"
& $piTest @args
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
	exit $exitCode
}
