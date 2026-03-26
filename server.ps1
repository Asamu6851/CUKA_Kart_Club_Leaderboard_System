param(
  [int]$Port = 8080,
  [string]$HostName = "0.0.0.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:DataPath = Join-Path $script:RootPath "data"
$script:UploadPath = Join-Path $script:DataPath "uploads"
$script:StorePath = Join-Path $script:DataPath "store.json"
$script:SessionCookieName = "cuka_session"
$script:KartTypes = @(
  "200cc",
  "270cc",
  "super4t200",
  "super4t206",
  "gpmax",
  "x30"
)
$script:Sessions = @{}

function New-JsonResponse {
  param(
    [int]$StatusCode,
    [object]$Payload
  )

  return [pscustomobject]@{
    StatusCode = $StatusCode
    ContentType = "application/json; charset=utf-8"
    Body = [System.Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Depth 20 -Compress:$false))
    Headers = @{}
  }
}

function New-TextResponse {
  param(
    [int]$StatusCode,
    [string]$Text,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  return [pscustomobject]@{
    StatusCode = $StatusCode
    ContentType = $ContentType
    Body = [System.Text.Encoding]::UTF8.GetBytes($Text)
    Headers = @{}
  }
}

function Get-StatusDescription {
  param([int]$StatusCode)

  switch ($StatusCode) {
    200 { return "OK" }
    201 { return "Created" }
    400 { return "Bad Request" }
    401 { return "Unauthorized" }
    403 { return "Forbidden" }
    404 { return "Not Found" }
    500 { return "Internal Server Error" }
    default { return "OK" }
  }
}

function Add-ResponseHeader {
  param(
    [pscustomobject]$Response,
    [string]$Name,
    [string]$Value
  )

  if (-not $Response.Headers.ContainsKey($Name)) {
    $Response.Headers[$Name] = @()
  }

  $Response.Headers[$Name] += $Value
}

function Send-Response {
  param(
    [System.Net.Sockets.TcpClient]$Client,
    [pscustomobject]$Response
  )

  $stream = $Client.GetStream()
  $writer = New-Object System.IO.StreamWriter($stream, [System.Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"

  try {
    $writer.WriteLine(("HTTP/1.1 {0} {1}" -f $Response.StatusCode, (Get-StatusDescription -StatusCode $Response.StatusCode)))
    $writer.WriteLine("Content-Type: {0}" -f $Response.ContentType)
    $writer.WriteLine("Content-Length: {0}" -f $Response.Body.Length)
    $writer.WriteLine("Connection: close")

    foreach ($headerName in $Response.Headers.Keys) {
      foreach ($value in @($Response.Headers[$headerName])) {
        $writer.WriteLine(("{0}: {1}" -f $headerName, $value))
      }
    }

    $writer.WriteLine("")
    $writer.Flush()

    $stream.Write($Response.Body, 0, $Response.Body.Length)
    $stream.Flush()
  } finally {
    $writer.Dispose()
    $stream.Dispose()
    $Client.Close()
  }
}

function Read-HttpRequest {
  param([System.Net.Sockets.TcpClient]$Client)

  $stream = $Client.GetStream()
  $buffer = New-Object byte[] 4096
  $headerBytes = New-Object System.Collections.Generic.List[byte]
  $firstBodyBytes = New-Object System.Collections.Generic.List[byte]
  $headerEndIndex = -1

  while ($headerEndIndex -lt 0) {
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) {
      if ($headerBytes.Count -eq 0) {
        return $null
      }
      throw "Malformed request."
    }

    for ($index = 0; $index -lt $read; $index++) {
      $headerBytes.Add($buffer[$index])
      $count = $headerBytes.Count
      if ($count -ge 4 -and
        $headerBytes[$count - 4] -eq 13 -and
        $headerBytes[$count - 3] -eq 10 -and
        $headerBytes[$count - 2] -eq 13 -and
        $headerBytes[$count - 1] -eq 10) {
        $headerEndIndex = $count
        for ($tail = $index + 1; $tail -lt $read; $tail++) {
          $firstBodyBytes.Add($buffer[$tail])
        }
        break
      }
    }
  }

  $allHeaderBytes = $headerBytes.ToArray()
  $headerText = [System.Text.Encoding]::ASCII.GetString($allHeaderBytes, 0, $headerEndIndex - 4)
  $headerLines = $headerText -split "`r`n"
  $requestLine = $headerLines[0]
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    return $null
  }

  $parts = $requestLine.Split(" ")
  if ($parts.Length -lt 2) {
    throw "Malformed request line."
  }

  $headers = @{}
  foreach ($line in $headerLines | Select-Object -Skip 1) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }
    $separator = $line.IndexOf(":")
    if ($separator -lt 0) {
      continue
    }

    $name = $line.Substring(0, $separator).Trim().ToLowerInvariant()
    $value = $line.Substring($separator + 1).Trim()
    $headers[$name] = $value
  }

  $contentLength = 0
  if ($headers.ContainsKey("content-length")) {
    [void][int]::TryParse($headers["content-length"], [ref]$contentLength)
  }

  $bodyBytes = New-Object System.Collections.Generic.List[byte]
  foreach ($byte in $firstBodyBytes) {
    $bodyBytes.Add($byte)
  }

  while ($bodyBytes.Count -lt $contentLength) {
    $read = $stream.Read($buffer, 0, [Math]::Min($buffer.Length, $contentLength - $bodyBytes.Count))
    if ($read -le 0) {
      break
    }
    for ($index = 0; $index -lt $read; $index++) {
      $bodyBytes.Add($buffer[$index])
    }
  }

  $cookieTable = @{}
  if ($headers.ContainsKey("cookie")) {
    foreach ($cookiePair in $headers["cookie"].Split(";")) {
      $segments = $cookiePair.Split("=", 2)
      if ($segments.Length -eq 2) {
        $cookieTable[$segments[0].Trim()] = $segments[1].Trim()
      }
    }
  }

  $rawPath = $parts[1]
  $pathOnly = $rawPath.Split("?", 2)[0]

  return [pscustomobject]@{
    Method = $parts[0]
    RawPath = $rawPath
    Path = [System.Uri]::UnescapeDataString($pathOnly)
    Headers = $headers
    BodyText = if ($bodyBytes.Count -gt 0) { [System.Text.Encoding]::UTF8.GetString($bodyBytes.ToArray(), 0, [Math]::Min($bodyBytes.Count, $contentLength)) } else { "" }
    HasEntityBody = ($contentLength -gt 0)
    Cookies = $cookieTable
  }
}

function Write-Log {
  param([string]$Message)
  Write-Host ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message)
}

