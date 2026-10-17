[CmdletBinding()]
param(
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

function Test-TcpPortAvailable {
    param(
        [Parameter(Mandatory)]
        [int]$Port
    )

    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Any,
        $Port
    )
    $listener.Server.ExclusiveAddressUse = $true

    try {
        $listener.Start()
        return $true
    }
    catch [System.Net.Sockets.SocketException] {
        return $false
    }
    finally {
        $listener.Stop()
    }
}

function Get-DockerPortUsage {
    $output = & docker ps --format "{{.Names}}|{{.Ports}}"
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not available. Start Docker Desktop and try again."
    }

    $otherPorts = [System.Collections.Generic.HashSet[int]]::new()
    $auditiPorts = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($line in $output) {
        $name, $publishedPortText = $line -split '\|', 2
        $isAuditiContainer = $name -in @('auditi-db', 'auditi-backend', 'auditi-frontend')

        foreach ($match in [regex]::Matches($publishedPortText, '(?:0\.0\.0\.0|127\.0\.0\.1|\[::\]):(?<start>\d+)(?:-(?<end>\d+))?->')) {
            $start = [int]$match.Groups['start'].Value
            $end = if ($match.Groups['end'].Success) {
                [int]$match.Groups['end'].Value
            }
            else {
                $start
            }

            for ($port = $start; $port -le $end; $port++) {
                if ($isAuditiContainer) {
                    [void]$auditiPorts.Add($port)
                }
                else {
                    [void]$otherPorts.Add($port)
                }
            }
        }
    }

    return [pscustomobject]@{
        Other = $otherPorts
        Auditi = $auditiPorts
    }
}

function Get-NextAvailablePort {
    param(
        [Parameter(Mandatory)]
        [int]$PreferredPort,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.HashSet[int]]$DockerPorts,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.HashSet[int]]$CurrentAuditiPorts
    )

    for ($port = $PreferredPort; $port -le 65535; $port++) {
        $available = $CurrentAuditiPorts.Contains($port) -or (Test-TcpPortAvailable -Port $port)
        if (-not $DockerPorts.Contains($port) -and $available) {
            [void]$DockerPorts.Add($port)
            return $port
        }
    }

    throw "No available TCP port was found at or above $PreferredPort."
}

$portUsage = Get-DockerPortUsage
$postgresPort = Get-NextAvailablePort -PreferredPort 5435 -DockerPorts $portUsage.Other -CurrentAuditiPorts $portUsage.Auditi
$backendPort = Get-NextAvailablePort -PreferredPort 8000 -DockerPorts $portUsage.Other -CurrentAuditiPorts $portUsage.Auditi
$frontendPort = Get-NextAvailablePort -PreferredPort 5173 -DockerPorts $portUsage.Other -CurrentAuditiPorts $portUsage.Auditi

$env:AUDITI_POSTGRES_PORT = $postgresPort
$env:AUDITI_BACKEND_PORT = $backendPort
$env:AUDITI_FRONTEND_PORT = $frontendPort

Write-Host "Starting Auditi with available host ports:"
Write-Host "  PostgreSQL: localhost:$postgresPort"
Write-Host "  Backend:    http://localhost:$backendPort"
Write-Host "  Frontend:   http://localhost:$frontendPort"

$composeArguments = @("compose", "up", "-d")
if (-not $NoBuild) {
    $composeArguments += "--build"
}

& docker @composeArguments
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed with exit code $LASTEXITCODE."
}

Write-Host ""
Write-Host "Auditi is running:"
Write-Host "  App:      http://localhost:$frontendPort"
Write-Host "  API docs: http://localhost:$backendPort/docs"
