$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$piTest = Join-Path $scriptDir "pi-test.ps1"
& $piTest @args
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
	exit $exitCode
}