function Get-AdvertisedUrls {
  param(
    [string]$HostName,
    [int]$Port
  )

  $urls = New-Object System.Collections.Generic.List[string]

  if ($HostName -eq "*" -or $HostName -eq "0.0.0.0") {
    $urls.Add(("http://localhost:{0}/" -f $Port))

    try {
      [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
        Where-Object { $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up } |
        ForEach-Object {
          $_.GetIPProperties().UnicastAddresses |
            Where-Object {
              $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
              -not [System.Net.IPAddress]::IsLoopback($_.Address)
            } |
            ForEach-Object {
              $urls.Add(("http://{0}:{1}/" -f $_.Address.IPAddressToString, $Port))
            }
        }
    } catch {
      # If address enumeration fails we still keep localhost as a fallback hint.
    }
  } elseif ($HostName -eq "localhost" -or $HostName -eq "127.0.0.1") {
    $urls.Add(("http://localhost:{0}/" -f $Port))
    $urls.Add(("http://127.0.0.1:{0}/" -f $Port))
  } else {
    $urls.Add(("http://{0}:{1}/" -f $HostName, $Port))
  }

  return @($urls | Sort-Object -Unique)
}

function Ensure-Directories {
  foreach ($path in @($script:DataPath, $script:UploadPath)) {
    if (-not (Test-Path $path)) {
      [void](New-Item -ItemType Directory -Path $path -Force)
    }
  }
}

function New-Id {
  param([string]$Prefix)
  return "{0}_{1}" -f $Prefix, ([guid]::NewGuid().ToString("N"))
}

function New-PasswordSalt {
  $bytes = New-Object byte[] 16
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Get-PasswordHash {
  param(
    [string]$Password,
    [string]$Salt
  )

  $saltBytes = [Convert]::FromBase64String($Salt)
  $derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($Password, $saltBytes, 100000)
  try {
    return [Convert]::ToBase64String($derive.GetBytes(32))
  } finally {
    $derive.Dispose()
  }
}

function New-PasswordRecord {
  param([string]$Password)

  $salt = New-PasswordSalt
  return [pscustomobject]@{
    Salt = $salt
    Hash = (Get-PasswordHash -Password $Password -Salt $salt)
  }
}

function Test-Password {
  param(
    [string]$Password,
    [pscustomobject]$User
  )

  return (Get-PasswordHash -Password $Password -Salt $User.passwordSalt) -eq $User.passwordHash
}

function Get-EmptyStore {
  return [pscustomobject]@{
    version = 3
    createdAt = (Get-Date).ToString("o")
    updatedAt = (Get-Date).ToString("o")
    users = @()
    tracks = @()
    records = @()
    submissions = @()
  }
}

function Save-Store {
  param([pscustomobject]$Store)

  $Store.updatedAt = (Get-Date).ToString("o")
  $Store.version = 3
  $json = $Store | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($script:StorePath, $json, [System.Text.Encoding]::UTF8)
}

function Get-ObjectPropertyValue {
  param(
    [object]$Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Get-Store {
  if (-not (Test-Path $script:StorePath)) {
    $store = Get-EmptyStore
    $adminPassword = New-PasswordRecord -Password "Admin123456"
    $store.users += [pscustomobject]@{
      id = New-Id "user"
      username = "cuka_admin"
      nickname = "CUKA Admin"
      role = "admin"
      approvalStatus = "approved"
      passwordSalt = $adminPassword.Salt
      passwordHash = $adminPassword.Hash
      createdAt = (Get-Date).ToString("o")
      reviewNote = ""
      reviewedById = ""
      reviewedAt = ""
    }
    Save-Store -Store $store
    return $store
  }

  $raw = [System.IO.File]::ReadAllText($script:StorePath, [System.Text.Encoding]::UTF8)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return Get-EmptyStore
  }

  $data = $raw | ConvertFrom-Json
  $store = [pscustomobject]@{
    version = 3
    createdAt = $(if ((Get-ObjectPropertyValue -Object $data -Name "createdAt")) { (Get-ObjectPropertyValue -Object $data -Name "createdAt") } else { (Get-Date).ToString("o") })
    updatedAt = $(if ((Get-ObjectPropertyValue -Object $data -Name "updatedAt")) { (Get-ObjectPropertyValue -Object $data -Name "updatedAt") } else { (Get-Date).ToString("o") })
    users = @(@((Get-ObjectPropertyValue -Object $data -Name "users")) | ForEach-Object {
      $role = $(if ((Clean-Text $_.role) -eq "admin") { "admin" } else { "member" })
      $username = (Clean-Text $_.username).ToLowerInvariant()
      $legacyNickname = Clean-Text (Get-ObjectPropertyValue -Object $_ -Name "nickname")
      $legacyDisplayName = Clean-Text (Get-ObjectPropertyValue -Object $_ -Name "displayName")
      $nickname = $(if (-not [string]::IsNullOrWhiteSpace($legacyNickname)) {
        $legacyNickname
      } elseif ($role -eq "admin" -and -not [string]::IsNullOrWhiteSpace($legacyDisplayName)) {
        $legacyDisplayName
      } elseif (-not [string]::IsNullOrWhiteSpace($username)) {
        $username
      } else {
        "member"
      })
      $approvalStatus = $(if ($role -eq "admin") {
        "approved"
      } elseif (@("approved", "pending", "rejected") -contains (Clean-Text (Get-ObjectPropertyValue -Object $_ -Name "approvalStatus"))) {
        Clean-Text (Get-ObjectPropertyValue -Object $_ -Name "approvalStatus")
      } else {
        "approved"
      })

      [pscustomobject]@{
        id = $_.id
        username = $username
        nickname = $nickname
        role = $role
        approvalStatus = $approvalStatus
        passwordSalt = $_.passwordSalt
        passwordHash = $_.passwordHash
        createdAt = $(if ((Get-ObjectPropertyValue -Object $_ -Name "createdAt")) { (Get-ObjectPropertyValue -Object $_ -Name "createdAt") } else { (Get-Date).ToString("o") })
        reviewNote = Clean-Text (Get-ObjectPropertyValue -Object $_ -Name "reviewNote")
        reviewedById = Clean-Text (Get-ObjectPropertyValue -Object $_ -Name "reviewedById")
        reviewedAt = Clean-Text (Get-ObjectPropertyValue -Object $_ -Name "reviewedAt")
      }
    })
    tracks = @(@((Get-ObjectPropertyValue -Object $data -Name "tracks")))
    records = @(@((Get-ObjectPropertyValue -Object $data -Name "records")))
    submissions = @(@((Get-ObjectPropertyValue -Object $data -Name "submissions")))
  }

  if (
    $raw -match '"displayName"\s*:' -or
    $raw -match '"phone"\s*:' -or
    $raw -match '"isActive"\s*:' -or
    $raw -notmatch '"nickname"\s*:' -or
    $raw -notmatch '"approvalStatus"\s*:'
  ) {
    Save-Store -Store $store
  }

  return $store
}

function Get-JsonBody {
  param([pscustomobject]$Request)

  if (-not $Request.HasEntityBody -or [string]::IsNullOrWhiteSpace($Request.BodyText)) {
    return $null
  }

  return $Request.BodyText | ConvertFrom-Json
}

function Get-RequestPath {
  param([pscustomobject]$Request)
  return $Request.Path
}

function Get-NowIso {
  return (Get-Date).ToString("o")
}

function Get-UserById {
  param(
    [pscustomobject]$Store,
    [string]$UserId
  )

  return $Store.users | Where-Object { $_.id -eq $UserId } | Select-Object -First 1
}

function Get-UserByUsername {
  param(
    [pscustomobject]$Store,
    [string]$Username
  )

  return $Store.users | Where-Object { $_.username -eq $Username } | Select-Object -First 1
}

function Get-TrackById {
  param(
    [pscustomobject]$Store,
    [string]$TrackId
  )

  return $Store.tracks | Where-Object { $_.id -eq $TrackId } | Select-Object -First 1
}

function Get-PublicUser {
  param([pscustomobject]$User)

  return [pscustomobject]@{
    id = $User.id
    username = $User.username
    nickname = $User.nickname
    displayName = $User.nickname
    phone = ""
    role = $User.role
    approvalStatus = $(if ($User.role -eq "admin") { "approved" } else { $User.approvalStatus })
    createdAt = $User.createdAt
  }
}

function Get-TrackView {
  param([pscustomobject]$Track)

  return [pscustomobject]@{
    id = $Track.id
    name = $Track.name
    location = $Track.location
    length = $Track.length
    layout = $Track.layout
    note = $Track.note
    createdAt = $Track.createdAt
  }
}

function Clean-Text {
  param([object]$Value)
  if ($null -eq $Value) {
    return ""
  }
  return ([string]$Value).Trim()
}

function Test-Username {
  param([string]$Username)
  return $Username -match "^[A-Za-z0-9_]{3,20}$"
}

function Parse-LapTime {
  param([string]$LapTime)

  $value = (Clean-Text $LapTime) -replace "\s+", ""
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Lap time is required."
  }

  if ($value -match "^\d+(\.\d+)?$") {
    return Convert-SecondPartToMilliseconds -Value $value
  }

  $parts = $value.Split(":")
  if ($parts.Length -ne 2) {
    throw "Lap time format is invalid. Use 59.876 or 1:02.345."
  }

  $minutes = 0
  if (-not [int]::TryParse($parts[0], [ref]$minutes) -or $minutes -lt 0) {
    throw "Minute section is invalid."
  }

  $secondMs = Convert-SecondPartToMilliseconds -Value $parts[1]
  if (($secondMs / 1000) -ge 60) {
    throw "Seconds must be less than 60."
  }

  return ($minutes * 60 * 1000) + $secondMs
}

function Convert-SecondPartToMilliseconds {
  param([string]$Value)

  if ($Value -notmatch "^\d+(\.\d+)?$") {
    throw "Second section is invalid."
  }

  $parts = $Value.Split(".")
  $seconds = [int]$parts[0]
  $fraction = $(if ($parts.Length -gt 1) { $parts[1] } else { "" })
  $fraction = ($fraction -replace "[^\d]", "")
  if ($fraction.Length -gt 3) {
    $fraction = $fraction.Substring(0, 3)
  }
  while ($fraction.Length -lt 3) {
    $fraction += "0"
  }

  return ($seconds * 1000) + [int]$fraction
}

function New-SessionToken {
  return ([guid]::NewGuid().ToString("N")) + ([guid]::NewGuid().ToString("N"))
}

function Set-SessionCookie {
  param(
    [pscustomobject]$Response,
    [string]$Token
  )

  Add-ResponseHeader -Response $Response -Name "Set-Cookie" -Value ("{0}={1}; Path=/; HttpOnly; SameSite=Lax" -f $script:SessionCookieName, $Token)
}

function Clear-SessionCookie {
  param([pscustomobject]$Response)

  Add-ResponseHeader -Response $Response -Name "Set-Cookie" -Value ("{0}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax" -f $script:SessionCookieName)
}

function Get-CurrentUser {
  param(
    [pscustomobject]$Request,
    [pscustomobject]$Store
  )

  if (-not $Request.Cookies.ContainsKey($script:SessionCookieName)) {
    return $null
  }

  $cookieValue = $Request.Cookies[$script:SessionCookieName]
  if ([string]::IsNullOrWhiteSpace($cookieValue)) {
    return $null
  }

  if (-not $script:Sessions.ContainsKey($cookieValue)) {
    return $null
  }

  $session = $script:Sessions[$cookieValue]
  if ([datetime]$session.expiresAt -lt (Get-Date)) {
    $script:Sessions.Remove($cookieValue)
    return $null
  }

  $user = Get-UserById -Store $Store -UserId $session.userId
  if ($null -eq $user) {
    return $null
  }

  if ($user.role -eq "member" -and (Get-MemberApprovalStatus -User $user) -ne "approved") {
    return $null
  }

  return $user
}

function Require-Role {
  param(
    [pscustomobject]$User,
    [string]$Role
  )

  if ($null -eq $User) {
    throw "AUTH_REQUIRED"
  }

  if ($User.role -ne $Role) {
    throw "FORBIDDEN"
  }
}

function Get-ImageExtensionFromMime {
  param([string]$MimeType)

  switch ($MimeType.ToLowerInvariant()) {
    "image/png" { return ".png" }
    "image/jpeg" { return ".jpg" }
    "image/jpg" { return ".jpg" }
    "image/webp" { return ".webp" }
    "image/gif" { return ".gif" }
    default { return $null }
  }
}

function Save-Screenshot {
  param(
    [string]$SubmissionId,
    [string]$DataUrl
  )

  $payload = Clean-Text $DataUrl
  if ([string]::IsNullOrWhiteSpace($payload)) {
    throw "Screenshot is required."
  }

  if ($payload -notmatch "^data:(?<mime>image\/[A-Za-z0-9\-\+\.]+);base64,(?<data>.+)$") {
    throw "Screenshot format is invalid."
  }

  $extension = Get-ImageExtensionFromMime -MimeType $Matches.mime
  if (-not $extension) {
    throw "Only PNG, JPG, WEBP or GIF is supported."
  }

  try {
    $bytes = [Convert]::FromBase64String($Matches.data)
  } catch {
    throw "Screenshot content is invalid."
  }

  if ($bytes.Length -gt 8MB) {
    throw "Screenshot must be smaller than 8MB."
  }

  $fileName = "{0}_{1}{2}" -f $SubmissionId, (Get-Date -Format "yyyyMMddHHmmss"), $extension
  $filePath = Join-Path $script:UploadPath $fileName
  [System.IO.File]::WriteAllBytes($filePath, $bytes)
  return "/uploads/$fileName"
}

function Remove-Screenshot {
  param([string]$ScreenshotUrl)

  $url = Clean-Text $ScreenshotUrl
  if ([string]::IsNullOrWhiteSpace($url)) {
    return
  }

  $relative = $url.TrimStart("/")
  if (-not $relative.StartsWith("uploads/")) {
    return
  }

  $filePath = Join-Path $script:DataPath $relative
  if (Test-Path $filePath) {
    Remove-Item -LiteralPath $filePath -Force
  }
}

function Get-MemberApprovalStatus {
  param([pscustomobject]$User)

  if ($null -eq $User) {
    return ""
  }

  if ($User.role -eq "admin") {
    return "approved"
  }

  $status = Clean-Text $User.approvalStatus
  if (@("approved", "pending", "rejected") -contains $status) {
    return $status
  }

  return "approved"
}

function Get-UserNickname {
  param(
    [pscustomobject]$Store,
    [string]$UserId
  )

  $user = Get-UserById -Store $Store -UserId $UserId
  if ($null -eq $user) {
    return "Unknown User"
  }
  return $(if (-not [string]::IsNullOrWhiteSpace((Clean-Text $user.nickname))) { $user.nickname } else { $user.username })
}

function Get-MemberIdentityInput {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$Body
  )

  $username = (Clean-Text $Body.username).ToLowerInvariant()
  $password = Clean-Text $Body.password
  $nickname = Clean-Text (Get-ObjectPropertyValue -Object $Body -Name "nickname")
  if ([string]::IsNullOrWhiteSpace($nickname)) {
    $nickname = Clean-Text (Get-ObjectPropertyValue -Object $Body -Name "displayName")
  }

  if (-not (Test-Username -Username $username)) {
    throw "Username must be 3-20 letters, numbers or underscores."
  }
  if ($password.Length -lt 6) {
    throw "Password must be at least 6 characters."
  }
  if ([string]::IsNullOrWhiteSpace($nickname)) {
    throw "Nickname is required."
  }
  if (Get-UserByUsername -Store $Store -Username $username) {
    throw "Username already exists."
  }

  return [pscustomobject]@{
    username = $username
    password = $password
    nickname = $nickname
  }
}

function New-MemberUserRecord {
  param(
    [string]$Username,
    [string]$Password,
    [string]$Nickname,
    [string]$ApprovalStatus = "pending",
    [string]$ReviewedById = "",
    [string]$ReviewNote = "",
    [string]$ReviewedAt = ""
  )

  $passwordRecord = New-PasswordRecord -Password $Password
  return [pscustomobject]@{
    id = New-Id "user"
    username = $Username
    nickname = $Nickname
    role = "member"
    approvalStatus = $ApprovalStatus
    passwordSalt = $passwordRecord.Salt
    passwordHash = $passwordRecord.Hash
    createdAt = Get-NowIso
    reviewNote = $ReviewNote
    reviewedById = $ReviewedById
    reviewedAt = $ReviewedAt
  }
}

function Get-TrackName {
  param(
    [pscustomobject]$Store,
    [string]$TrackId
  )

  $track = Get-TrackById -Store $Store -TrackId $TrackId
  if ($null -eq $track) {
    return "Unknown Track"
  }
  return $track.name
}

function Get-OfficialRecordViews {
  param([pscustomobject]$Store)

  return @($Store.records | ForEach-Object {
    [pscustomobject]@{
      id = $_.id
      source = $_.source
      submissionId = $_.submissionId
      memberId = $_.memberId
      memberName = Get-UserNickname -Store $Store -UserId $_.memberId
      trackId = $_.trackId
      trackName = Get-TrackName -Store $Store -TrackId $_.trackId
      lapTimeMs = $_.lapTimeMs
      lapTime = $_.lapTime
      date = $_.date
      ranking = $_.ranking
      kartType = $_.kartType
      kartNo = $_.kartNo
      weather = $_.weather
      note = $_.note
      screenshotUrl = $_.screenshotUrl
      approvedById = $_.approvedById
      approvedByName = $(if ($_.approvedById) { Get-UserNickname -Store $Store -UserId $_.approvedById } else { "" })
      createdAt = $_.createdAt
      approvedAt = $_.approvedAt
    }
  } | Sort-Object -Property @{ Expression = "date"; Descending = $true }, @{ Expression = "createdAt"; Descending = $true })
}

function Get-SubmissionViews {
  param([pscustomobject]$Store)

  return @($Store.submissions | ForEach-Object {
    [pscustomobject]@{
      id = $_.id
      memberId = $_.memberId
      memberName = Get-UserNickname -Store $Store -UserId $_.memberId
      trackId = $_.trackId
      trackName = Get-TrackName -Store $Store -TrackId $_.trackId
      lapTimeMs = $_.lapTimeMs
      lapTime = $_.lapTime
      date = $_.date
      ranking = $_.ranking
      kartType = $_.kartType
      kartNo = $_.kartNo
      weather = $_.weather
      note = $_.note
      screenshotUrl = $_.screenshotUrl
      status = $_.status
      reviewNote = $_.reviewNote
      reviewedById = $_.reviewedById
      reviewedByName = $(if ($_.reviewedById) { Get-UserNickname -Store $Store -UserId $_.reviewedById } else { "" })
      reviewedAt = $_.reviewedAt
      createdAt = $_.createdAt
      approvedRecordId = $_.approvedRecordId
    }
  } | Sort-Object -Property @{ Expression = "createdAt"; Descending = $true })
}

function Get-PersonalBestViews {
  param([pscustomobject]$Store)

  $records = Get-OfficialRecordViews -Store $Store
  $trackBestMap = @{}
  $memberTrackMap = @{}

  foreach ($record in $records) {
    if (-not $trackBestMap.ContainsKey($record.trackId) -or $record.lapTimeMs -lt $trackBestMap[$record.trackId].lapTimeMs) {
      $trackBestMap[$record.trackId] = $record
    }

    $key = "{0}::{1}" -f $record.memberId, $record.trackId
    $shouldReplace = -not $memberTrackMap.ContainsKey($key) -or
      $record.lapTimeMs -lt $memberTrackMap[$key].lapTimeMs -or
      ($record.lapTimeMs -eq $memberTrackMap[$key].lapTimeMs -and $record.date -gt $memberTrackMap[$key].date)

    if ($shouldReplace) {
      $memberTrackMap[$key] = $record
    }
  }

  return @($memberTrackMap.Values | ForEach-Object {
    $track = Get-TrackById -Store $Store -TrackId $_.trackId
    $trackBest = $trackBestMap[$_.trackId]
    [pscustomobject]@{
      memberId = $_.memberId
      memberName = $_.memberName
      trackId = $_.trackId
      trackName = $_.trackName
      trackLocation = $(if ($track) { $track.location } else { "" })
      lapTimeMs = $_.lapTimeMs
      lapTime = $_.lapTime
      date = $_.date
      ranking = $_.ranking
      kartType = $_.kartType
      gapToTrackBestMs = [Math]::Max(0, $_.lapTimeMs - $trackBest.lapTimeMs)
    }
  } | Sort-Object trackName, lapTimeMs, memberName)
}

function Get-Leaderboards {
  param([pscustomobject]$Store)

  $records = Get-OfficialRecordViews -Store $Store
  return @($Store.tracks | Sort-Object name | ForEach-Object {
    $track = $_
    $bestByMember = @{}

    foreach ($record in $records | Where-Object { $_.trackId -eq $track.id }) {
      $key = $record.memberId
      $shouldReplace = -not $bestByMember.ContainsKey($key) -or
        $record.lapTimeMs -lt $bestByMember[$key].lapTimeMs -or
        ($record.lapTimeMs -eq $bestByMember[$key].lapTimeMs -and $record.date -gt $bestByMember[$key].date)

      if ($shouldReplace) {
        $bestByMember[$key] = $record
      }
    }

    [pscustomobject]@{
      trackId = $track.id
      trackName = $track.name
      rows = @($bestByMember.Values | Sort-Object lapTimeMs, memberName | ForEach-Object -Begin { $rank = 1 } -Process {
        [pscustomobject]@{
          rank = $rank
          memberId = $_.memberId
          memberName = $_.memberName
          lapTimeMs = $_.lapTimeMs
          lapTime = $_.lapTime
          date = $_.date
          ranking = $_.ranking
          kartType = $_.kartType
          kartNo = $_.kartNo
        }
        $rank++
      })
    }
  })
}

function Get-MemberAccountViews {
  param([pscustomobject]$Store)

  $records = Get-OfficialRecordViews -Store $Store
  $submissions = Get-SubmissionViews -Store $Store

  return @($Store.users | Where-Object { $_.role -eq "member" } | ForEach-Object {
    $user = $_
    $userRecords = @($records | Where-Object { $_.memberId -eq $user.id })
    $bestRecord = $userRecords | Sort-Object lapTimeMs, date | Select-Object -First 1
    $pendingCount = @($submissions | Where-Object { $_.memberId -eq $user.id -and $_.status -eq "pending" }).Count

    [pscustomobject]@{
      id = $user.id
      username = $user.username
      nickname = $user.nickname
      displayName = $user.nickname
      phone = ""
      role = $user.role
      approvalStatus = (Get-MemberApprovalStatus -User $user)
      reviewNote = $user.reviewNote
      reviewedById = $user.reviewedById
      reviewedAt = $user.reviewedAt
      createdAt = $user.createdAt
      officialRecordCount = $userRecords.Count
      pendingSubmissionCount = $pendingCount
      bestLapTime = $(if ($bestRecord) { $bestRecord.lapTime } else { "" })
      bestLapTrackName = $(if ($bestRecord) { $bestRecord.trackName } else { "" })
    }
  } | Sort-Object @{ Expression = {
    switch ($_.approvalStatus) {
      "pending" { 0 }
      "rejected" { 1 }
      default { 2 }
    }
  } }, @{ Expression = "nickname"; Descending = $false }, @{ Expression = "createdAt"; Descending = $true })
}

function Get-Stats {
  param([pscustomobject]$Store)

  return [pscustomobject]@{
    memberCount = @($Store.users | Where-Object { $_.role -eq "member" -and (Get-MemberApprovalStatus -User $_) -eq "approved" }).Count
    pendingMemberApprovalCount = @($Store.users | Where-Object { $_.role -eq "member" -and (Get-MemberApprovalStatus -User $_) -eq "pending" }).Count
    trackCount = @($Store.tracks).Count
    officialRecordCount = @($Store.records).Count
    pendingSubmissionCount = @($Store.submissions | Where-Object { $_.status -eq "pending" }).Count
  }
}

function Get-DashboardPayload {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser
  )

  $officialRecords = Get-OfficialRecordViews -Store $Store
  $submissionViews = Get-SubmissionViews -Store $Store

  $payload = [ordered]@{
    user = Get-PublicUser -User $CurrentUser
    kartTypes = $script:KartTypes
    stats = Get-Stats -Store $Store
    tracks = @($Store.tracks | Sort-Object name | ForEach-Object { Get-TrackView -Track $_ })
    leaderboards = @(Get-Leaderboards -Store $Store)
    personalBests = @(Get-PersonalBestViews -Store $Store)
    recentRecords = @($officialRecords | Select-Object -First 8)
    officialRecords = @($officialRecords)
  }

  if ($CurrentUser.role -eq "member") {
    $payload.mySubmissions = @($submissionViews | Where-Object { $_.memberId -eq $CurrentUser.id })
  }

  if ($CurrentUser.role -eq "admin") {
    $payload.pendingSubmissions = @($submissionViews | Where-Object { $_.status -eq "pending" })
    $payload.memberAccounts = @(Get-MemberAccountViews -Store $Store)
  }

  return $payload
}

