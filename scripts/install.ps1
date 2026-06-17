param(
	[switch]$DryRun
)

$Package = if ($env:H0X_PACKAGE_NAME) { $env:H0X_PACKAGE_NAME } else { "@hyper-0x/h0x-code" }

if ($DryRun) {
	Write-Output "Would run: npm install -g $Package --ignore-scripts"
	Write-Output "Then run: h0x --version"
	Write-Output "Then run: h0x --help"
	exit 0
}

& npm install -g $Package --ignore-scripts
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

& h0x --version
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

& h0x --help
