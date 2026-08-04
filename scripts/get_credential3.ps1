Add-Type -AssemblyName System.Runtime.InteropServices;

$target = "LegacyGeneric:target=Supabase CLI:supabase";

# Use CredEnumerate and CredRead APIs
$dll = Add-Type -MemberDefinition @"
[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredRead(string target, int type, int reserved, out IntPtr credential);
"@ -Name "CredentialReader" -Namespace "Win32" -PassThru;

$credentialPtr = [IntPtr]::Zero;
$result = $dll::CredRead($target, 1, 0, [ref]$credentialPtr);

if ($result) {
    Write-Output "Found credential: $target";
    # The credential structure is complex, let's just note we found it
    $dll::CredFree($credentialPtr);
} else {
    $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error();
    Write-Output "CredRead failed with error: $errorCode";
}