function Get-StaticContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".gif" { return "image/gif" }
    ".webp" { return "image/webp" }
    ".svg" { return "image/svg+xml" }
    ".ico" { return "image/x-icon" }
    default { return "application/octet-stream" }
  }
}

function Get-StaticFileResponse {
  param([string]$RequestPath)

  $relative = $(if ($RequestPath -eq "/") { "index.html" } else { $RequestPath.TrimStart("/") })

  if ($relative.StartsWith("uploads/")) {
    $fullPath = Join-Path $script:DataPath $relative
  } else {
    $fullPath = Join-Path $script:RootPath $relative
  }

  $normalized = [System.IO.Path]::GetFullPath($fullPath)
  $allowedRoots = @(
    [System.IO.Path]::GetFullPath($script:RootPath),
    [System.IO.Path]::GetFullPath($script:DataPath)
  )

  if (-not ($allowedRoots | Where-Object { $normalized.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) })) {
    return New-TextResponse -StatusCode 403 -Text "Forbidden"
  }

  if (-not (Test-Path $normalized)) {
    return New-TextResponse -StatusCode 404 -Text "Not Found"
  }

  return [pscustomobject]@{
    StatusCode = 200
    ContentType = (Get-StaticContentType -Path $normalized)
    Body = [System.IO.File]::ReadAllBytes($normalized)
    Headers = @{}
  }
}

