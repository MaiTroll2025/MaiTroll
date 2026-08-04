Add-Type -AssemblyName System.Runtime.InteropServices;

# CRED_TYPE_GENERIC = 1
$CRED_TYPE_GENERIC = 1;

$targets = @(
    "LegacyGeneric:target=Supabase CLI:supabase",
    "LegacyGeneric:target=Supabase:CLI:supabase"
);

foreach ($target in $targets) {
    Write-Host "`nChecking target: $target";
    
    $dll = Add-Type -MemberDefinition @"
[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredRead(string target, int type, int reserved, out IntPtr credential);
"@ -Name "CredReader" -Namespace "Win32" -PassThru;

    $credentialPtr = [IntPtr]::Zero;
    $result = $dll::CredRead($target, $CRED_TYPE_GENERIC, 0, [ref]$credentialPtr);

    if ($result) {
        Write-Host "  Found credential!";
        
        # Read CREDENTIAL structure
        $flags = [Runtime.InteropServices.Marshal]::ReadInt32($credentialPtr);
        $type = [Runtime.InteropServices.Marshal]::ReadInt32($credentialPtr, 4);
        $targetNamePtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($credentialPtr, 8);
        $targetName = [Runtime.InteropServices.Marshal]::PtrToStringUni($targetNamePtr);
        
        $userNamePtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($credentialPtr, 48);
        $userName = [Runtime.InteropServices.Marshal]::PtrToStringUni($userNamePtr);
        
        $credentialBlobSize = [Runtime.InteropServices.Marshal]::ReadInt32($credentialPtr, 56);
        $credentialBlobPtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($credentialPtr, 64);
        
        Write-Host "  Target: $targetName";
        Write-Host "  User: $userName";
        Write-Host "  Blob size: $credentialBlobSize";
        
        if ($credentialBlobSize -gt 0) {
            $passwordBytes = New-Object byte[] $credentialBlobSize;
            [Runtime.InteropServices.Marshal]::Copy($credentialBlobPtr, $passwordBytes, 0, $credentialBlobSize);
            $password = [System.Text.Encoding]::Unicode.GetString($passwordBytes);
            Write-Host "  Password: $password";
        }
        
        [Runtime.InteropServices.Marshal]::FreeHGlobal($credentialPtr);
    } else {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error();
        Write-Host "  CredRead failed: $errorCode";
    }
}
