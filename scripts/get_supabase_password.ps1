Add-Type -AssemblyName System.Runtime.InteropServices;

$target = "LegacyGeneric:target=Supabase CLI:supabase";

# CredEnumerate to find the credential
$dll = Add-Type -MemberDefinition @"
[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredEnumerate(string filter, int flag, out int count, out IntPtr credentials);

[DllImport("advapi32.dll", EntryPoint = "CredFree")]
public static extern bool CredFree(IntPtr credential);
"@ -Name "CredentialNative" -Namespace "Win32" -PassThru;

$count = 0;
$credentialsPtr = [IntPtr]::Zero;
$result = $dll::CredEnumerate($null, 1, [ref]$count, [ref]$credentialsPtr);

if ($result -and $count -gt 0) {
    Write-Output "Found $count credentials";
    
    for ($i = 0; $i -lt $count; $i++) {
        $credPtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($credentialsPtr, $i * [IntPtr]::Size);
        
        # Read the CREDENTIAL structure
        $flags = [Runtime.InteropServices.Marshal]::ReadInt32($credPtr);
        $type = [Runtime.InteropServices.Marshal]::ReadInt32($credPtr, 4);
        $targetNamePtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($credPtr, 8);
        $targetName = [Runtime.InteropServices.Marshal]::PtrToStringUni($targetNamePtr);
        
        $userNamePtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($credPtr, 48);
        $userName = [Runtime.InteropServices.Marshal]::PtrToStringUni($userNamePtr);
        
        $credentialBlobSize = [Runtime.InteropServices.Marshal]::ReadInt32($credPtr, 56);
        $credentialBlobPtr = [Runtime.InteropServices.Marshal]::ReadIntPtr($credPtr, 64);
        
        if ($targetName -like "*Supabase*") {
            Write-Output "Target: $targetName";
            Write-Output "User: $userName";
            
            if ($credentialBlobSize -gt 0) {
                $passwordBytes = New-Object byte[] $credentialBlobSize;
                [Runtime.InteropServices.Marshal]::Copy($credentialBlobPtr, $passwordBytes, 0, $credentialBlobSize);
                $password = [System.Text.Encoding]::Unicode.GetString($passwordBytes);
                Write-Output "Password: $password";
            }
        }
    }
    
    $dll::CredFree($credentialsPtr);
} else {
    $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Output "CredEnumerate failed: $errorCode";
}