function Invoke-Register {
  param([pscustomobject]$Store, [pscustomobject]$Body)

  $identity = Get-MemberIdentityInput -Store $Store -Body $Body

  $Store.users += New-MemberUserRecord -Username $identity.username -Password $identity.password -Nickname $identity.nickname -ApprovalStatus "pending"
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 201 -Payload @{
    success = $true
    message = "Registration submitted and waiting for approval."
  }
}

function Invoke-Login {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$Body
  )

  $username = (Clean-Text $Body.username).ToLowerInvariant()
  $password = Clean-Text $Body.password
  $user = Get-UserByUsername -Store $Store -Username $username

  if ($null -eq $user -or -not (Test-Password -Password $password -User $user)) {
    throw "Username or password is incorrect."
  }
  if ($user.role -eq "member" -and (Get-MemberApprovalStatus -User $user) -eq "pending") {
    throw "Member registration is pending approval."
  }
  if ($user.role -eq "member" -and (Get-MemberApprovalStatus -User $user) -eq "rejected") {
    throw "Member registration was rejected."
  }

  $token = New-SessionToken
  $script:Sessions[$token] = @{
    userId = $user.id
    expiresAt = (Get-Date).AddHours(12).ToString("o")
  }
  $response = New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Login successful."
    user = Get-PublicUser -User $user
  }
  Set-SessionCookie -Response $response -Token $token
  return $response
}

