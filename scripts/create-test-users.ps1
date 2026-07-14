<#
.SYNOPSIS
  Create test users for Helm. app testing.
  Creates users in Cognito (with phone number) + adds to AllowList DynamoDB table.

.USAGE
  .\scripts\create-test-users.ps1

.NOTES
  Requires: AWS CLI configured with ap-south-1 access
  Edit the $TestUsers array below to add/remove testers.
  Phone numbers must be in E.164 format (e.g. +919876543210)
  Password is set permanently (no forced change on first login).
#>

param(
    [string]$Region = "ap-south-1",
    [string]$UserPoolId = "ap-south-1_qBgP9WmPn",
    [string]$AllowListTable = "ai-leader-allowlist"
)

# ============================================================
# EDIT THIS LIST: Add your testers here
# Phone must be E.164 format: +91 followed by 10 digits
# ============================================================
$TestUsers = @(
    @{ Email = "divyasudhakar@gmail.com"; Password = "Test1234!"; Name = "Divya Mahesh"; Phone = "+919940085042" },
    @{ Email = "suja.ananth999@gmail.com"; Password = "Test1234!"; Name = "Suja Ananthachari"; Phone = "+919840908137" },
    @{ Email = "arvind.moorthy@gmail.com"; Password = "Test1234!"; Name = "Arvind Moorthy"; Phone = "+919600003512" },
    @{ Email = "dollsun@gmail.com"; Password = "Test1234!"; Name = "Sudara Kuppusamy"; Phone = "+919840140549" },
    @{ Email = "eeejasper@gmail.com"; Password = "Test1234!"; Name = "Jasper S"; Phone = "+919840305812" },
    @{ Email = "arunv@gmail.com"; Password = "Test1234!"; Name = "Arunkumar V"; Phone = "+919940077543" },
    @{ Email = "Rajkumars1971@gmail.com"; Password = "Test1234!"; Name = "Rajkumar"; Phone = "+919790929293" },
    @{ Email = "balamurali.s01@gmail.com"; Password = "Test1234!"; Name = "Balamurali S"; Phone = "+919962561802" }
)
# ============================================================

Write-Host "`n=== Helm. Test User Creator ===" -ForegroundColor Cyan
Write-Host "User Pool: $UserPoolId"
Write-Host "Region: $Region"
Write-Host "Creating $($TestUsers.Count) user(s)...`n"

$created = 0
$skipped = 0
$tempFile = Join-Path $PSScriptRoot "temp-item.json"

foreach ($user in $TestUsers) {
    $email = $user.Email
    $password = $user.Password
    $name = $user.Name
    $phone = $user.Phone

    Write-Host "--- $email ($phone) ---" -ForegroundColor Yellow

    # Step 1: Add to AllowList DynamoDB table (using file to avoid JSON escaping issues)
    Write-Host "  [1] Adding to AllowList..."
    $itemJson = @{
        value = @{ S = $email }
        type = @{ S = "email" }
        name = @{ S = $name }
        phone = @{ S = $phone }
        addedAt = @{ S = (Get-Date -Format o) }
        addedBy = @{ S = "admin-script" }
    } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($tempFile, $itemJson)
    aws dynamodb put-item --table-name $AllowListTable --region $Region --item file://$tempFile 2>$null

    # Step 2: Create user in Cognito with phone_number
    Write-Host "  [2] Creating Cognito user..."
    $result = aws cognito-idp admin-create-user `
        --user-pool-id $UserPoolId `
        --region $Region `
        --username $email `
        --user-attributes "Name=email,Value=$email" "Name=email_verified,Value=true" "Name=phone_number,Value=$phone" "Name=phone_number_verified,Value=true" "Name=name,Value=$name" `
        --temporary-password $password `
        --message-action SUPPRESS `
        2>&1

    if ($LASTEXITCODE -ne 0) {
        if ($result -match "UsernameExistsException") {
            Write-Host "  [!] User already exists - updating phone number" -ForegroundColor DarkYellow
            aws cognito-idp admin-update-user-attributes `
                --user-pool-id $UserPoolId `
                --region $Region `
                --username $email `
                --user-attributes "Name=phone_number,Value=$phone" "Name=phone_number_verified,Value=true" `
                2>$null
            $skipped++
        } else {
            Write-Host "  [X] Error: $result" -ForegroundColor Red
            continue
        }
    } else {
        # Step 3: Set permanent password (bypass FORCE_CHANGE_PASSWORD state)
        Write-Host "  [3] Setting permanent password..."
        aws cognito-idp admin-set-user-password `
            --user-pool-id $UserPoolId `
            --region $Region `
            --username $email `
            --password $password `
            --permanent 2>$null

        $created++
        Write-Host "  [OK] Created successfully!" -ForegroundColor Green
    }

    Write-Host ""
}

# Cleanup temp file
if (Test-Path $tempFile) { Remove-Item $tempFile -Force }

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "  Created: $created"
Write-Host "  Skipped/Updated (already exist): $skipped"
Write-Host ""
Write-Host "=== Test Accounts ===" -ForegroundColor Cyan
Write-Host ""
Write-Host ("{0,-30} {1,-15} {2,-20} {3}" -f "EMAIL", "PASSWORD", "PHONE", "NAME") -ForegroundColor Gray
Write-Host ("{0,-30} {1,-15} {2,-20} {3}" -f "-----", "--------", "-----", "----") -ForegroundColor Gray
foreach ($user in $TestUsers) {
    Write-Host ("{0,-30} {1,-15} {2,-20} {3}" -f $user.Email, $user.Password, $user.Phone, $user.Name)
}
Write-Host ""
Write-Host "App URL: https://master.d1domee0zrh3fl.amplifyapp.com/signin" -ForegroundColor Green
Write-Host ""