function Invoke-Logout {
  param([pscustomobject]$Request)

  if ($Request.Cookies.ContainsKey($script:SessionCookieName)) {
    $token = $Request.Cookies[$script:SessionCookieName]
    if ($script:Sessions.ContainsKey($token)) {
      $script:Sessions.Remove($token)
    }
  }
  $response = New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
  }
  Clear-SessionCookie -Response $response
  return $response
}

function Invoke-CreateTrack {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [pscustomobject]$Body
  )

  Require-Role -User $CurrentUser -Role "admin"

  $name = Clean-Text $Body.name
  if ([string]::IsNullOrWhiteSpace($name)) {
    throw "Track name is required."
  }

  $length = $(if ([string]::IsNullOrWhiteSpace((Clean-Text $Body.length))) { $null } else { [int](Clean-Text $Body.length) })

  $Store.tracks += [pscustomobject]@{
    id = New-Id "track"
    name = $name
    location = Clean-Text $Body.location
    length = $length
    layout = Clean-Text $Body.layout
    note = Clean-Text $Body.note
    createdAt = Get-NowIso
  }
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 201 -Payload @{
    success = $true
    message = "Track created successfully."
  }
}

function Invoke-CreateMemberByAdmin {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [pscustomobject]$Body
  )

  Require-Role -User $CurrentUser -Role "admin"
  $identity = Get-MemberIdentityInput -Store $Store -Body $Body
  $Store.users += New-MemberUserRecord `
    -Username $identity.username `
    -Password $identity.password `
    -Nickname $identity.nickname `
    -ApprovalStatus "approved" `
    -ReviewedById $CurrentUser.id `
    -ReviewNote "Created by admin." `
    -ReviewedAt (Get-NowIso)
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 201 -Payload @{
    success = $true
    message = "Member account created successfully."
  }
}

function Invoke-CreateSubmission {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [pscustomobject]$Body
  )

  Require-Role -User $CurrentUser -Role "member"
  if ((Get-MemberApprovalStatus -User $CurrentUser) -ne "approved") {
    throw "Member registration is pending approval."
  }

  $trackId = Clean-Text $Body.trackId
  $track = Get-TrackById -Store $Store -TrackId $trackId
  if ($null -eq $track) {
    throw "Please choose a valid track."
  }

  $kartType = Clean-Text $Body.kartType
  if ($script:KartTypes -notcontains $kartType) {
    throw "Please choose a valid kart type."
  }

  $submissionId = New-Id "submission"
  $screenshotUrl = Save-Screenshot -SubmissionId $submissionId -DataUrl (Clean-Text $Body.screenshotDataUrl)
  $lapTimeText = Clean-Text $Body.lapTime

  $Store.submissions += [pscustomobject]@{
    id = $submissionId
    memberId = $CurrentUser.id
    trackId = $trackId
    lapTime = $lapTimeText
    lapTimeMs = Parse-LapTime -LapTime $lapTimeText
    date = $(if ([string]::IsNullOrWhiteSpace((Clean-Text $Body.date))) { (Get-Date -Format "yyyy-MM-dd") } else { (Clean-Text $Body.date) })
    ranking = Clean-Text $Body.ranking
    kartType = $kartType
    kartNo = Clean-Text $Body.kartNo
    weather = Clean-Text $Body.weather
    note = Clean-Text $Body.note
    screenshotUrl = $screenshotUrl
    status = "pending"
    reviewNote = ""
    reviewedById = ""
    reviewedAt = ""
    approvedRecordId = ""
    createdAt = Get-NowIso
  }
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 201 -Payload @{
    success = $true
    message = "Submission created and waiting for approval."
  }
}

function Invoke-CreateOfficialRecord {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [pscustomobject]$Body
  )

  Require-Role -User $CurrentUser -Role "admin"

  $memberId = Clean-Text $Body.memberId
  $trackId = Clean-Text $Body.trackId
  $member = Get-UserById -Store $Store -UserId $memberId
  $track = Get-TrackById -Store $Store -TrackId $trackId
  if ($null -eq $member -or $member.role -ne "member" -or (Get-MemberApprovalStatus -User $member) -ne "approved") {
    throw "Please choose a valid member."
  }
  if ($null -eq $track) {
    throw "Please choose a valid track."
  }

  $kartType = Clean-Text $Body.kartType
  if ($script:KartTypes -notcontains $kartType) {
    throw "Please choose a valid kart type."
  }

  $lapTimeText = Clean-Text $Body.lapTime
  $Store.records += [pscustomobject]@{
    id = New-Id "record"
    source = "admin"
    submissionId = ""
    memberId = $memberId
    trackId = $trackId
    lapTime = $lapTimeText
    lapTimeMs = Parse-LapTime -LapTime $lapTimeText
    date = $(if ([string]::IsNullOrWhiteSpace((Clean-Text $Body.date))) { (Get-Date -Format "yyyy-MM-dd") } else { (Clean-Text $Body.date) })
    ranking = Clean-Text $Body.ranking
    kartType = $kartType
    kartNo = Clean-Text $Body.kartNo
    weather = Clean-Text $Body.weather
    note = Clean-Text $Body.note
    screenshotUrl = ""
    approvedById = $CurrentUser.id
    approvedAt = Get-NowIso
    createdAt = Get-NowIso
  }
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 201 -Payload @{
    success = $true
    message = "Official record created successfully."
  }
}

function Invoke-ApproveSubmission {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$SubmissionId
  )

  Require-Role -User $CurrentUser -Role "admin"

  $submission = $Store.submissions | Where-Object { $_.id -eq $SubmissionId } | Select-Object -First 1
  if ($null -eq $submission) {
    throw "Submission not found."
  }
  if ($submission.status -ne "pending") {
    throw "Submission has already been reviewed."
  }

  $recordId = New-Id "record"
  $Store.records += [pscustomobject]@{
    id = $recordId
    source = "submission"
    submissionId = $submission.id
    memberId = $submission.memberId
    trackId = $submission.trackId
    lapTime = $submission.lapTime
    lapTimeMs = $submission.lapTimeMs
    date = $submission.date
    ranking = $submission.ranking
    kartType = $submission.kartType
    kartNo = $submission.kartNo
    weather = $submission.weather
    note = $submission.note
    screenshotUrl = $submission.screenshotUrl
    approvedById = $CurrentUser.id
    approvedAt = Get-NowIso
    createdAt = Get-NowIso
  }

  $submission.status = "approved"
  $submission.reviewNote = "Approved by admin."
  $submission.reviewedById = $CurrentUser.id
  $submission.reviewedAt = Get-NowIso
  $submission.approvedRecordId = $recordId
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Submission approved and added to official records."
  }
}

function Invoke-ApproveMemberRegistration {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$MemberId
  )

  Require-Role -User $CurrentUser -Role "admin"

  $member = Get-UserById -Store $Store -UserId $MemberId
  if ($null -eq $member -or $member.role -ne "member") {
    throw "Member not found."
  }
  if ((Get-MemberApprovalStatus -User $member) -eq "approved") {
    throw "Member account has already been approved."
  }

  $member.approvalStatus = "approved"
  $member.reviewNote = "Approved by admin."
  $member.reviewedById = $CurrentUser.id
  $member.reviewedAt = Get-NowIso
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Member registration approved."
  }
}

function Invoke-RejectMemberRegistration {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$MemberId,
    [pscustomobject]$Body
  )

  Require-Role -User $CurrentUser -Role "admin"

  $member = Get-UserById -Store $Store -UserId $MemberId
  if ($null -eq $member -or $member.role -ne "member") {
    throw "Member not found."
  }
  if ((Get-MemberApprovalStatus -User $member) -eq "approved") {
    throw "Approved member cannot be rejected."
  }

  $reviewNote = Clean-Text $Body.reviewNote
  if ([string]::IsNullOrWhiteSpace($reviewNote)) {
    throw "Review note is required when rejecting member registration."
  }

  $member.approvalStatus = "rejected"
  $member.reviewNote = $reviewNote
  $member.reviewedById = $CurrentUser.id
  $member.reviewedAt = Get-NowIso
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Member registration rejected."
  }
}

function Invoke-RejectSubmission {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$SubmissionId,
    [pscustomobject]$Body
  )

  Require-Role -User $CurrentUser -Role "admin"

  $submission = $Store.submissions | Where-Object { $_.id -eq $SubmissionId } | Select-Object -First 1
  if ($null -eq $submission) {
    throw "Submission not found."
  }
  if ($submission.status -ne "pending") {
    throw "Submission has already been reviewed."
  }

  $reviewNote = Clean-Text $Body.reviewNote
  if ([string]::IsNullOrWhiteSpace($reviewNote)) {
    throw "Review note is required when rejecting."
  }

  $submission.status = "rejected"
  $submission.reviewNote = $reviewNote
  $submission.reviewedById = $CurrentUser.id
  $submission.reviewedAt = Get-NowIso
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Submission rejected."
  }
}

function Invoke-DeleteMember {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$MemberId
  )

  Require-Role -User $CurrentUser -Role "admin"

  $member = Get-UserById -Store $Store -UserId $MemberId
  if ($null -eq $member -or $member.role -ne "member") {
    throw "Member not found."
  }

  $hasRecords = @($Store.records | Where-Object { $_.memberId -eq $MemberId }).Count -gt 0
  $hasSubmissions = @($Store.submissions | Where-Object { $_.memberId -eq $MemberId }).Count -gt 0
  if ($hasRecords -or $hasSubmissions) {
    throw "Cannot delete member with existing records or submissions."
  }

  $Store.users = @($Store.users | Where-Object { $_.id -ne $MemberId })
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Member deleted."
  }
}

function Invoke-DeleteTrack {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$TrackId
  )

  Require-Role -User $CurrentUser -Role "admin"

  $track = Get-TrackById -Store $Store -TrackId $TrackId
  if ($null -eq $track) {
    throw "Track not found."
  }

  $hasRecords = @($Store.records | Where-Object { $_.trackId -eq $TrackId }).Count -gt 0
  $hasSubmissions = @($Store.submissions | Where-Object { $_.trackId -eq $TrackId }).Count -gt 0
  if ($hasRecords -or $hasSubmissions) {
    throw "Cannot delete track with existing records or submissions."
  }

  $Store.tracks = @($Store.tracks | Where-Object { $_.id -ne $TrackId })
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Track deleted."
  }
}

function Invoke-DeleteOfficialRecord {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$RecordId
  )

  Require-Role -User $CurrentUser -Role "admin"

  $record = $Store.records | Where-Object { $_.id -eq $RecordId } | Select-Object -First 1
  if ($null -eq $record) {
    throw "Official record not found."
  }

  if ($record.source -eq "submission" -and -not [string]::IsNullOrWhiteSpace((Clean-Text $record.submissionId))) {
    $submission = $Store.submissions | Where-Object { $_.id -eq $record.submissionId } | Select-Object -First 1
    if ($submission) {
      $submission.status = "pending"
      $submission.reviewNote = ""
      $submission.reviewedById = ""
      $submission.reviewedAt = ""
      $submission.approvedRecordId = ""
    } elseif (-not [string]::IsNullOrWhiteSpace((Clean-Text $record.screenshotUrl))) {
      Remove-Screenshot -ScreenshotUrl $record.screenshotUrl
    }
  }

  $Store.records = @($Store.records | Where-Object { $_.id -ne $RecordId })
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Official record deleted."
  }
}

function Invoke-DeleteSubmission {
  param(
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser,
    [string]$SubmissionId
  )

  if ($null -eq $CurrentUser) {
    throw "AUTH_REQUIRED"
  }

  $submission = $Store.submissions | Where-Object { $_.id -eq $SubmissionId } | Select-Object -First 1
  if ($null -eq $submission) {
    throw "Submission not found."
  }

  if ($CurrentUser.role -eq "member" -and $submission.memberId -ne $CurrentUser.id) {
    throw "FORBIDDEN"
  }

  if ($CurrentUser.role -ne "admin" -and $CurrentUser.role -ne "member") {
    throw "FORBIDDEN"
  }

  if ((Clean-Text $submission.approvedRecordId) -and @($Store.records | Where-Object { $_.id -eq $submission.approvedRecordId }).Count -gt 0) {
    throw "Delete the linked official record first."
  }

  Remove-Screenshot -ScreenshotUrl $submission.screenshotUrl
  $Store.submissions = @($Store.submissions | Where-Object { $_.id -ne $SubmissionId })
  Save-Store -Store $Store

  return New-JsonResponse -StatusCode 200 -Payload @{
    success = $true
    message = "Submission deleted."
  }
}

function Handle-ApiRequest {
  param(
    [pscustomobject]$Request,
    [pscustomobject]$Store,
    [pscustomobject]$CurrentUser
  )

  $path = Get-RequestPath -Request $Request
  $method = $Request.Method.ToUpperInvariant()

  if ($method -eq "GET" -and $path -eq "/api/health") {
    return New-JsonResponse -StatusCode 200 -Payload @{ ok = $true; serverTime = Get-NowIso }
  }

  if ($method -eq "GET" -and $path -eq "/api/session") {
    if ($null -eq $CurrentUser) {
      return New-JsonResponse -StatusCode 200 -Payload @{ authenticated = $false }
    }

    return New-JsonResponse -StatusCode 200 -Payload @{
      authenticated = $true
      user = Get-PublicUser -User $CurrentUser
    }
  }

  if ($method -eq "GET" -and $path -eq "/api/dashboard") {
    if ($null -eq $CurrentUser) {
      throw "AUTH_REQUIRED"
    }

    return New-JsonResponse -StatusCode 200 -Payload @{
      authenticated = $true
      data = (Get-DashboardPayload -Store $Store -CurrentUser $CurrentUser)
    }
  }

  if ($method -eq "POST" -and $path -eq "/api/auth/register") {
    return Invoke-Register -Store $Store -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "POST" -and $path -eq "/api/auth/login") {
    return Invoke-Login -Store $Store -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "POST" -and $path -eq "/api/auth/logout") {
    return Invoke-Logout -Request $Request
  }

  if ($method -eq "POST" -and $path -eq "/api/member/submissions") {
    return Invoke-CreateSubmission -Store $Store -CurrentUser $CurrentUser -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "DELETE" -and $path -match "^/api/member/submissions/(?<id>[^/]+)$") {
    return Invoke-DeleteSubmission -Store $Store -CurrentUser $CurrentUser -SubmissionId $Matches.id
  }

  if ($method -eq "POST" -and $path -eq "/api/admin/tracks") {
    return Invoke-CreateTrack -Store $Store -CurrentUser $CurrentUser -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "POST" -and $path -eq "/api/admin/members") {
    return Invoke-CreateMemberByAdmin -Store $Store -CurrentUser $CurrentUser -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "POST" -and $path -eq "/api/admin/records") {
    return Invoke-CreateOfficialRecord -Store $Store -CurrentUser $CurrentUser -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "POST" -and $path -match "^/api/admin/submissions/(?<id>[^/]+)/approve$") {
    return Invoke-ApproveSubmission -Store $Store -CurrentUser $CurrentUser -SubmissionId $Matches.id
  }

  if ($method -eq "POST" -and $path -match "^/api/admin/submissions/(?<id>[^/]+)/reject$") {
    return Invoke-RejectSubmission -Store $Store -CurrentUser $CurrentUser -SubmissionId $Matches.id -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "POST" -and $path -match "^/api/admin/members/(?<id>[^/]+)/approve$") {
    return Invoke-ApproveMemberRegistration -Store $Store -CurrentUser $CurrentUser -MemberId $Matches.id
  }

  if ($method -eq "POST" -and $path -match "^/api/admin/members/(?<id>[^/]+)/reject$") {
    return Invoke-RejectMemberRegistration -Store $Store -CurrentUser $CurrentUser -MemberId $Matches.id -Body (Get-JsonBody -Request $Request)
  }

  if ($method -eq "DELETE" -and $path -match "^/api/admin/members/(?<id>[^/]+)$") {
    return Invoke-DeleteMember -Store $Store -CurrentUser $CurrentUser -MemberId $Matches.id
  }

  if ($method -eq "DELETE" -and $path -match "^/api/admin/tracks/(?<id>[^/]+)$") {
    return Invoke-DeleteTrack -Store $Store -CurrentUser $CurrentUser -TrackId $Matches.id
  }

  if ($method -eq "DELETE" -and $path -match "^/api/admin/records/(?<id>[^/]+)$") {
    return Invoke-DeleteOfficialRecord -Store $Store -CurrentUser $CurrentUser -RecordId $Matches.id
  }

  if ($method -eq "DELETE" -and $path -match "^/api/admin/submissions/(?<id>[^/]+)$") {
    return Invoke-DeleteSubmission -Store $Store -CurrentUser $CurrentUser -SubmissionId $Matches.id
  }

  return New-JsonResponse -StatusCode 404 -Payload @{
    error = "API_NOT_FOUND"
  }
}

Ensure-Directories

$ipAddress = if ($HostName -eq "*" -or $HostName -eq "0.0.0.0") {
  [System.Net.IPAddress]::Any
} elseif ($HostName -eq "localhost" -or $HostName -eq "127.0.0.1") {
  [System.Net.IPAddress]::Loopback
} else {
  [System.Net.IPAddress]::Parse($HostName)
}
$listener = [System.Net.Sockets.TcpListener]::new($ipAddress, $Port)
$listener.Start()

Write-Log "CUKA server started."
Write-Log ("Listening on {0}:{1}" -f $HostName, $Port)
foreach ($url in (Get-AdvertisedUrls -HostName $HostName -Port $Port)) {
  Write-Log "Open: $url"
}
Write-Log "Default admin: CUKA_Admin / Admin123456"
Write-Log "Press Ctrl + C to stop."

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $request = Read-HttpRequest -Client $client
      if ($null -eq $request) {
        $response = New-TextResponse -StatusCode 400 -Text "Bad Request"
        Send-Response -Client $client -Response $response
        continue
      }

      $store = Get-Store
      $currentUser = Get-CurrentUser -Request $request -Store $store
      $path = Get-RequestPath -Request $request

      if ($path.StartsWith("/api/")) {
        $response = Handle-ApiRequest -Request $request -Store $store -CurrentUser $currentUser
      } else {
        $response = Get-StaticFileResponse -RequestPath $path
      }
    } catch {
      $statusCode = $(if ($_.Exception.Message -eq "AUTH_REQUIRED") { 401 } elseif ($_.Exception.Message -eq "FORBIDDEN") { 403 } else { 400 })
      $response = New-JsonResponse -StatusCode $statusCode -Payload @{
        error = $_.Exception.Message
      }
    }

    Send-Response -Client $client -Response $response
  }
} finally {
  $listener.Stop()
  Write-Log "Server stopped."
}
